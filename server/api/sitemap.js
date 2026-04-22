const fs = require('fs/promises');
const path = require('path');
const { scanFlat } = require('./scan.js');

async function readSitemap(projectRoot) {
  const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
  try {
    const content = await fs.readFile(sitemapPath, 'utf-8');
    const jsonPart = content.replace(/^window\.__axhostSitemap\s*=\s*/, '').replace(/;\s*$/, '');
    return JSON.parse(jsonPart);
  } catch (e) {
    return { name: 'Prototype', pages: [], components: [] };
  }
}

async function writeSitemap(projectRoot, data) {
  const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
  await fs.writeFile(
    sitemapPath,
    `window.__axhostSitemap = ${JSON.stringify(data, null, 2)};\n`,
    'utf-8'
  );
}

async function regenerateSitemap(projectRoot) {
  let existingName = 'Prototype';
  try {
    const oldData = await readSitemap(projectRoot);
    existingName = oldData.name || existingName;
  } catch (e) {}

  const pages = await scanFlat(path.join(projectRoot, 'prototype/pages'), 'page');
  const components = await scanFlat(path.join(projectRoot, 'prototype/components'), 'component');

  // Build flat mapping (for Agent / CLI queries)
  const flatMap = {};
  function buildFlatMap(nodes, tab) {
    for (const node of nodes) {
      if (node.id) {
        flatMap[node.id] = {
          name: node.name,
          type: node.type,
          path: `${tab}/${node.path}`
        };
      }
      if (node.children) buildFlatMap(node.children, tab);
    }
  }
  buildFlatMap(pages, 'pages');
  buildFlatMap(components, 'components');

  const sitemap = {
    name: existingName,
    pages,
    components,
    _map: flatMap,
    generatedBy: 'axhost-make'
  };

  await writeSitemap(projectRoot, sitemap);
  return sitemap;
}

module.exports = { readSitemap, writeSitemap, regenerateSitemap };


module.exports = { readSitemap, writeSitemap, regenerateSitemap };
