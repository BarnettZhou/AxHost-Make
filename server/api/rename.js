const fs = require('fs/promises');
const path = require('path');
const { readSitemap, writeSitemap, refreshSitemapDocs } = require('../lib/sitemap-io.js');
const { renameInOrder } = require('../lib/order.js');

function updateNodeName(nodes, id, newName) {
  for (const n of nodes) {
    if (n.id === id) {
      n.name = newName;
      return true;
    }
    if (n.children && updateNodeName(n.children, id, newName)) return true;
  }
  return false;
}

async function handleRename(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { path: targetPath, oldPath, newName } = JSON.parse(body || '{}');
      const resolvedPath = targetPath || oldPath;
      if (!resolvedPath || !newName) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Invalid parameters' }));
        return;
      }
      const absPath = path.resolve(projectRoot, resolvedPath);
      if (!absPath.startsWith(path.resolve(projectRoot))) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
        return;
      }

      // Validate doc name (only English, numbers, spaces and English punctuation)
      const baseName = path.basename(absPath);
      const parentDir = path.dirname(absPath);
      if (path.basename(parentDir) === 'docs' && baseName.endsWith('.md')) {
        const docNameWithoutExt = newName.replace(/\.md$/, '');
        if (!/^[a-zA-Z0-9\s\-_!@#$%^&()+=\[\]{}|;:'",.<>?\/`~]+$/.test(docNameWithoutExt)) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, message: '文档名称只能包含英文、数字、空格和英文标点' }));
          return;
        }
      }

      // Update .axhost-meta.json if physical dir exists (page/component)
      const metaPath = path.join(absPath, '.axhost-meta.json');
      try {
        await fs.access(metaPath);
        let meta = { name: newName };
        try {
          const existing = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
          meta = { ...existing, name: newName };
        } catch {}
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
      } catch {}

      // 同步更新 index.html 中的 <title>
      const indexPath = path.join(absPath, 'index.html');
      try {
        const indexContent = await fs.readFile(indexPath, 'utf-8');
        const updatedContent = indexContent.replace(/<title>.*?<\/title>/i, `<title>${newName}</title>`);
        if (updatedContent !== indexContent) {
          await fs.writeFile(indexPath, updatedContent, 'utf-8');
        }
      } catch {}

      // Update sitemap
      const tab = resolvedPath.includes('flowcharts') ? 'flowcharts' : resolvedPath.includes('components') ? 'components' : 'pages';
      const sitemap = await readSitemap(projectRoot);
      const tree = sitemap[tab] || [];
      const id = path.basename(absPath);
      updateNodeName(tree, id, newName);
      if (sitemap._map && sitemap._map[id]) {
        sitemap._map[id].name = newName;
      }
      await writeSitemap(projectRoot, sitemap);

      // Sync docs order and rename file if renaming a .md file inside docs/
      const oldName = path.basename(absPath);
      const parentDir = path.dirname(absPath);
      if (path.basename(parentDir) === 'docs' && oldName.endsWith('.md')) {
        // Actually rename the file on disk
        const newAbsPath = path.join(parentDir, newName);
        await fs.rename(absPath, newAbsPath);
        await renameInOrder(parentDir, oldName, newName);
        await refreshSitemapDocs(projectRoot, resolvedPath);
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { path: resolvedPath } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleRename,
  routes: [
    { method: 'POST', path: '/api/rename', handler: handleRename, scope: 'project' }
  ]
};
