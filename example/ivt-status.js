const { IVTClient } = require('..');

// Instantiate client
const client = IVTClient({
  serialNumber : process.env.IVT_SERIAL_NUMBER,
  accessKey    : process.env.IVT_ACCESS_KEY,
  password     : process.env.IVT_PASSWORD,
});

client.connect().then(() => {
  return client.get('/system/sensors/outdoorTemperatures');
}).then(response => {
  console.log('%j', response);
}).catch(e => {
  console.error(e.stack || e);
}).finally(() => {
  client.end();
});
