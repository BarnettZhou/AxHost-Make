const fs = require('fs/promises');
const path = require('path');

function findChildren(nodes, parentPath) {
  if (!parentPath) return nodes;
  const parts = parentPath.split('/').filter(p => p !== 'sub-pages');
  let current = nodes;
  for (const part of parts) {
    const node = current.find(n => n.name === part);
    if (!node || !node.children) return null;
    current = node.children;
  }
  return current;
}

function rebuildOrderMap(nodes, type, prefix, orderMap) {
  const key = prefix ? `${type}/${prefix}` : type;
  orderMap[key] = {};
  nodes.forEach((node, idx) => {
    orderMap[key][node.name] = idx + 1;
    if (node.children && node.children.length > 0) {
      rebuildOrderMap(node.children, type, prefix ? `${prefix}/${node.name}` : node.name, orderMap);
    }
  });
}

async function handleReorder(req, res, projectRoot) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const data = JSON.parse(body || '{}');
  const { type, parentPath, oldIndex, newIndex } = data;

  if (!type || (type !== 'pages' && type !== 'components') || typeof oldIndex !== 'number' || typeof newIndex !== 'number') {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 400, message: 'Invalid params' }));
    return;
  }

  const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
  let sitemap = { name: 'Prototype', pages: [], components: [], orderMap: {} };
  try {
    const content = await fs.readFile(sitemapPath, 'utf-8');
    const json = JSON.parse(content.replace(/^window\.__axhostSitemap\s*=\s*/, '').replace(/;\s*$/, ''));
    sitemap = json;
  } catch (e) {}

  if (!sitemap.orderMap) sitemap.orderMap = {};
  const arr = findChildren(sitemap[type], parentPath);
  if (!arr || oldIndex < 0 || oldIndex >= arr.length || newIndex < 0 || newIndex >= arr.length) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 400, message: 'Invalid index' }));
    return;
  }

  const [moved] = arr.splice(oldIndex, 1);
  arr.splice(newIndex, 0, moved);

  rebuildOrderMap(sitemap[type], type, '', sitemap.orderMap);

  await fs.writeFile(
    sitemapPath,
    `window.__axhostSitemap = ${JSON.stringify(sitemap, null, 2)};\n`,
    'utf-8'
  );

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ code: 0 }));
}

module.exports = { handleReorder };
