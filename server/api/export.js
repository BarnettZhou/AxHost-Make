const fs = require('fs/promises');
const path = require('path');
const { execSync } = require('child_process');
const { createReadStream } = require('fs');

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
    if (node.type === 'page' || node.type === 'component' || node.type === 'spec') {
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

async function rewriteSitemap(srcPrototypeDir, exportDir, selectedPages, selectedComponents, selectedFlowcharts) {
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
  const filteredFlowcharts = filterTree(sitemap.flowcharts || [], selectedFlowcharts || []);

  const flatMap = {};
  buildFlatMap(filteredPages, 'pages', flatMap);
  buildFlatMap(filteredComponents, 'components', flatMap);
  buildFlatMap(filteredFlowcharts, 'flowcharts', flatMap);

  const newSitemap = {
    name: sitemap.name || 'Prototype',
    pages: filteredPages,
    components: filteredComponents,
    flowcharts: filteredFlowcharts,
    _map: flatMap,
    generatedBy: 'axhost-make'
  };

  await fs.writeFile(
    path.join(exportDir, 'sitemap.js'),
    `window.__axhostSitemap = ${JSON.stringify(newSitemap, null, 2)};\n`,
    'utf-8'
  );


}

async function prepareExportDir(srcPrototypeDir, exportDir, selectedPages, selectedComponents, selectedFlowcharts) {
  await fs.mkdir(exportDir, { recursive: true });

  const srcResources = path.join(srcPrototypeDir, 'resources');
  const destResources = path.join(exportDir, 'resources');
  if (await exists(srcResources)) {
    await copyDir(srcResources, destResources);
  }

  const filesToCopy = ['index.html', 'start.html', 'icon.svg'];
  for (const file of filesToCopy) {
    const srcFile = path.join(srcPrototypeDir, file);
    if (await exists(srcFile)) {
      await fs.copyFile(srcFile, path.join(exportDir, file));
    }
  }

  await rewriteSitemap(srcPrototypeDir, exportDir, selectedPages || [], selectedComponents || [], selectedFlowcharts || []);

  const pagesDir = path.join(srcPrototypeDir, 'pages');
  const destPagesDir = path.join(exportDir, 'pages');
  for (const pagePath of (selectedPages || [])) {
    await copyPageOrComponent(pagesDir, destPagesDir, pagePath);
  }

  const componentsDir = path.join(srcPrototypeDir, 'components');
  const destComponentsDir = path.join(exportDir, 'components');
  for (const compPath of (selectedComponents || [])) {
    await copyPageOrComponent(componentsDir, destComponentsDir, compPath);
  }

  const flowchartsDir = path.join(srcPrototypeDir, 'flowcharts');
  const destFlowchartsDir = path.join(exportDir, 'flowcharts');
  for (const flowPath of (selectedFlowcharts || [])) {
    await copyPageOrComponent(flowchartsDir, destFlowchartsDir, flowPath);
  }
}

async function handleExportPost(req, res, workspaceRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { projectName, targetDir, selectedPages, selectedComponents, selectedFlowcharts } = JSON.parse(body || '{}');

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

      await prepareExportDir(srcPrototypeDir, exportDir, selectedPages, selectedComponents, selectedFlowcharts);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { exportPath: exportDir } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

async function handleExportPublish(req, res, workspaceRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { serverUrl, token, remoteProjectId, selectedPages, selectedComponents, selectedFlowcharts } = JSON.parse(body || '{}');

      if (!serverUrl || !token || !remoteProjectId) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'serverUrl, token and remoteProjectId are required' }));
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
      const cacheDir = path.join(workspaceRoot, 'cache', projectId);
      const zipPath = cacheDir + '.zip';

      // 1. Clean and create temp dir
      try { await fs.rm(cacheDir, { recursive: true, force: true }); } catch (e) {}
      await fs.mkdir(cacheDir, { recursive: true });

      // 2. Copy files
      await prepareExportDir(srcPrototypeDir, cacheDir, selectedPages, selectedComponents, selectedFlowcharts);

      // 3. Pack to zip using tar (bsdtar supports zip on Windows 10+)
      try { await fs.rm(zipPath, { force: true }); } catch (e) {}
      execSync(`tar -acf "${zipPath}" -C "${cacheDir}" .`, { timeout: 30000 });

      // 4. Upload to AxHost
      const uploadUrl = serverUrl.replace(/\/+$/, '') + `/api/projects/${remoteProjectId}/update-file`;
      const fileBuffer = await fs.readFile(zipPath);
      const blob = new Blob([fileBuffer]);
      const formData = new FormData();
      formData.append('file', blob, 'project.zip');

      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData
      });

      let uploadData = {};
      try {
        uploadData = await uploadRes.json();
      } catch (e) {}

      // 5. Cleanup
      try { await fs.rm(cacheDir, { recursive: true, force: true }); } catch (e) {}
      try { await fs.rm(zipPath, { force: true }); } catch (e) {}

      if (uploadRes.ok) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 0, data: uploadData }));
      } else {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 502, message: uploadData.message || 'Upload failed', status: uploadRes.status }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleExportDefaultDir, handleExportPost, handleExportPublish };
