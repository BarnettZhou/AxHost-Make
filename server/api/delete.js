const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('./sitemap.js');
const { removeIdKey } = require('../lib/ids.js');
const { removeFromOrder } = require('../lib/order.js');

async function handleDelete(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { path: targetPath } = JSON.parse(body || '{}');
      if (!targetPath || targetPath.includes('..')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Invalid path' }));
        return;
      }
      const absPath = path.resolve(projectRoot, targetPath);
      if (!absPath.startsWith(path.resolve(projectRoot))) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
        return;
      }

      await removeFromOrder(path.dirname(absPath), path.basename(absPath));
      await fs.rm(absPath, { recursive: true, force: true });

      const tabMatch = targetPath.match(/^prototype\/(pages|components)\/?/);
      const tab = tabMatch ? tabMatch[1] : 'pages';
      const idPath = targetPath.replace(/^prototype\/(pages|components)\/?/, '');
      await removeIdKey(projectRoot, tab, idPath);
      await regenerateSitemap(projectRoot);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0 }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleDelete };
