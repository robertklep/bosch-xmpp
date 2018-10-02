const express = require('express');

module.exports = (client, opts) => {
  return new Promise((resolve, reject) => {
    // Set up Express server to handle requests.
    const app    = express();
    const server = app.listen(opts['<port>'], opts['<host>'])
                    .on('close',     resolve)
                    .on('error',     reject)
                    .on('listening', () => {
                      let addr = server.address();
                      console.log('HTTP server listening on http://%s:%s', addr.address, addr.port);
                    });

    // Setup middleware.
    app.use(require('cors')());
    app.use(require('morgan')('combined'));
    app.use(express.json());

    // Bridge (HTTP <-> XMPP) routing.
    const bridgeRouter = express.Router();
    bridgeRouter.route('*').get((req, res, next) => {
      return client.get(req.url).then(r => res.json(r), next);
    }).post((req, res, next) => {
      return client.put(req.url, JSON.stringify(req.body)).then(r => res.json(r), next);
    });
    app.use('/bridge', bridgeRouter);

    // Error handler.
    app.use((err, req, res, next) => {
      console.log(err.stack);
      res.statusCode    = 500;
      res.statusMessage = err.message || 'Internal Server Error';
      return res.send(err.stack);
    });
  });
};
