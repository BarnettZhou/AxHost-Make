const fs = require('fs/promises');
const path = require('path');
const { sortTree } = require('../utils/sort-tree.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function scanSubPages(projectRoot, basePath, relPath, nodeType) {
  const results = [];
  const subPagesDir = path.join(projectRoot, basePath, relPath, 'sub-pages');
  const entries = await fs.readdir(subPagesDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const childAbs = path.join(subPagesDir, name);
    const hasIndex = await exists(path.join(childAbs, 'index.html'));
    if (!hasIndex) continue;

    const childRel = path.posix.join(relPath, 'sub-pages', name);
    const docsDir = path.join(childAbs, 'docs');
    const hasDocsDir = await exists(docsDir);
    let docs = [];
    if (hasDocsDir) {
      const docsEntries = await fs.readdir(docsDir, { withFileTypes: true }).catch(() => []);
      docs = docsEntries.filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name).sort();
    }
    const node = { name, path: childRel, type: nodeType, docs };
    const nested = await scanSubPages(projectRoot, basePath, childRel, nodeType);
    if (nested.length > 0) {
      node.children = nested;
    }
    results.push(node);
  }
  return results;
}

async function scanDir(projectRoot, basePath, relPath, nodeType) {
  const results = [];
  const dir = path.join(projectRoot, basePath, relPath);
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const childRel = path.posix.join(relPath, name);
    const hasIndex = await exists(path.join(dir, name, 'index.html'));
    if (hasIndex) {
      const docsDir = path.join(dir, name, 'docs');
      const hasDocsDir = await exists(docsDir);
      let docs = [];
      if (hasDocsDir) {
        const docsEntries = await fs.readdir(docsDir, { withFileTypes: true }).catch(() => []);
        docs = docsEntries.filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name).sort();
      }
      const node = { name, path: childRel, type: nodeType, docs };
      const children = await scanSubPages(projectRoot, basePath, childRel, nodeType);
      if (children.length > 0) {
        node.children = children;
      }
      results.push(node);
    } else {
      const children = await scanDir(projectRoot, basePath, childRel, nodeType);
      results.push({ name, path: childRel, type: 'dir', children });
    }
  }
  return results;
}

async function regenerateSitemap(projectRoot) {
  const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
  let existing = { name: 'Prototype', orderMap: {} };
  try {
    const oldContent = await fs.readFile(sitemapPath, 'utf-8');
    const jsonPart = oldContent.replace(/^window\.__axhostSitemap\s*=\s*/, '').replace(/;\s*$/, '');
    existing = JSON.parse(jsonPart);
  } catch (e) {}

  const pages = await scanDir(projectRoot, 'prototype/pages', '', 'page');
  const components = await scanDir(projectRoot, 'prototype/components', '', 'component');

  sortTree(pages, 'pages', '', existing.orderMap);
  sortTree(components, 'components', '', existing.orderMap);

  const sitemap = {
    name: existing.name || 'Prototype',
    orderMap: existing.orderMap || {},
    pages,
    components,
    generatedBy: 'axhost-make'
  };
  await fs.writeFile(
    sitemapPath,
    `window.__axhostSitemap = ${JSON.stringify(sitemap, null, 2)};\n`,
    'utf-8'
  );
  return sitemap;
}

module.exports = { regenerateSitemap };
