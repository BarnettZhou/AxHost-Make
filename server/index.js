const http = require('http');
const fs = require('fs');
const path = require('path');
const { createRouter } = require('./router.js');
const { startCacheCleanup } = require('./api/cache-cleanup.js');

function tryListen(server, host, port, maxTries) {
  return new Promise((resolve, reject) => {
    const attempt = (tryPort, remaining) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && remaining > 0) {
          console.log(`Port ${tryPort} in use, trying ${tryPort + 1}...`);
          attempt(tryPort + 1, remaining - 1);
        } else {
          reject(err);
        }
      });
      server.listen(tryPort, host, () => {
        resolve(tryPort);
      });
    };
    attempt(port, maxTries);
  });
}

async function startServer({ port = 3820, host = '127.0.0.1', projectRoot }) {
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

  const actualPort = await tryListen(server, host, port, 10);
  console.log(`Axhost-Make server running at http://${host}:${actualPort}`);

  // Write port file so launcher scripts can discover the actual port
  if (projectRoot) {
    try { fs.writeFileSync(path.join(projectRoot, '.server-port'), String(actualPort)); } catch (_) {}
  }

  if (projectRoot) {
    startCacheCleanup(projectRoot);
  }

  return server;
}

module.exports = { startServer };
