# Bosch XMPP

Unofficial Bosch XMPP implementation, used for, amongst others:

* Nefit Easy
* Bosch/IVT heat pumps
* (probably) any Bosch EasyRemote compatible controller

## Command Line Interface

Install using `-g/--global`:
```
$ npm i -g bosch-xmpp
```

Options:

```
bosch-xmpp – Bosch XMPP command line interface

Usage:
  bosch-xmpp [options] CLIENT get <endpoint>
  bosch-xmpp [options] CLIENT put <endpoint> <value>
  bosch-xmpp [options] CLIENT bridge [<port>] [<host>]

Options:
  -h --help                Show this screen
  -v --version             Show version
  -V --verbose             Be more verbose
  --serial=SERIAL          Device serial number
  --access-key=ACCESS_KEY  Device access key
  --password=PASSWORD      Device password
  --xmpp-host=HOST         XMPP host to connect to [default: wa2-mz36-qrmzh6.bosch.de]
  --xmpp-port=PORT         XMPP port to connect to [default: 5222]
  --timeout=TIMEOUT        Retry timeout in seconds [default: 5]

Supported values for CLIENT:
  nefit                    Nefit Easy or compatible
  ivt                      IVT/Bosch devices (mainly heat pumps)

Examples:
  $ bosch-xmpp nefit get /ecus/rrc/uiStatus
  $ bosch-xmpp ivt get /gateway/versionFirmware
  $ bosch-xmpp nefit put /heatingCircuits/hc1/temperatureRoomManual '{"value":20.5}'
  $ bosch-xmpp ivt bridge 8080 0.0.0.0

Instead of specifying serial number, access key or password through
options, you can also define them through environment variables:

  BOSCH_XMPP_SERIAL_NUMBER
  BOSCH_XMPP_ACCESS_KEY
  BOSCH_XMPP_PASSWORD
```

## API

Install locally:
```
$ npm i bosch-xmpp
```

### Nefit Easy

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

### IVT

```
const { IVTClient } = require('bosch-xmpp');

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

# Disclaimer

The implementation of this library is based on reverse-engineering the communications between the mobile apps and the backend, plus various other bits and pieces of information. It is not based on any official information given out by Bosch, Nefit or affiliated companies, and therefore there are no guarantees whatsoever regarding the safety of your devices and/or their settings, or the accuracy of the information provided.
