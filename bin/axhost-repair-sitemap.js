#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readMeta(absPath) {
  try {
    const content = await fs.readFile(path.join(absPath, '.axhost-meta.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function readSitemap(projectRoot) {
  const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
  try {
    const content = await fs.readFile(sitemapPath, 'utf-8');
    const jsonPart = content.replace(/^window\.__axhostSitemap\s*=\s*/, '').replace(/;\s*$/, '');
    return JSON.parse(jsonPart);
  } catch {
    return { name: 'Prototype', pages: [], components: [], flowcharts: [], _map: {} };
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

// 重建 _map
function rebuildFlatMap(sitemap) {
  const map = {};
  function walk(nodes, tab) {
    for (const n of nodes) {
      if (n.id) {
        const pathPrefix = tab === 'flowcharts' ? 'flowcharts' : tab.slice(0, -1);
        map[n.id] = { name: n.name, type: n.type, path: `${pathPrefix}/${n.path}` };
      }
      if (n.children) walk(n.children, tab);
    }
  }
  walk(sitemap.pages || [], 'pages');
  walk(sitemap.components || [], 'components');
  walk(sitemap.flowcharts || [], 'flowcharts');
  sitemap._map = map;
}

// 收集树中所有节点 ID
function collectTreeIds(nodes, ids = new Set()) {
  for (const n of nodes) {
    if (n.id) ids.add(n.id);
    if (n.children) collectTreeIds(n.children, ids);
  }
  return ids;
}

// 查找节点在树中的父节点 ID
function findParentId(nodes, targetId, parentId = null) {
  for (const n of nodes) {
    if (n.id === targetId) return parentId;
    if (n.children) {
      const found = findParentId(n.children, targetId, n.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

async function repairSitemap(projectRoot) {
  console.log('🔍 扫描项目目录...');

  const sitemap = await readSitemap(projectRoot);
  const treeIds = collectTreeIds([
    ...(sitemap.pages || []),
    ...(sitemap.components || []),
    ...(sitemap.flowcharts || [])
  ]);

  const orphanNodes = [];

  // 扫描各目录
  for (const tab of ['pages', 'components', 'flowcharts']) {
    const tabDir = path.join(projectRoot, 'prototype', tab);
    if (!await exists(tabDir)) continue;

    const entries = await fs.readdir(tabDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!/^[a-f0-9]{8}$/i.test(entry.name)) continue;

      const dirId = entry.name.toLowerCase();
      if (!treeIds.has(dirId)) {
        const meta = await readMeta(path.join(tabDir, entry.name));
        orphanNodes.push({
          id: dirId,
          name: meta.name || entry.name,
          tab,
          parentId: meta.parentId || null
        });
      }
    }
  }

  if (orphanNodes.length === 0) {
    console.log('✅ sitemap 结构完整，没有发现孤立节点');
    return;
  }

  console.log(`⚠️  发现 ${orphanNodes.length} 个孤立节点：`);
  for (const node of orphanNodes) {
    console.log(`   - ${node.name} (${node.id}) in ${node.tab}`);
  }

  console.log('\n🔧 开始修复...');

  // 重新挂载孤立节点
  for (const node of orphanNodes) {
    const tab = node.tab;
    if (!sitemap[tab]) sitemap[tab] = [];

    const newNode = {
      id: node.id,
      name: node.name,
      path: node.id,
      type: tab === 'pages' ? 'page' : tab === 'components' ? 'component' : 'flowchart',
      parentId: node.parentId,
      docs: []
    };

    // 尝试挂载到 parentId 下
    if (node.parentId) {
      let mounted = false;
      function insertUnderParent(nodes) {
        for (const n of nodes) {
          if (n.id === node.parentId) {
            if (!n.children) n.children = [];
            n.children.push(newNode);
            mounted = true;
            return true;
          }
          if (n.children && insertUnderParent(n.children)) return true;
        }
        return false;
      }
      insertUnderParent(sitemap[tab]);

      // 如果 parentId 不存在，挂到顶层
      if (!mounted) {
        console.log(`   ⚠️  父节点 ${node.parentId} 不存在，将 ${node.name} 挂到顶层`);
        sitemap[tab].push(newNode);
      }
    } else {
      sitemap[tab].push(newNode);
    }

    console.log(`   ✅ 已挂载: ${node.name} → ${tab}`);
  }

  // 重建 _map
  rebuildFlatMap(sitemap);

  // 写入
  await writeSitemap(projectRoot, sitemap);
  console.log('\n✅ sitemap 修复完成！');
}

module.exports = { repairSitemap };

if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd();
  repairSitemap(projectRoot).catch(err => {
    console.error('❌ 修复失败:', err.message);
    process.exit(1);
  });
}
