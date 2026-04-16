const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('./sitemap.js');
const { renameIdKey } = require('../lib/ids.js');
const { removeFromOrder, addToOrder, readOrder, writeOrder } = require('../lib/order.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function isDescendant(parent, child) {
  const rel = path.relative(parent, child);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
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
      if (isDescendant(sourceAbs, targetAbs)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Cannot move into itself' }));
        return;
      }

      const sourceName = path.basename(sourceAbs);
      const targetName = path.basename(targetAbs);

      // before / after：移到 target 的同级并排序
      if (position === 'before' || position === 'after') {
        const targetParentAbs = path.dirname(targetAbs);
        const sourceParentAbs = path.dirname(sourceAbs);
        const targetOrder = await readOrder(targetParentAbs) || [];

        if (sourceParentAbs === targetParentAbs) {
          // 同级重排
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
            await writeOrder(targetParentAbs, order);
          }
        } else {
          // 跨目录移到 target 的 parent
          await removeFromOrder(sourceParentAbs, sourceName);
          const finalTargetAbs = path.join(targetParentAbs, sourceName);
          await fs.mkdir(path.dirname(finalTargetAbs), { recursive: true });
          await fs.rename(sourceAbs, finalTargetAbs);

          let order = targetOrder.slice();
          const targetIdx = order.indexOf(targetName);
          let insertIdx = targetIdx !== -1 ? (position === 'before' ? targetIdx : targetIdx + 1) : order.length;
          const sIdx = order.indexOf(sourceName);
          if (sIdx !== -1) {
            order.splice(sIdx, 1);
            if (sIdx < insertIdx) insertIdx -= 1;
          }
          order.splice(insertIdx, 0, sourceName);
          await writeOrder(targetParentAbs, order);

          const finalTargetRel = path.relative(projectRoot, finalTargetAbs).replace(/\\/g, '/');
          const tabMatch = resolvedSource.match(/^prototype\/(pages|components)\/?/);
          const tab = tabMatch ? tabMatch[1] : 'pages';
          const sourceIdPath = resolvedSource.replace(/^prototype\/(pages|components)\/?/, '');
          const targetIdPath = finalTargetRel.replace(/^prototype\/(pages|components)\/?/, '');
          await renameIdKey(projectRoot, tab, sourceIdPath, targetIdPath);
        }
        await regenerateSitemap(projectRoot);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 0, data: { newPath: path.posix.join(path.posix.dirname(resolvedTarget), sourceName) } }));
        return;
      }

      // drop-into：放入 target 内部（目录直接放入，页面/组件放入 sub-pages）
      const targetStat = await fs.stat(targetAbs).catch(() => null);
      if (!targetStat || !targetStat.isDirectory()) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Target does not exist or is not a directory' }));
        return;
      }

      const targetIndexExists = await exists(path.join(targetAbs, 'index.html'));
      const finalTargetDir = targetIndexExists
        ? path.join(targetAbs, 'sub-pages')
        : targetAbs;
      const finalTargetAbs = path.join(finalTargetDir, sourceName);
      const finalTargetRel = path.relative(projectRoot, finalTargetAbs).replace(/\\/g, '/');

      const sourceParentAbs = path.dirname(sourceAbs);
      await removeFromOrder(sourceParentAbs, sourceName);
      await addToOrder(finalTargetDir, sourceName);

      await fs.mkdir(path.dirname(finalTargetAbs), { recursive: true });
      await fs.rename(sourceAbs, finalTargetAbs);

      const tabMatch = resolvedSource.match(/^prototype\/(pages|components)\/?/);
      const tab = tabMatch ? tabMatch[1] : 'pages';
      const sourceIdPath = resolvedSource.replace(/^prototype\/(pages|components)\/?/, '');
      const targetIdPath = finalTargetRel.replace(/^prototype\/(pages|components)\/?/, '');
      await renameIdKey(projectRoot, tab, sourceIdPath, targetIdPath);
      await regenerateSitemap(projectRoot);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { newPath: finalTargetRel } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleMove };
