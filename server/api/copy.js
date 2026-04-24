const fs = require('fs/promises');
const path = require('path');
const { readSitemap, writeSitemap } = require('../lib/sitemap-io.js');
const { generateId } = require('../lib/ids.js');

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

async function collectExistingIds(projectRoot) {
  const ids = new Set();
  async function scan(absPath) {
    const entries = await fs.readdir(absPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (/^[a-f0-9]{8}$/i.test(name)) {
        ids.add(name.toLowerCase());
      }
    }
  }
  await scan(path.join(projectRoot, 'prototype/pages'));
  await scan(path.join(projectRoot, 'prototype/components'));
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

function findNodeContainer(nodes, nodeId) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === nodeId) return { arr: nodes, index: i };
    if (nodes[i].children) {
      const found = findNodeContainer(nodes[i].children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

function insertNodeAfterSitemap(sitemap, tab, sourceId, newNode) {
  const list = sitemap[tab] || [];
  const container = findNodeContainer(list, sourceId);
  if (!container) {
    list.push(newNode);
    sitemap[tab] = list;
  } else {
    container.arr.splice(container.index + 1, 0, newNode);
  }
  if (!sitemap._map) sitemap._map = {};
  sitemap._map[newNode.id] = {
    name: newNode.name,
    type: newNode.type,
    path: `${tab.slice(0, -1)}/${newNode.path}`
  };
}

async function copyItem(projectRoot, sourcePath, type) {
  const tab = type;
  const sourceDir = path.join(projectRoot, 'prototype', tab, sourcePath);
  if (!(await exists(sourceDir))) {
    throw new Error('Source not found');
  }

  const meta = await readMeta(sourceDir);
  const originalName = meta.name || '未命名';
  const newName = `${originalName}-副本`;

  const existingIds = await collectExistingIds(projectRoot);
  const newHash = generateId(newName, existingIds);
  const destDir = path.join(projectRoot, 'prototype', tab, newHash);

  await copyDir(sourceDir, destDir);

  const newMeta = { ...meta, name: newName };
  await writeMeta(destDir, newMeta);

  const sitemap = await readSitemap(projectRoot);
  const container = findNodeContainer(sitemap[tab] || [], sourcePath);
  if (!container) {
    throw new Error('Source node not found in sitemap');
  }

  const sourceNode = container.arr[container.index];
  const parentId = sourceNode.parentId || null;

  insertNodeAfterSitemap(sitemap, tab, sourcePath, {
    id: newHash,
    name: newName,
    path: newHash,
    type: sourceNode.type,
    parentId,
    docs: sourceNode.docs || []
  });

  await writeSitemap(projectRoot, sitemap);
  return { id: newHash, name: newName, path: newHash, type: tab };
}

async function handleCopy(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { sourcePath, type } = JSON.parse(body || '{}');
      if (!sourcePath || !type || !['pages', 'components'].includes(type)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Invalid parameters' }));
        return;
      }
      const result = await copyItem(projectRoot, sourcePath, type);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleCopy };
