'use strict';
const Promise    = require('bluebird');
const Queue      = require('promise-queue'); Queue.configure(Promise);
const debug      = require('debug')('bosch-easyremote');
const rawDebug   = require('debug')('bosch-easyremote:raw');
const HTTPParser = require('http-string-parser');
const XMPPClient = require('node-xmpp-client');
const Stanza     = XMPPClient.Stanza;
const Encryption = require('./encryption');
const SCRAM      = require('./scram-auth-mechanism');

// Default options for XMPP
const DEFAULT_OPTIONS = {
  host           : 'wa2-mz36-qrmzh6.bosch.de',
  port           : 5222,
  saslMechanism  : 'SCRAM-SHA-1',
  pingInterval   : 30 * 1000,
  maxRetries     : 15,
  retryTimeout   : 2000,
};

module.exports = class BaseClient {
  constructor(opts) {
    // Merge options with defaults.
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

    // Create XMPP client.
    this.client = new XMPPClient({
      host:      this.opts.host,
      port:      this.opts.port,
      jid:       this.opts.jid,
      password:  this.ACCESSKEY_PREFIX + this.opts.accessKey,
      preferred: this.opts.saslMechanism,
      autostart: false,
      reconnect: true,
    });
    this.client.availableSaslMechanisms = [ SCRAM ];

    // Pending GET requests.
    this.pending = {};

    // Request sequence number.
    this.seqno = 1;
  }

  ping() {
    this.client.send('<presence/>');
    setTimeout(() => this.ping(), this.opts.pingInterval).unref();
  }

  connect() {
    // If not already connected/connecting, create a promise that is resolved
    // when a connection has been made (or rejected if an error occurred).
    if (! this.connectionPromise) {
      this.connectionPromise = new Promise((resolve, reject) => {
        this.client.once('online', r => {
          this.jid = r.jid.toString();
          debug('online, jid = %s', this.jid);
          this.client.removeAllListeners('error');

          // Disable socket timeout and enable keepalives.
          this.client.connection.socket.setTimeout(0);
          this.client.connection.socket.setKeepAlive(true, 10000);

          // Send ping to backend to announce our presence.
          this.ping();

          // Resolve the connection promise.
          return resolve(r);
        }).once('error', e => {
          debug('connection error', e);
          this.client.removeAllListeners('online');
          return reject(e);
        }).connect();
      });
    }

    // Return the promise.
    return this.connectionPromise;
  }

  end() {
    this.client.end();
  }

  on() {
    return this.client.on.apply(this.client, arguments);
  }

  queueMessage(message) {
    // Queue the request
    return this.queue.add(() => {
      // Send the message.
      debug('sending message'); rawDebug(message.replace(/\r/g, '\n'));
      this.client.send(message);

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
          debug('received stanza of type "%s"', stanza.name); rawDebug(stanza.root().toString());

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
                error.data = stanza.root();
                return reject(error);

              default:
                // Parse the response as if it were an HTTP response, and resolve it.
                try {
                  return resolve(HTTPParser.parseResponse(stanza.root().getChild('body').getText().replace(/\n/g, '\r\n')));
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
    return new Stanza('message', {
      //      from : this.opts._from,
      to   : this.opts._to,
      type : 'chat',
    }).c('body').t(body).root().toString();//.replace(/\r/g, '&#13;\n');
  }

  get(uri, retries) {
    retries = retries || 0;
    const message = this.buildMessage([
      `GET ${ uri } HTTP/1.1`,
      `User-Agent: ${ this.USERAGENT }`,
      `Seq-No: ${ this.seqno++ }`,
      `\n\n`,
    ].join('\n\n'));

    debug('preparing message: %s (retries = %s)', uri, retries);

    // If we already have a request pending for this URI, send the message again but reuse the pending promise.
    if (uri in this.pending) {
      debug('using pending request for %s', uri);
      this.client.send(message);
    } else {
      this.pending[uri] = this.send(message).then(response => {
        if (response.statusCode !== '200') {
          const error = new Error('HTTP_' + response.statusMessage.toUpperCase().replace(/\s+/g, '_'));//'INVALID_RESPONSE');
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
    const message = this.buildMessage([
      `PUT ${ uri } HTTP/1.1`,
      `User-Agent: ${ this.USERAGENT }`,
      `Content-Type: application/json`,
      `Content-Length: ${ encrypted.length }`,
      `Seq-No: ${ this.seqno++ }`,
      ``,
      encrypted
    ].join('\n\n'));

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
