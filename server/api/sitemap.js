const fs = require('fs/promises');
const path = require('path');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function scanDir(projectRoot, basePath, relPath) {
  const results = [];
  const dir = path.join(projectRoot, basePath, relPath);
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const childRel = path.posix.join(relPath, name);
    const hasIndex = await exists(path.join(dir, name, 'index.html'));
    if (hasIndex) {
      const type = basePath.includes('components') ? 'component' : 'page';
      results.push({ name, path: childRel, type });
    } else {
      const children = await scanDir(projectRoot, basePath, childRel);
      if (children.length > 0) {
        results.push({ name, path: childRel, type: 'dir', children });
      }
    }
  }
  return results;
}

async function regenerateSitemap(projectRoot) {
  const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
  let existingName = 'Prototype';
  try {
    const oldContent = await fs.readFile(sitemapPath, 'utf-8');
    const jsonPart = oldContent.replace(/^window\.__axhostSitemap\s*=\s*/, '').replace(/;\s*$/, '');
    const oldData = JSON.parse(jsonPart);
    existingName = oldData.name || existingName;
  } catch (e) {}

  const pages = await scanDir(projectRoot, 'prototype/pages', '');
  const components = await scanDir(projectRoot, 'prototype/components', '');
  const sitemap = { name: existingName, pages, components };
  await fs.writeFile(
    sitemapPath,
    `window.__axhostSitemap = ${JSON.stringify(sitemap, null, 2)};\n`,
    'utf-8'
  );
  return sitemap;
}

module.exports = { regenerateSitemap };
