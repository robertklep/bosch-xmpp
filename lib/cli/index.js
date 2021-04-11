const fs      = require('fs');
const path    = require('path');
const docopt  = require('docopt').docopt;
const clients = require('../..');

// Parse command line options.
const opts = docopt(fs.readFileSync(__dirname + '/docopt.txt', 'utf8'), {
  version : require('../../package').version
});

module.exports = function() {
  // Set and check required parameters.
  const params = {
    serialNumber : opts['--serial']     || process.env.BOSCH_XMPP_SERIAL_NUMBER,
    accessKey    : opts['--access-key'] || process.env.BOSCH_XMPP_ACCESS_KEY,
    password     : opts['--password']   || process.env.BOSCH_XMPP_PASSWORD,
    retryTimeout : Number(opts['--timeout']) * 1000,
  };
  let error = null;
  if (! params.serialNumber) error = 'missing serial number';
  if (! params.accessKey)    error = 'missing access key';
  if (! params.password)     error = 'missing password';
  if (error) {
    console.error('Error: %s', error);
    process.exit(1);
  }
  params.host = opts['--xmpp-host'];
  params.port = opts['--xmpp-port'];

  // Instantiate client.
  let client;
  switch (opts['CLIENT']) {
    case 'ivt':
      client = clients.IVTClient(params);
      break;
    case 'nefit':
      client = clients.NefitEasyClient(params);
      break;
    case 'easycontrol':
      client = clients.EasyControlClient(params);
      break;
    default:
      console.error('Unknown client: %s', opts['CLIENT']);
      process.exit(1);
  }

  // Error handler
  const onError = err => {
    console.error(err);
    if (opts['--verbose'] && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }

  // Check what should happen: GET, PUT or start the bridge.
  client.connect().then(() => {
    if (opts.get) {
      return client .get(opts['<endpoint>'])
                    .then(v  => console.log('%j', v), onError)
                    .then(() => process.exit(0));
    } else if (opts.put) {
      return client .put(opts['<endpoint>'], JSON.parse(opts['<value>']))
                    .then(v  => console.log('%j', v), onError)
                    .then(() => process.exit(0));
    } else if (opts.bridge) {
      opts['<host>'] = opts['<host>'] || '127.0.0.1';
      opts['<port>'] = opts['<port>'] || 3000;
      return require('./server')(client, opts);
    } else {
      console.error("Don't know what to do?");
      process.exit(1);
    }
  });
};
