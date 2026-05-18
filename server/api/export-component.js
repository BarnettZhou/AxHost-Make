const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { readSitemap, writeSitemap, addNodeToSitemap } = require('../lib/sitemap-io.js');
const { generateId } = require('../lib/ids.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readMeta(absPath) {
  try {
    return JSON.parse(await fs.readFile(path.join(absPath, '.axhost-meta.json'), 'utf-8'));
  } catch { return {}; }
}

async function writeMeta(absPath, meta) {
  await fs.writeFile(
    path.join(absPath, '.axhost-meta.json'),
    JSON.stringify(meta, null, 2) + '\n',
    'utf-8'
  );
}

async function collectExistingIds(projectRoot) {
  const ids = new Set();
  for (const tab of ['pages', 'components', 'flowcharts']) {
    const dir = path.join(projectRoot, 'prototype', tab);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && /^[a-f0-9]{8}$/i.test(e.name)) {
          ids.add(e.name.toLowerCase());
        }
      }
    } catch {}
  }
  return ids;
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function handleExportComponent(req, res, workspaceRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { sourceProjectId, targetProjectId, componentPath, selectedDocs } = JSON.parse(body || '{}');

      if (!sourceProjectId || !targetProjectId || !componentPath) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'sourceProjectId, targetProjectId and componentPath are required' }));
        return;
      }

      if (sourceProjectId === targetProjectId) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: '不能导出到当前项目，请选择其他项目' }));
        return;
      }

      const sourceProjectRoot = path.join(workspaceRoot, 'projects', sourceProjectId);
      const targetProjectRoot = path.join(workspaceRoot, 'projects', targetProjectId);

      if (!await exists(sourceProjectRoot)) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 404, message: '源项目不存在' }));
        return;
      }
      if (!await exists(targetProjectRoot)) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 404, message: '目标项目不存在' }));
        return;
      }

      const sourceDir = path.join(sourceProjectRoot, 'prototype', 'components', componentPath);
      if (!await exists(sourceDir)) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 404, message: '源组件不存在' }));
        return;
      }

      // Read source metadata
      const srcMeta = await readMeta(sourceDir);
      const componentName = srcMeta.name || componentPath;

      // Generate new unique ID in target project
      const existingIds = await collectExistingIds(targetProjectRoot);
      const newHash = generateId(componentName, existingIds);

      const targetComponentsDir = path.join(targetProjectRoot, 'prototype', 'components');
      const newDir = path.join(targetComponentsDir, newHash);

      // Copy all files from source to target
      await copyDir(sourceDir, newDir);

      // Remove unselected docs
      const docs = selectedDocs || [];
      const docsDir = path.join(newDir, 'docs');
      if (await exists(docsDir)) {
        const docEntries = await fs.readdir(docsDir);
        for (const doc of docEntries) {
          if (doc.startsWith('.')) continue;
          if (!docs.includes(doc)) {
            await fs.unlink(path.join(docsDir, doc));
          }
        }
      }

      // Rewrite metadata (keep name, kind, page_type; reset parentId)
      const newMeta = {
        name: componentName,
        kind: srcMeta.kind || 'component',
        page_type: srcMeta.page_type || 'default'
      };
      await writeMeta(newDir, newMeta);

      // Collect remaining docs for sitemap
      const finalDocs = [];
      if (await exists(docsDir)) {
        const entries = await fs.readdir(docsDir);
        for (const e of entries) {
          if (!e.startsWith('.')) finalDocs.push(e);
        }
      }

      // Update target sitemap
      const sitemap = await readSitemap(targetProjectRoot);
      const nodeData = {
        id: newHash,
        name: componentName,
        path: newHash,
        type: 'component',
        parentId: null,
        docs: finalDocs,
        page_type: newMeta.page_type
      };
      addNodeToSitemap(sitemap, 'components', null, nodeData);
      await writeSitemap(targetProjectRoot, sitemap);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { id: newHash, name: componentName, path: newHash } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleExportComponent,
  routes: [
    { method: 'POST', path: '/api/export-component', handler: handleExportComponent, scope: 'workspace' }
  ]
};
