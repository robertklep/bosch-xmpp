const BaseClient = require('./base-client');
const crypto     = require('crypto');
const MD5        = (s, encoding) => crypto.createHash('md5').update(s).digest(encoding);
const MAGIC      = Buffer.from('867845e97c4e29dce522b9a7d3a3e07b152bffadddbed7f5ffd842e9895ad1e4', 'hex');

class IVTClient extends BaseClient {
  constructor(opts) {
    if (opts.accessKey) {
      opts.accessKey = opts.accessKey.replace(/-/g, '');
    }
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

IVTClient.prototype.ACCESSKEY_PREFIX   = 'C6u9jPue_';
IVTClient.prototype.RRC_CONTACT_PREFIX = 'contact_';
IVTClient.prototype.RRC_GATEWAY_PREFIX = 'gateway_';
IVTClient.prototype.USERAGENT          = 'TeleHeater';

module.exports = opts => new IVTClient(opts);
module.exports.IVTClient = IVTClient;
