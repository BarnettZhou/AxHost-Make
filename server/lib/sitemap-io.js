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

async function refreshSitemapDocs(projectRoot, filePathInput) {
  const match = filePathInput.match(/^prototype\/(pages|components|flowcharts)\/(.+)\/docs\/.+\.md$/);
  if (!match) return;
  const [, tab, nodePath] = match;

  const sitemap = await readSitemap(projectRoot);
  const { ensureOrder } = require('./order.js');

  async function updateNode(nodes) {
    for (const n of nodes) {
      if ((n.type === 'page' || n.type === 'component' || n.type === 'flowchart') && n.path === nodePath) {
        const absPath = path.join(projectRoot, 'prototype', tab, n.path, 'docs');
        try {
          const entries = await fs.readdir(absPath, { withFileTypes: true });
          const files = entries.filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name);
          n.docs = await ensureOrder(absPath, files);
        } catch { n.docs = []; }
        return true;
      }
      if (n.children && await updateNode(n.children)) return true;
    }
    return false;
  }

  await updateNode(sitemap[tab] || []);
  await writeSitemap(projectRoot, sitemap);
}

module.exports = { readSitemap, writeSitemap, addNodeToSitemap, refreshSitemapDocs };
