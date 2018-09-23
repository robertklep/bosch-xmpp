// Patch `tls` so `node-xmpp-tls-connect` doesn't trigger a deprecation warning.
require('tls').convertNPNProtocols = null;

module.exports = {
  BaseClient: require('./lib/base-client'),
  IVTClient:  require('./lib/ivt-client')
};
