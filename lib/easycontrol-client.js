const BaseClient = require('./base-client');
const crypto     = require('crypto');
const MD5        = (s, encoding) => crypto.createHash('md5').update(s).digest(encoding);
const MAGIC      = Buffer.from('1d86b2631b02f2c7978b41e8a3ae609b0b2afbfd30ff386da60c586a827408e4', 'hex');

class EasyControlClient extends BaseClient {
  constructor(opts) {
    if (opts.accessKey) {
      opts.accessKey = opts.accessKey.replace(/-/g, '');
    }
    opts.host = opts.host || EasyControlClient.prototype.XMPP_HOST;
    super(opts);
  }

  generateEncryptionKey() {
    const hash1    = MD5(Buffer.concat([ Buffer.from(this.opts.accessKey), MAGIC ]));
    const hash2    = MD5(Buffer.concat([ MAGIC, Buffer.from(this.opts.password) ]));
    const finalKey = Buffer.alloc(32);
    for (let i = 0; i < 16; i++) {
      finalKey[i]      = hash1[i];
      finalKey[i + 16] = hash2[i];
    }
    return finalKey;
  }
}

EasyControlClient.prototype.ACCESSKEY_PREFIX   = 'C42i9NNp_';
EasyControlClient.prototype.RRC_CONTACT_PREFIX = 'rrc2contact_';
EasyControlClient.prototype.XMPP_HOST          = 'xmpp.rrcng.ticx.boschtt.net';
EasyControlClient.prototype.RRC_GATEWAY_PREFIX = 'rrc2gateway_';
EasyControlClient.prototype.USERAGENT          = 'rrc2';
EasyControlClient.prototype.LINE_SEPARATOR     = '\n';

module.exports = opts => new EasyControlClient(opts);
module.exports.EasyControlClient = EasyControlClient;
