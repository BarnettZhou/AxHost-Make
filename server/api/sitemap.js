const fs = require('fs/promises');
const path = require('path');
const { ensureIdsForTree, injectIds } = require('../lib/ids.js');
const { scanNode } = require('./scan.js');

async function regenerateSitemap(projectRoot) {
  const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
  let existingName = 'Prototype';
  try {
    const oldContent = await fs.readFile(sitemapPath, 'utf-8');
    const jsonPart = oldContent.replace(/^window\.__axhostSitemap\s*=\s*/, '').replace(/;\s*$/, '');
    const oldData = JSON.parse(jsonPart);
    existingName = oldData.name || existingName;
  } catch (e) {}

  const pages = await scanNode(path.join(projectRoot, 'prototype/pages'), '', 'page');
  const components = await scanNode(path.join(projectRoot, 'prototype/components'), '', 'component');

  const pageIds = await ensureIdsForTree(projectRoot, pages, 'pages');
  const compIds = await ensureIdsForTree(projectRoot, components, 'components');
  const ids = { ...pageIds, ...compIds };
  injectIds(pages, ids, 'pages');
  injectIds(components, ids, 'components');

  const sitemap = { name: existingName, pages, components, generatedBy: 'axhost-make' };
  await fs.writeFile(
    sitemapPath,
    `window.__axhostSitemap = ${JSON.stringify(sitemap, null, 2)};\n`,
    'utf-8'
  );
  return sitemap;
}

module.exports = { regenerateSitemap };
