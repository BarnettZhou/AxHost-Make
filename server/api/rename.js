const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('./sitemap.js');

function isSafePath(projectRoot, inputPath) {
  if (inputPath.includes('..')) return false;
  const resolved = path.resolve(projectRoot, inputPath);
  return resolved.startsWith(path.resolve(projectRoot));
}

function isValidName(name) {
  return /^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(name);
}

async function handleRename(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { oldPath, newName } = JSON.parse(body || '{}');
      if (!oldPath || !newName || !isSafePath(projectRoot, oldPath) || !isValidName(newName)) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path or invalid name' }));
        return;
      }
      const oldAbs = path.resolve(projectRoot, oldPath);
      const newAbs = path.join(path.dirname(oldAbs), newName);
      if (!newAbs.startsWith(path.resolve(projectRoot))) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Target path out of bounds' }));
        return;
      }
      try {
        await fs.access(newAbs);
        res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 409, message: 'Target already exists' }));
        return;
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
      await fs.rename(oldAbs, newAbs);
      await regenerateSitemap(projectRoot);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { newPath: path.posix.join(path.dirname(oldPath), newName) } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleRename };
