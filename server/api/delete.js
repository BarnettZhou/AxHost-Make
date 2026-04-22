const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('./sitemap.js');
const { removeFromOrder } = require('../lib/order.js');

async function readMeta(absPath) {
  try {
    const content = await fs.readFile(path.join(absPath, '.axhost-meta.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function collectChildren(tabPath, parentId) {
  const entries = await fs.readdir(tabPath, { withFileTypes: true }).catch(() => []);
  const children = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const meta = await readMeta(path.join(tabPath, entry.name));
    if (meta.parentId === parentId) {
      children.push(entry.name);
    }
  }
  return children;
}

async function deleteRecursively(tabPath, id) {
  // Cascade delete: delete this node and all its descendants
  const children = await collectChildren(tabPath, id);
  for (const childId of children) {
    await deleteRecursively(tabPath, childId);
  }
  const absPath = path.join(tabPath, id);
  await removeFromOrder(tabPath, id);
  await fs.rm(absPath, { recursive: true, force: true });
}

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

      const tabPath = path.dirname(absPath);
      const id = path.basename(absPath);

      await deleteRecursively(tabPath, id);

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
