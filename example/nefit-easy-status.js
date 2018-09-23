const { NefitEasyClient } = require('..');

// Instantiate client
const client = NefitEasyClient({
  serialNumber : process.env.NEFIT_SERIAL_NUMBER,
  accessKey    : process.env.NEFIT_ACCESS_KEY,
  password     : process.env.NEFIT_PASSWORD,
});

// Connect client and retrieve status and pressure.
client.connect().then(() => {
  return client.get('/ecus/rrc/uiStatus');
}).then(response => {
  console.log('%j', response);
}).catch(e => {
  console.error(e.stack || e);
}).finally(() => {
  client.end();
});
