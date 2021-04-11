// Patch `tls` so `node-xmpp-tls-connect` doesn't trigger a deprecation warning.
require('tls').convertNPNProtocols = null;

module.exports = {
  BaseClient:        require('./lib/base-client'),
  IVTClient:         require('./lib/ivt-client'),
  NefitEasyClient:   require('./lib/nefit-easy-client'),
  EasyControlClient: require('./lib/easycontrol-client'),
};
