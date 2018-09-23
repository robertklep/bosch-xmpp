'use strict';
const SASL      = require('node-xmpp-client').SASL;
const crypto    = require('crypto');
const inherits  = require('node-xmpp-core').inherits;
const Mechanism = SASL.AbstractMechanism;

const sasl    = require('saslmechanisms');
const factory = new sasl.Factory();
factory.use(require('sasl-scram-sha-1'));

const SCRAM = module.exports = class SCRAM extends Mechanism {

  constructor() {
    super();
    this.mech = factory.create([ 'SCRAM-SHA-1' ]);
  }

  auth() {
    return this.mech.response({ username : this.authcid, password : this.password });
  }

  challenge(ch) {
    return this.mech.challenge(ch).response({ username : this.authcid, password : this.password });
  }
}

SCRAM.prototype.name  = 'SCRAM-SHA-1';
SCRAM.prototype.match = opts => 'password' in opts;
