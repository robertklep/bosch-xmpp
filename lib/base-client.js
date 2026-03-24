'use strict';
const Queue      = require('promise-queue');
const debug      = require('debug')('bosch-easyremote');
const rawDebug   = require('debug')('bosch-easyremote:raw');
const HTTPParser = require('http-string-parser');
const { client, xml } = require('@xmpp/client');
const Encryption = require('./encryption');

// Default options for XMPP
const DEFAULT_OPTIONS = {
  host           : 'wa2-mz36-qrmzh6.bosch.de',
  port           : 5222,
  pingInterval   : 30 * 1000,
  maxRetries     : 15,
  retryTimeout   : 2000,
};

module.exports = class BaseClient {
  constructor(opts) {
    // Merge options with defaults.
    opts.host = opts.host || DEFAULT_OPTIONS.host;
    this.opts = Object.assign({}, DEFAULT_OPTIONS, opts);

    // Generate some commonly used properties.
    const suffix  = this.opts.serialNumber + '@' + this.opts.host;
    this.opts.jid = this.opts._from = this.RRC_CONTACT_PREFIX + suffix;
    this.opts._to = this.RRC_GATEWAY_PREFIX + suffix;

    // Queue that holds pending requests. This allows us to limit the number of
    // concurrent requests to 1, which is a requirement imposed by the backend.
    this.queue = new Queue(1, Infinity);

    // Initialize crypto stuff
    this.encryption = new Encryption(this.generateEncryptionKey());

    // Accept self-signed certificates from Bosch XMPP servers.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    // Create XMPP client
    const username = this.RRC_CONTACT_PREFIX + this.opts.serialNumber;
    this.client = client({
      service:  `xmpp://${ this.opts.host }:${ this.opts.port }`,
      domain:   this.opts.host,
      username: username,
      password: this.ACCESSKEY_PREFIX + this.opts.accessKey,
    });

    // Disable auto-reconnect until we've successfully connected once.
    if (this.client.reconnect) {
      this.client.reconnect.stop();
    }

    // Pending GET requests.
    this.pending = {};

    // Request sequence number.
    this.seqno = 1;
  }

  ping() {
    this.client.send(xml('presence')).catch(e => debug('ping error', e));
    setTimeout(() => this.ping(), this.opts.pingInterval).unref();
  }

  connect() {
    // If not already connected/connecting, create a promise that is resolved
    // when a connection has been made (or rejected if an error occurred).
    if (! this.connectionPromise) {
      this.connectionPromise = new Promise((resolve, reject) => {
        const onOnline = (jid) => {
          this.jid = jid.toString();
          debug('online, jid = %s', this.jid);
          this.client.removeListener('error', onError);

          // Send ping to backend to announce our presence.
          this.ping();

          // Resolve the connection promise.
          return resolve(jid);
        };

        const onError = (e) => {
          debug('connection error', e);
          this.client.removeListener('online', onOnline);
          return reject(e);
        };

        this.client.once('online', onOnline);
        this.client.once('error', onError);
        this.client.start().catch(onError);
      });
    }

    // Return the promise.
    return this.connectionPromise;
  }

  end() {
    return this.client.stop();
  }

  on() {
    return this.client.on.apply(this.client, arguments);
  }

  queueMessage(message) {
    // Queue the request
    return this.queue.add(() => {
      // Return a new promise that gets resolved once the response has been
      // received (or rejected).
      return new Promise((resolve, reject) => {
        const removeListeners = () => {
          clearTimeout(timer);
          this.client.removeListener('stanza', stanzaHandler);
          this.client.removeListener('error',  errorHandler);
        };

        // Start timer for request timeouts.
        const timer = setTimeout(() => {
          removeListeners();
          return reject(new Error('REQUEST_TIMEOUT'));
        }, this.opts.retryTimeout);

        // Handler for incoming stanza messages.
        const stanzaHandler = stanza => {
          // Process stanza.
          debug('received stanza of type "%s"', stanza.name); rawDebug(stanza.toString());

          if (stanza.is('message')) {
            // Meant for us?
            const to = stanza.attrs.to;
            if (to !== this.jid) {
              debug('..stanza addressed to %s, not to us.', to);
              return;
            }

            // Clear listeners.
            removeListeners();

            // Determine course of action based on stanza type.
            switch (stanza.attrs.type) {
              case 'error':
                const error = new Error('ERROR_RESPONSE');
                error.data = stanza;
                return reject(error);

              default:
                // Parse the response as if it were an HTTP response, and resolve it.
                try {
                  return resolve(HTTPParser.parseResponse(stanza.getChild('body').getText().replace(/\n/g, '\r\n')));
                } catch(e) {
                  debug('cannot parse response', e);
                  return reject(Error('RESPONSE_PARSE_ERROR'));
                }
            }
          }
        };

        // Error handler.
        const errorHandler = e => {
          // Clear listeners.
          removeListeners();

          // Reject the request promise.
          return reject(e);
        };

        // Listen to the relevant client events.
        this.client.on('stanza', stanzaHandler);
        this.client.on('error',  errorHandler);

        // Send the message.
        debug('sending message'); rawDebug(message.toString().replace(/\r/g, '\n'));
        this.client.send(message).catch(e => {
          removeListeners();
          reject(e);
        });
      });
    });
  }

  send(message, retries) {
    retries = retries || 0;
    debug('queuing request (retries = %s)', retries);
    return this.queueMessage(message).catch(e => {
      if (e.message !== 'REQUEST_TIMEOUT')  throw e;
      if (retries++ > this.opts.maxRetries) throw Error('MAX_RETRIES_REACHED');
      debug('message timed out, retrying...');
      return this.send(message, retries);
    });
  }

  buildMessage(body) {
    return xml('message', { to: this.opts._to, type: 'chat' },
      xml('body', {}, body)
    );
  }

  get(uri, retries) {
    retries = retries || 0;
    const body = [
      `GET ${ uri } HTTP/1.1`,
      `User-Agent: ${ this.USERAGENT }`,
      `Seq-No: ${ this.seqno++ }`,
      `\n\n`,
    ].join(this.LINE_SEPARATOR || '\n\n');

    const message = this.buildMessage(body);

    debug('preparing message: %s (retries = %s)', uri, retries);

    // If we already have a request pending for this URI, send the message again but reuse the pending promise.
    if (uri in this.pending) {
      debug('using pending request for %s', uri);
      this.client.send(message).catch(e => debug('resend error', e));
    } else {
      this.pending[uri] = this.send(message).then(response => {
        if (response.statusCode !== '200') {
          const error = new Error('HTTP_' + response.statusMessage.toUpperCase().replace(/\s+/g, '_'));
          error.response = response;
          throw error;
        }

        // Decrypt message body and remove any padding.
        let decrypted = this.decrypt(response.body).replace(/\0*$/g, '');

        // Parse JSON responses.
        if (response.headers && response.headers['Content-Type'] === 'application/json') {
          try {
            decrypted = JSON.parse(decrypted);
          } catch(e) {
            throw e;
          }
        }
        return decrypted;
      }).finally(() => {
        debug('cleaning up for %s', uri);
        delete this.pending[uri];
      });
    }
    return this.pending[uri];
  }

  put(uri, data) {
    // Encrypt the data.
    const encrypted = this.encrypt(typeof data === 'string' ? data : JSON.stringify(data));

    // Build the message.
    const body = [
      `PUT ${ uri } HTTP/1.1`,
      `User-Agent: ${ this.USERAGENT }`,
      `Content-Type: application/json`,
      `Content-Length: ${ encrypted.length }`,
      `Seq-No: ${ this.seqno++ }`,
      ``,
      encrypted
    ].join(this.LINE_SEPARATOR || '\n');

    const message = this.buildMessage(body);

    // Send it.
    return this.send(message).then(response => {
      const status = Number(response.statusCode || 500);
      if (status >= 300) {
        const error = new Error('INVALID_RESPONSE');
        error.response = response;
        throw error;
      } else if (status === 204) {
        response.body = null;
      }
      return response.body || { status : 'ok' };
    });
  }

  generateEncryptionKey() {
    throw Error('NO_KEYGEN_PROVIDED');
  }

  encrypt(data, type) {
    return this.encryption.encrypt(data, type);
  }

  decrypt(data, type) {
    return this.encryption.decrypt(data, type);
  }

}
