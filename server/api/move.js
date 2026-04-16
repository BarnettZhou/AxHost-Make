const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('./sitemap.js');
const { renameIdKey } = require('../lib/ids.js');

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
      const { sourcePath, targetPath } = JSON.parse(body || '{}');
      if (!sourcePath || !targetPath || sourcePath.includes('..') || targetPath.includes('..')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Invalid parameters' }));
        return;
      }
      const sourceAbs = path.resolve(projectRoot, sourcePath);
      const targetAbs = path.resolve(projectRoot, targetPath);
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

      const targetStat = await fs.stat(targetAbs).catch(() => null);
      if (!targetStat || !targetStat.isDirectory()) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Target does not exist or is not a directory' }));
        return;
      }

      const targetIndexExists = await exists(path.join(targetAbs, 'index.html'));
      const finalTargetAbs = targetIndexExists
        ? path.join(targetAbs, 'sub-pages', path.basename(sourceAbs))
        : path.join(targetAbs, path.basename(sourceAbs));
      const finalTargetRel = path.relative(projectRoot, finalTargetAbs).replace(/\\/g, '/');
      await fs.mkdir(path.dirname(finalTargetAbs), { recursive: true });
      await fs.rename(sourceAbs, finalTargetAbs);
      const tabMatch = sourcePath.match(/^prototype\/(pages|components)\/?/);
      const tab = tabMatch ? tabMatch[1] : 'pages';
      const sourceIdPath = sourcePath.replace(/^prototype\/(pages|components)\/?/, '');
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
