const http = require('http');
const { createRouter } = require('./router.js');

function startServer({ port = 3820, host = '127.0.0.1', projectRoot }) {
  const router = createRouter(projectRoot);
  const server = http.createServer((req, res) => {
    router(req, res).catch(err => {
      console.error('Router error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 500, message: 'Internal Server Error' }));
      }
    });
  });

  server.listen(port, host, () => {
    console.log(`Axhost-Make server running at http://${host}:${port}`);
  });

  return server;
}

module.exports = { startServer };
