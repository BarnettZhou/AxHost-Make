const fs = require('fs/promises');
const path = require('path');
const { execSync } = require('child_process');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function getWindowsDocumentsPath() {
  try {
    const output = execSync(
      'powershell -NoProfile -Command "[Environment]::GetFolderPath(\'MyDocuments\')"',
      { encoding: 'utf-8', timeout: 5000 }
    );
    return output.trim();
  } catch (e) {
    return '';
  }
}

function getDefaultExportDir() {
  if (process.platform === 'win32') {
    const docs = getWindowsDocumentsPath() || path.join(process.env.USERPROFILE || '', 'Documents');
    return path.join(docs, 'axhost-make', 'projects');
  }
  const home = process.env.HOME || '';
  return path.join(home, 'axhost-make', 'projects');
}

async function handleExportDefaultDir(req, res) {
  try {
    const dir = getDefaultExportDir();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: { path: dir } }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
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

async function copyPageOrComponent(srcDir, destDir, relativePath) {
  const src = path.join(srcDir, relativePath);
  const dest = path.join(destDir, relativePath);
  if (await exists(src)) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyDir(s, d);
      } else {
        if (await exists(s)) {
          await fs.copyFile(s, d);
        }
      }
    }
  }
}

function filterTree(nodes, selectedPaths) {
  const result = [];
  for (const node of nodes) {
    if (node.type === 'page' || node.type === 'component') {
      if (selectedPaths.includes(node.path)) {
        result.push(node);
      }
    } else if (node.type === 'dir') {
      const filteredChildren = node.children ? filterTree(node.children, selectedPaths) : [];
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      }
    }
  }
  return result;
}

function buildFlatMap(nodes, tab, map) {
  for (const node of nodes) {
    if (node.id) {
      map[node.id] = { name: node.name, type: node.type, path: `${tab}/${node.path}` };
    }
    if (node.children) {
      buildFlatMap(node.children, tab, map);
    }
  }
}

async function rewriteSitemap(srcPrototypeDir, exportDir, selectedPages, selectedComponents) {
  const srcSitemapPath = path.join(srcPrototypeDir, 'sitemap.js');
  if (!await exists(srcSitemapPath)) return;

  const content = await fs.readFile(srcSitemapPath, 'utf-8');
  const jsonMatch = content.match(/window\.__axhostSitemap\s*=\s*([\s\S]*?);\s*$/);
  if (!jsonMatch) return;

  let sitemap;
  try {
    sitemap = JSON.parse(jsonMatch[1]);
  } catch (e) {
    return;
  }

  const filteredPages = filterTree(sitemap.pages || [], selectedPages);
  const filteredComponents = filterTree(sitemap.components || [], selectedComponents);

  const flatMap = {};
  buildFlatMap(filteredPages, 'pages', flatMap);
  buildFlatMap(filteredComponents, 'components', flatMap);

  const newSitemap = {
    name: sitemap.name || 'Prototype',
    pages: filteredPages,
    components: filteredComponents,
    _map: flatMap,
    generatedBy: 'axhost-make'
  };

  await fs.writeFile(
    path.join(exportDir, 'sitemap.js'),
    `window.__axhostSitemap = ${JSON.stringify(newSitemap, null, 2)};\n`,
    'utf-8'
  );

  await fs.writeFile(
    path.join(exportDir, '.axhost-map.json'),
    JSON.stringify(flatMap, null, 2) + '\n',
    'utf-8'
  );
}

async function handleExportPost(req, res, workspaceRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { projectName, targetDir, selectedPages, selectedComponents } = JSON.parse(body || '{}');

      if (!projectName || !targetDir) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'projectName and targetDir are required' }));
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      const projectId = url.searchParams.get('project');
      if (!projectId) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'project is required' }));
        return;
      }

      const srcProjectDir = path.join(workspaceRoot, 'projects', projectId);
      const srcPrototypeDir = path.join(srcProjectDir, 'prototype');
      const exportDir = path.join(targetDir, projectName);

      // Ensure target dir exists
      await fs.mkdir(exportDir, { recursive: true });

      // 1. Copy shared resources
      const srcResources = path.join(srcPrototypeDir, 'resources');
      const destResources = path.join(exportDir, 'resources');
      if (await exists(srcResources)) {
        await copyDir(srcResources, destResources);
      }

      // 2. Copy root-level prototype files (excluding sitemap files, rewritten later)
      const filesToCopy = ['index.html', 'start.html', 'icon.svg'];
      for (const file of filesToCopy) {
        const srcFile = path.join(srcPrototypeDir, file);
        if (await exists(srcFile)) {
          await fs.copyFile(srcFile, path.join(exportDir, file));
        }
      }

      // 3. Rewrite sitemap.js and .axhost-map.json based on selection
      await rewriteSitemap(srcPrototypeDir, exportDir, selectedPages || [], selectedComponents || []);

      // 4. Copy selected pages
      const pagesDir = path.join(srcPrototypeDir, 'pages');
      const destPagesDir = path.join(exportDir, 'pages');
      for (const pagePath of (selectedPages || [])) {
        await copyPageOrComponent(pagesDir, destPagesDir, pagePath);
      }

      // 5. Copy selected components
      const componentsDir = path.join(srcPrototypeDir, 'components');
      const destComponentsDir = path.join(exportDir, 'components');
      for (const compPath of (selectedComponents || [])) {
        await copyPageOrComponent(componentsDir, destComponentsDir, compPath);
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { exportPath: exportDir } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleExportDefaultDir, handleExportPost };
