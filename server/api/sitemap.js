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

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readMeta(absPath, fallback) {
  try {
    const content = await fs.readFile(path.join(absPath, '.axhost-meta.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return { name: fallback };
  }
}

async function readDocs(absPath) {
  const docsDir = path.join(absPath, 'docs');
  if (!await exists(docsDir)) return [];
  const entries = await fs.readdir(docsDir, { withFileTypes: true }).catch(() => []);
  return entries.filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name).sort();
}

async function regenerateSitemap(projectRoot) {
  const sitemap = await readSitemap(projectRoot);
  const existingName = sitemap.name || 'Prototype';

  // Scan physical directories
  const physicalIds = new Set();
  for (const tab of ['pages', 'components', 'flowcharts']) {
    const tabPath = path.join(projectRoot, 'prototype', tab);
    const entries = await fs.readdir(tabPath, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isDirectory() && /^[a-f0-9]{8}$/i.test(e.name)) {
        physicalIds.add(e.name.toLowerCase());
      }
    }
  }

  // Prune: remove page/component nodes whose physical dir is gone;
  // keep dir nodes if they have children (even without physical dir)
  function prune(nodes) {
    const result = [];
    for (const n of nodes) {
      if (n.children) {
        n.children = prune(n.children);
      }
      if (n.type === 'dir') {
        if (n.children && n.children.length > 0) {
          result.push(n);
        }
      } else if (physicalIds.has(n.id.toLowerCase())) {
        result.push(n);
      }
    }
    return result;
  }

  sitemap.pages = prune(sitemap.pages || []);
  sitemap.components = prune(sitemap.components || []);
  sitemap.flowcharts = prune(sitemap.flowcharts || []);

  // Discover new physical dirs not in sitemap
  for (const tab of ['pages', 'components', 'flowcharts']) {
    const tabPath = path.join(projectRoot, 'prototype', tab);
    const entries = await fs.readdir(tabPath, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (!e.isDirectory() || !/^[a-f0-9]{8}$/i.test(e.name)) continue;
      const id = e.name;

      function isInTree(nodes) {
        for (const n of nodes) {
          if (n.id === id) return true;
          if (n.children && isInTree(n.children)) return true;
        }
        return false;
      }

      if (!isInTree(sitemap[tab] || [])) {
        const meta = await readMeta(path.join(tabPath, id), id);
        const hasIndex = await exists(path.join(tabPath, id, 'index.html'));
        const nodeTypeMap = { pages: 'page', components: 'component', flowcharts: 'flowchart' };
        const nodeType = nodeTypeMap[tab] || 'page';
        const kind = meta.kind || (hasIndex ? nodeType : 'dir');
        const docs = kind !== 'dir' ? await readDocs(path.join(tabPath, id)) : [];
        const node = {
          id,
          name: meta.name || id,
          path: id,
          type: kind === 'dir' ? 'dir' : nodeType,
          parentId: meta.parentId || null,
          docs
        };

        if (!node.parentId) {
          sitemap[tab].push(node);
        } else {
          function insertChild(nodes, parentId, child) {
            for (const n of nodes) {
              if (n.id === parentId) {
                if (!n.children) n.children = [];
                n.children.push(child);
                return true;
              }
              if (n.children && insertChild(n.children, parentId, child)) return true;
            }
            return false;
          }
          if (!insertChild(sitemap[tab] || [], node.parentId, node)) {
            sitemap[tab].push(node);
          }
        }
      }
    }
  }

  // Rebuild _map
  const flatMap = {};
  function buildFlatMap(nodes, tab) {
    for (const n of nodes) {
      if (n.id) {
        flatMap[n.id] = {
          name: n.name,
          type: n.type,
          path: `${tab}/${n.path}`
        };
      }
      if (n.children) buildFlatMap(n.children, tab);
    }
  }
  buildFlatMap(sitemap.pages || [], 'pages');
  buildFlatMap(sitemap.components || [], 'components');
  buildFlatMap(sitemap.flowcharts || [], 'flowcharts');
  sitemap._map = flatMap;
  sitemap.name = existingName;
  sitemap.generatedBy = 'axhost-make';

  await writeSitemap(projectRoot, sitemap);
  return sitemap;
}

module.exports = { readSitemap, writeSitemap, regenerateSitemap };
