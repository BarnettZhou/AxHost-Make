const fs = require('fs/promises');
const path = require('path');
const { ensureIdsForTree, injectIds } = require('../lib/ids.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function scanSubPages(subPagesDir, relativePath, nodeType) {
  const results = [];
  const entries = await fs.readdir(subPagesDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const childRel = path.posix.join(relativePath, 'sub-pages', name);
    const hasIndex = await exists(path.join(subPagesDir, name, 'index.html'));
    if (!hasIndex) continue;
    const node = { name, path: childRel, type: nodeType };
    const nested = await scanSubPages(path.join(subPagesDir, name), childRel, nodeType);
    if (nested.length > 0) node.children = nested;
    results.push(node);
  }
  return results;
}

async function scanDir(dirPath, relativePath, nodeType) {
  const results = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const childRel = path.posix.join(relativePath, name);
    const hasIndex = await exists(path.join(dirPath, name, 'index.html'));
    if (hasIndex) {
      const node = { name, path: childRel, type: nodeType };
      const nested = await scanSubPages(path.join(dirPath, name, 'sub-pages'), childRel, nodeType);
      if (nested.length > 0) node.children = nested;
      results.push(node);
    } else {
      const children = await scanDir(path.join(dirPath, name), childRel, nodeType);
      results.push({ name, path: childRel, type: 'dir', children });
    }
  }
  return results;
}

function sortNodes(nodes, orderMap, type, prefix = '') {
  const key = prefix ? `${type}/${prefix}` : type;
  const map = orderMap[key] || {};
  nodes.sort((a, b) => {
    const ia = map[a.name] ?? Infinity;
    const ib = map[b.name] ?? Infinity;
    return ia - ib;
  });
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      const childPrefix = prefix ? `${prefix}/${node.name}` : node.name;
      sortNodes(node.children, orderMap, type, childPrefix);
    }
  }
}

async function handleScan(req, res, projectRoot) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = url.searchParams.get('type');
    const pages = await scanDir(path.join(projectRoot, 'prototype/pages'), '', 'page');
    const components = await scanDir(path.join(projectRoot, 'prototype/components'), '', 'component');

    // 读取 orderMap 并排序
    const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
    let orderMap = {};
    try {
      const content = await fs.readFile(sitemapPath, 'utf-8');
      const json = JSON.parse(content.replace(/^window\.__axhostSitemap\s*=\s*/, '').replace(/;\s*$/, ''));
      orderMap = json.orderMap || {};
    } catch (e) {}
    sortNodes(pages, orderMap, 'pages');
    sortNodes(components, orderMap, 'components');

    const pageIds = await ensureIdsForTree(projectRoot, pages, 'pages');
    const compIds = await ensureIdsForTree(projectRoot, components, 'components');
    const ids = { ...pageIds, ...compIds };
    injectIds(pages, ids, 'pages');
    injectIds(components, ids, 'components');
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

module.exports = { handleScan };
