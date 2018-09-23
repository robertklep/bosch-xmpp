const crypto = require('crypto');

module.exports = class Encryption {
  constructor(key) {
    this.key = key;
  }

  encrypt(data) {
    var cipher = crypto.createCipheriv('aes-256-ecb', this.key, Buffer.alloc(0));

    cipher.setAutoPadding(false);

    // Apply manual padding.
    var buffer = Buffer.from(data, 'utf8');
    if (buffer.length % 16 !== 0) {
      buffer = Buffer.concat([
        buffer,
        Buffer.alloc(16 - (buffer.length % 16), 0)
      ]);
    }
    return cipher.update(buffer, null, 'base64') + cipher.final('base64');
  }

  decrypt(data) {
    var encrypted = Buffer.from(data, 'base64');
    var decipher  = crypto.createDecipheriv('aes-256-ecb', this.key, Buffer.alloc(0));

    decipher.setAutoPadding(false);

    // Add zero-padding?
    var paddingLength = encrypted.length % 8;
    if (paddingLength !== 0) {
      var padding = Buffer(paddingLength, 0);
      encrypted = Buffer.concat([ encrypted, padding ]);
    }
    return decipher.update(encrypted).toString() + decipher.final().toString();
  }

}
