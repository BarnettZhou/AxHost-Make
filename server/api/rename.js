const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('./sitemap.js');

async function handleRename(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { path: targetPath, newName } = JSON.parse(body || '{}');
      if (!targetPath || !newName) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Invalid parameters' }));
        return;
      }
      const absPath = path.resolve(projectRoot, targetPath);
      if (!absPath.startsWith(path.resolve(projectRoot))) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
        return;
      }

      // 新架构下，重命名只改 .axhost-meta.json 里的显示名称
      // 目录名（hash）保持不变
      const metaPath = path.join(absPath, '.axhost-meta.json');
      let meta = { name: newName };
      try {
        const existing = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        meta = { ...existing, name: newName };
      } catch {}
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');

      await regenerateSitemap(projectRoot);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { path: targetPath } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleRename };
