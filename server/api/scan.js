const fs = require('fs/promises');
const path = require('path');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readMeta(absPath, fallback) {
  try {
    const content = await fs.readFile(path.join(absPath, '.axhost-meta.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return { name: fallback };
  }
}

async function readDocs(absPath) {
  const docsDir = path.join(absPath, 'docs');
  if (!await exists(docsDir)) return [];
  const entries = await fs.readdir(docsDir, { withFileTypes: true }).catch(() => []);
  return entries.filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name).sort();
}

async function scanFlat(tabPath, nodeType) {
  const entries = await fs.readdir(tabPath, { withFileTypes: true }).catch(() => []);
  const dirNames = entries.filter(e => e.isDirectory()).map(e => e.name);

  const nodes = [];
  for (const dirName of dirNames) {
    const childAbs = path.join(tabPath, dirName);
    const meta = await readMeta(childAbs, dirName);
    const hasIndex = await exists(path.join(childAbs, 'index.html'));
    const kind = meta.kind || (hasIndex ? nodeType : 'dir');

    nodes.push({
      id: dirName,
      name: meta.name || dirName,
      path: dirName,
      type: kind === 'dir' ? 'dir' : nodeType,
      kind,
      parentId: meta.parentId || null,
      docs: kind !== 'dir' ? await readDocs(childAbs) : []
    });
  }

  // Assemble tree by parentId
  const nodeMap = {};
  for (const node of nodes) {
    nodeMap[node.id] = { ...node, children: undefined };
  }

  const rootNodes = [];
  for (const node of nodes) {
    const n = nodeMap[node.id];
    if (node.parentId && nodeMap[node.parentId]) {
      if (!nodeMap[node.parentId].children) nodeMap[node.parentId].children = [];
      nodeMap[node.parentId].children.push(n);
    } else {
      rootNodes.push(n);
    }
  }

  return rootNodes;
}

async function handleScan(req, res, projectRoot) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = url.searchParams.get('type');
    const pages = await scanFlat(path.join(projectRoot, 'prototype/pages'), 'page');
    const components = await scanFlat(path.join(projectRoot, 'prototype/components'), 'component');

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    if (type === 'pages') {
      res.end(JSON.stringify({ code: 0, data: pages }));
    } else if (type === 'components') {
      res.end(JSON.stringify({ code: 0, data: components }));
    } else {
      res.end(JSON.stringify({ code: 0, data: { pages, components } }));
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
}

module.exports = { handleScan, scanFlat };
