const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('./sitemap.js');

function isSafePath(projectRoot, inputPath) {
  if (inputPath.includes('..')) return false;
  const resolved = path.resolve(projectRoot, inputPath);
  return resolved.startsWith(path.resolve(projectRoot));
}

async function handleDelete(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { path: targetPath } = JSON.parse(body || '{}');
      if (!targetPath || !isSafePath(projectRoot, targetPath)) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
        return;
      }
      const absPath = path.resolve(projectRoot, targetPath);
      await fs.rm(absPath, { recursive: true, force: true });
      await regenerateSitemap(projectRoot);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, message: 'deleted' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleDelete };
