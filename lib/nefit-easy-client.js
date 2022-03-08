const BaseClient = require('./base-client');
const crypto     = require('crypto');
const MD5        = (s, encoding) => crypto.createHash('md5').update(s).digest(encoding);
const MAGIC      = Buffer.from('58f18d70f667c9c79ef7de435bf0f9b1553bbb6e61816212ab80e5b0d351fbb1', 'hex');

class NefitEasyClient extends BaseClient {
  // Nefit requires particular EOL's
  buildMessage(body) {
    let msg = super.buildMessage(body);
    return msg.replace(/\r/g, '&#13;\n');
  }

  generateEncryptionKey() {
    return Buffer.concat([
      MD5( Buffer.concat([ Buffer.from(this.opts.accessKey), MAGIC ]) ),
      MD5( Buffer.concat([ MAGIC, Buffer.from(this.opts.password) ]) )
    ]);
  }
}

NefitEasyClient.prototype.ACCESSKEY_PREFIX   = 'Ct7ZR03b_';
NefitEasyClient.prototype.RRC_CONTACT_PREFIX = 'rrccontact_';
NefitEasyClient.prototype.RRC_GATEWAY_PREFIX = 'rrcgateway_';
NefitEasyClient.prototype.USERAGENT          = 'NefitEasy';

module.exports = opts => new NefitEasyClient(opts);
module.exports.NefitEasyClient = NefitEasyClient;
