const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('./sitemap.js');
const { removeFromOrder, addToOrder, readOrder, writeOrder } = require('../lib/order.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readMeta(absPath) {
  try {
    const content = await fs.readFile(path.join(absPath, '.axhost-meta.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeMeta(absPath, meta) {
  await fs.writeFile(
    path.join(absPath, '.axhost-meta.json'),
    JSON.stringify(meta, null, 2) + '\n',
    'utf-8'
  );
}

async function handleMove(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { sourcePath, targetPath, type, position } = JSON.parse(body || '{}');
      if (!sourcePath || !targetPath || sourcePath.includes('..') || targetPath.includes('..')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Invalid parameters' }));
        return;
      }
      const prefix = type ? `prototype/${type}/` : '';
      const resolvedSource = sourcePath.startsWith('prototype/') ? sourcePath : prefix + sourcePath;
      const resolvedTarget = targetPath.startsWith('prototype/') ? targetPath : prefix + targetPath;
      const sourceAbs = path.resolve(projectRoot, resolvedSource);
      const targetAbs = path.resolve(projectRoot, resolvedTarget);
      if (!sourceAbs.startsWith(path.resolve(projectRoot)) || !targetAbs.startsWith(path.resolve(projectRoot))) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
        return;
      }

      const sourceName = path.basename(sourceAbs);
      const targetName = path.basename(targetAbs);
      const tabPath = path.dirname(sourceAbs); // e.g. prototype/pages

      // before / after: reorder within tab root
      if (position === 'before' || position === 'after') {
        const targetOrder = await readOrder(tabPath) || [];
        const order = targetOrder.slice();
        const oldIdx = order.indexOf(sourceName);
        let newIdx = order.indexOf(targetName);
        if (oldIdx !== -1 && newIdx !== -1) {
          order.splice(oldIdx, 1);
          if (position === 'after') {
            if (newIdx > oldIdx) newIdx -= 1;
            newIdx += 1;
          }
          order.splice(newIdx, 0, sourceName);
          await writeOrder(tabPath, order);
        }
        await regenerateSitemap(projectRoot);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 0, data: { newPath: sourceName } }));
        return;
      }

      // drop-into: change parentId in meta
      const targetMeta = await readMeta(targetAbs);
      const targetHasIndex = await exists(path.join(targetAbs, 'index.html'));
      const targetKind = targetMeta.kind || (targetHasIndex ? 'page' : 'dir');
      if (targetKind !== 'dir') {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Target is not a directory' }));
        return;
      }

      const sourceMeta = await readMeta(sourceAbs);
      sourceMeta.parentId = targetName;
      await writeMeta(sourceAbs, sourceMeta);

      await regenerateSitemap(projectRoot);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { newPath: sourceName } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleMove };
