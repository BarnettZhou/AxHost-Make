const fs = require('fs/promises');
const path = require('path');
const { sortTree } = require('../utils/sort-tree.js');

async function scanSubPages(subPagesDir, relativePath, nodeType) {
  const children = [];
  const entries = await fs.readdir(subPagesDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const childAbs = path.join(subPagesDir, name);
    const hasIndex = await fs.access(path.join(childAbs, 'index.html'))
      .then(() => true)
      .catch(() => false);
    if (!hasIndex) continue;

    const childRel = path.posix.join(relativePath, 'sub-pages', name);
    const hasDocsDir = await fs.access(path.join(childAbs, 'docs'))
      .then(() => true)
      .catch(() => false);
    let hasDocs = false;
    if (hasDocsDir) {
      const docsEntries = await fs.readdir(path.join(childAbs, 'docs'), { withFileTypes: true })
        .catch(() => []);
      hasDocs = docsEntries.some(e => e.isFile() && e.name.endsWith('.md'));
    }

    const node = { name, path: childRel, type: nodeType, hasDocs };
    const nestedSubPages = path.join(childAbs, 'sub-pages');
    const nested = await scanSubPages(nestedSubPages, childRel, nodeType);
    if (nested.length > 0) {
      node.children = nested;
    }
    children.push(node);
  }
  return children;
}

async function scanDir(dirPath, relativePath, nodeType) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const children = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const childRel = path.posix.join(relativePath, name);
    const childAbs = path.join(dirPath, name);

    const hasIndex = await fs.access(path.join(childAbs, 'index.html'))
      .then(() => true)
      .catch(() => false);

    if (hasIndex) {
      const hasDocsDir = await fs.access(path.join(childAbs, 'docs'))
        .then(() => true)
        .catch(() => false);
      let hasDocs = false;
      if (hasDocsDir) {
        const docsEntries = await fs.readdir(path.join(childAbs, 'docs'), { withFileTypes: true })
          .catch(() => []);
        hasDocs = docsEntries.some(e => e.isFile() && e.name.endsWith('.md'));
      }
      const node = { name, path: childRel, type: nodeType, hasDocs };
      const subPagesDir = path.join(childAbs, 'sub-pages');
      const subChildren = await scanSubPages(subPagesDir, childRel, nodeType);
      if (subChildren.length > 0) {
        node.children = subChildren;
      }
      children.push(node);
    } else {
      const subChildren = await scanDir(childAbs, childRel, nodeType);
      children.push({ name, path: childRel, type: 'dir', children: subChildren });
    }
  }

  return children;
}

async function handleScan(req, res, projectRoot) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const type = url.searchParams.get('type');
  if (!type || (type !== 'pages' && type !== 'components')) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 400, message: 'Invalid or missing type param' }));
    return;
  }

  const targetDir = path.join(projectRoot, 'prototype', type);
  const nodeType = type === 'components' ? 'component' : 'page';
  try {
    const tree = await scanDir(targetDir, '', nodeType);

    let orderMap = {};
    try {
      const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
      const content = await fs.readFile(sitemapPath, 'utf-8');
      const json = JSON.parse(content.replace(/^window\.__axhostSitemap\s*=\s*/, '').replace(/;\s*$/, ''));
      orderMap = json.orderMap || {};
    } catch (e) {}

    sortTree(tree, type, '', orderMap);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: tree }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
}

module.exports = { handleScan };
