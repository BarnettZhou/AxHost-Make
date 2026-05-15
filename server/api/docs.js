const fs = require('fs/promises');
const path = require('path');
const { ensureOrder, reorder, writeOrder } = require('../lib/order.js');

function isSafePath(projectRoot, inputPath) {
  if (inputPath.includes('..')) return false;
  const resolved = path.resolve(projectRoot, inputPath);
  return resolved.startsWith(path.resolve(projectRoot));
}

async function handleDocsGet(req, res, projectRoot) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const docsPathInput = url.searchParams.get('path');
  if (!docsPathInput || !isSafePath(projectRoot, docsPathInput)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
    return;
  }
  const docsPath = path.resolve(projectRoot, docsPathInput);
  try {
    const entries = await fs.readdir(docsPath, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name);
    const ordered = await ensureOrder(docsPath, files);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: ordered }));
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: [] }));
  }
}

async function handleDocsReorder(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { path: docsPathInput, oldIndex, newIndex, order } = JSON.parse(body || '{}');
      if (!docsPathInput || !isSafePath(projectRoot, docsPathInput)) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
        return;
      }
      const docsPath = path.resolve(projectRoot, docsPathInput);
      if (Array.isArray(order)) {
        const entries = await fs.readdir(docsPath, { withFileTypes: true }).catch(() => []);
        const files = new Set(entries.filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name));
        const validOrder = order.filter(name => files.has(name));
        for (const name of files) {
          if (!validOrder.includes(name)) validOrder.push(name);
        }
        await writeOrder(docsPath, validOrder);
      } else {
        const ok = await reorder(docsPath, oldIndex, newIndex);
        if (!ok) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, message: 'Invalid index' }));
          return;
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0 }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleDocsGet, handleDocsReorder,
  routes: [
    { method: 'GET', path: '/api/docs', handler: handleDocsGet, scope: 'project' },
    { method: 'POST', path: '/api/docs/reorder', handler: handleDocsReorder, scope: 'project' }
  ]
};
