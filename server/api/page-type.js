const fs = require('fs/promises');
const path = require('path');
const { readSitemap, writeSitemap } = require('../lib/sitemap-io.js');

function updateNodePageType(nodes, id, pageType) {
  for (const n of nodes) {
    if (n.id === id) {
      n.page_type = pageType;
      return true;
    }
    if (n.children && updateNodePageType(n.children, id, pageType)) return true;
  }
  return false;
}

async function handlePageType(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { path: targetPath, pageType } = JSON.parse(body || '{}');
      if (!targetPath || !pageType || !['default', 'mobile', 'mini-program'].includes(pageType)) {
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

      // Update .axhost-meta.json
      const metaPath = path.join(absPath, '.axhost-meta.json');
      try {
        await fs.access(metaPath);
        let meta = {};
        try {
          meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        } catch {}
        meta.page_type = pageType;
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
      } catch {}

      // Update sitemap
      const tab = targetPath.includes('flowcharts') ? 'flowcharts' : targetPath.includes('components') ? 'components' : 'pages';
      const sitemap = await readSitemap(projectRoot);
      const tree = sitemap[tab] || [];
      const id = path.basename(absPath);
      updateNodePageType(tree, id, pageType);
      await writeSitemap(projectRoot, sitemap);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { path: targetPath, pageType } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handlePageType };
