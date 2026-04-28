const fs = require('fs/promises');
const path = require('path');

async function readSitemap(projectRoot) {
  const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
  try {
    const content = await fs.readFile(sitemapPath, 'utf-8');
    const jsonPart = content.replace(/^window\.__axhostSitemap\s*=\s*/, '').replace(/;\s*$/, '');
    return JSON.parse(jsonPart);
  } catch (e) {
    return { name: 'Prototype', pages: [], components: [], flowcharts: [] };
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

module.exports = { readSitemap, writeSitemap };
