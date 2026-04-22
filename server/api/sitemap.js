const fs = require('fs/promises');
const path = require('path');
const { scanFlat } = require('./scan.js');

async function regenerateSitemap(projectRoot) {
  const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
  const mapPath = path.join(projectRoot, 'prototype', '.axhost-map.json');

  let existingName = 'Prototype';
  try {
    const oldContent = await fs.readFile(sitemapPath, 'utf-8');
    const jsonPart = oldContent.replace(/^window\.__axhostSitemap\s*=\s*/, '').replace(/;\s*$/, '');
    const oldData = JSON.parse(jsonPart);
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

  await fs.writeFile(
    sitemapPath,
    `window.__axhostSitemap = ${JSON.stringify(sitemap, null, 2)};\n`,
    'utf-8'
  );

  await fs.writeFile(
    mapPath,
    JSON.stringify(flatMap, null, 2) + '\n',
    'utf-8'
  );

  return sitemap;
}

module.exports = { regenerateSitemap };
