const fs = require('fs/promises');
const path = require('path');
const { ensureOrder } = require('../lib/order.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readMetaName(absPath, fallback) {
  try {
    const content = await fs.readFile(path.join(absPath, '.axhost-meta.json'), 'utf-8');
    const meta = JSON.parse(content);
    return meta.name || fallback;
  } catch {
    return fallback;
  }
}

async function scanNode(absPath, relPath, nodeType) {
  const entries = await fs.readdir(absPath, { withFileTypes: true }).catch(() => []);
  const names = entries
    .filter(e => e.isDirectory())
    .map(e => e.name);

  const order = await ensureOrder(absPath, names);

  const results = [];
  for (const dirName of order) {
    if (!names.includes(dirName)) continue;

    const childAbs = path.join(absPath, dirName);
    const childRel = relPath ? path.posix.join(relPath, dirName) : dirName;

    const displayName = await readMetaName(childAbs, dirName);
    const hasIndex = await exists(path.join(childAbs, 'index.html'));

    if (hasIndex) {
      const docsDir = path.join(childAbs, 'docs');
      let docs = [];
      if (await exists(docsDir)) {
        const docsEntries = await fs.readdir(docsDir, { withFileTypes: true }).catch(() => []);
        docs = docsEntries.filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name).sort();
      }
      const node = { id: dirName, name: displayName, path: childRel, type: nodeType, docs };
      const subPagesAbs = path.join(childAbs, 'sub-pages');
      if (await exists(subPagesAbs)) {
        const children = await scanNode(subPagesAbs, path.posix.join(childRel, 'sub-pages'), nodeType);
        if (children.length > 0) node.children = children;
      }
      results.push(node);
    } else {
      const children = await scanNode(childAbs, childRel, nodeType);
      results.push({ id: dirName, name: displayName, path: childRel, type: 'dir', children });
    }
  }
  return results;
}

async function handleScan(req, res, projectRoot) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = url.searchParams.get('type');
    const pages = await scanNode(path.join(projectRoot, 'prototype/pages'), '', 'page');
    const components = await scanNode(path.join(projectRoot, 'prototype/components'), '', 'component');

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

module.exports = { handleScan, scanNode };
