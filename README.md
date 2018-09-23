# Bosch XMPP

(WIP) Bosch XMPP implementation, used for, amongst others:

* Nefit Easy
* IVT heat pumps

## Nefit Easy

```
const { NefitEasyClient } = require('bosch-xmpp');

// Instantiate client
const client = NefitEasyClient({
  serialNumber : '...',
  accessKey    : '...',
  password     : '...',
});

await client.connect();
try {
  console.log('%j', await client.get('/ecus/rrc/uiStatus'))
} catch(e) {
  console.error(e.stack || e);
}
client.end();
```

## IVT

```
const { IVTClient } = require('..');

const client = IVTClient({
  serialNumber : '...',
  accessKey    : '...',
  password     : '...',
});

await client.connect();
try {
  console.log('%j', await client.get('/gateway/versionFirmware'));
} catch(e) {
  console.error(e.stack || e);
}
client.end();
```
