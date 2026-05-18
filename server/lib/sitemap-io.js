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

function addNodeToSitemap(sitemap, tab, parentId, node) {
  const list = sitemap[tab] || [];
  if (!parentId) {
    list.push(node);
    sitemap[tab] = list;
  } else {
    function findAndInsert(nodes) {
      for (const n of nodes) {
        if (n.id === parentId) {
          if (!n.children) n.children = [];
          n.children.push(node);
          return true;
        }
        if (n.children && findAndInsert(n.children)) return true;
      }
      return false;
    }
    findAndInsert(list);
  }
  if (!sitemap._map) sitemap._map = {};
  sitemap._map[node.id] = {
    name: node.name,
    type: node.type,
    path: `${tab.slice(0, -1)}/${node.path}`
  };
}

module.exports = { readSitemap, writeSitemap, addNodeToSitemap };
