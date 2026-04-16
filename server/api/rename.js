const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('./sitemap.js');
const { renameIdKey } = require('../lib/ids.js');

async function handleRename(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { oldPath, newName } = JSON.parse(body || '{}');
      if (!oldPath || !newName || newName.includes('..')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Invalid parameters' }));
        return;
      }
      const oldAbs = path.resolve(projectRoot, oldPath);
      if (!oldAbs.startsWith(path.resolve(projectRoot))) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
        return;
      }
      const newAbs = path.join(path.dirname(oldAbs), newName);
      const newRel = path.posix.join(path.posix.dirname(oldPath), newName);
      await fs.rename(oldAbs, newAbs);
      const tabMatch = oldPath.match(/^prototype\/(pages|components)\/?/);
      const tab = tabMatch ? tabMatch[1] : 'pages';
      const oldIdPath = oldPath.replace(/^prototype\/(pages|components)\/?/, '');
      const newIdPath = newRel.replace(/^prototype\/(pages|components)\/?/, '');
      await renameIdKey(projectRoot, tab, oldIdPath, newIdPath);
      await regenerateSitemap(projectRoot);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { newPath: newRel } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleRename };
