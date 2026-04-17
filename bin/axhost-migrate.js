#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const { generateId } = require('../server/lib/ids.js');
const { regenerateSitemap } = require('../server/api/sitemap.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function migrate(projectRoot) {
  const idsPath = path.join(projectRoot, 'prototype', '.axhost-ids.json');
  let ids = {};
  try {
    ids = JSON.parse(await fs.readFile(idsPath, 'utf-8'));
  } catch {
    console.log('✅ 未找到 .axhost-ids.json，数据可能已是最新格式');
    return;
  }

  console.log('🔧 开始迁移数据到 hash 目录格式...\n');

  // 1. 收集所有需要迁移的节点
  const migrations = []; // { oldAbs, newAbs, name, hash, depth, parentAbs }

  async function collect(oldAbs, relPath, tab, depth) {
    const entries = await fs.readdir(oldAbs, { withFileTypes: true }).catch(() => []);
    const dirs = entries.filter(e => e.isDirectory());

    for (const dir of dirs) {
      const name = dir.name;
      // 跳过资源目录、系统标记目录 sub-pages
      if (name === 'resources' || name === 'docs' || name === 'sub-pages') continue;

      const childOldAbs = path.join(oldAbs, name);
      const childRel = relPath ? `${relPath}/${name}` : name;
      const key = `${tab}/${childRel}`;

      // 检查是否已经是新格式（有 .axhost-meta.json）
      const hasMeta = await exists(path.join(childOldAbs, '.axhost-meta.json'));
      if (hasMeta) {
        // 已经是新格式，只递归扫描子目录
        await collect(childOldAbs, childRel, tab, depth + 1);
        continue;
      }

      // 从旧 ids 获取 hash，或生成新的
      const hash = ids[key] || generateId(key);
      const childNewAbs = path.join(oldAbs, hash);

      migrations.push({
        oldAbs: childOldAbs,
        newAbs: childNewAbs,
        name,
        hash,
        depth,
        parentAbs: oldAbs
      });

      // 递归扫描子目录（包括 sub-pages 下的内容）
      await collect(childOldAbs, childRel, tab, depth + 1);
    }
  }

  await collect(path.join(projectRoot, 'prototype/pages'), '', 'pages', 0);
  await collect(path.join(projectRoot, 'prototype/components'), '', 'components', 0);

  if (migrations.length === 0) {
    console.log('✅ 所有数据已是最新格式，无需迁移');
    // 清理旧的 ids 文件
    await fs.unlink(idsPath).catch(() => {});
    return;
  }

  console.log(`发现 ${migrations.length} 个需要迁移的节点\n`);

  // 2. 按深度降序排序（先迁移深层节点）
  migrations.sort((a, b) => b.depth - a.depth);

  // 建立快速查找表：parentAbs + name → migration
  const migrationMap = new Map();
  for (const m of migrations) {
    migrationMap.set(`${m.parentAbs}|${m.name}`, m);
  }

  // 3. 执行迁移
  for (const m of migrations) {
    const isSamePath = m.oldAbs === m.newAbs;

    if (!isSamePath) {
      // 复制旧目录到新 hash 目录
      await fs.cp(m.oldAbs, m.newAbs, { recursive: true });
    }

    // 写入 .axhost-meta.json
    await fs.writeFile(
      path.join(m.newAbs, '.axhost-meta.json'),
      JSON.stringify({ name: m.name }, null, 2) + '\n',
      'utf-8'
    );

    // 更新新目录下的 .axhost-order.json（替换子目录旧名为 hash，跳过 sub-pages）
    const newOrderPath = path.join(m.newAbs, '.axhost-order.json');
    try {
      const order = JSON.parse(await fs.readFile(newOrderPath, 'utf-8'));
      const updated = order.map(item => {
        if (item === 'sub-pages') return item;
        const childKey = `${m.oldAbs}|${item}`;
        const childM = migrationMap.get(childKey);
        return childM ? childM.hash : item;
      });
      await fs.writeFile(newOrderPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
    } catch {}

    if (!isSamePath) {
      // 删除旧目录
      await fs.rm(m.oldAbs, { recursive: true, force: true });
    }

    // 更新父目录的 .axhost-order.json（替换当前节点旧名为 hash）
    const parentOrderPath = path.join(m.parentAbs, '.axhost-order.json');
    try {
      const order = JSON.parse(await fs.readFile(parentOrderPath, 'utf-8'));
      const idx = order.indexOf(m.name);
      if (idx !== -1) {
        order[idx] = m.hash;
        await fs.writeFile(parentOrderPath, JSON.stringify(order, null, 2) + '\n', 'utf-8');
      }
    } catch {}

    console.log(`  ${m.name} → ${m.hash}`);
  }

  // 4. 删除旧的 .axhost-ids.json
  await fs.unlink(idsPath).catch(() => {});

  // 5. 重新生成 sitemap 和映射文件
  await regenerateSitemap(projectRoot);

  console.log(`\n✅ 迁移完成，共迁移 ${migrations.length} 个节点`);
  console.log('旧的 .axhost-ids.json 已删除');
  console.log('新的 .axhost-map.json 和 sitemap.js 已生成');
}

module.exports = { migrate };

// 如果直接运行此脚本
if (require.main === module) {
  const projectRoot = process.cwd();
  migrate(projectRoot).catch(err => {
    console.error('迁移失败:', err.message);
    process.exit(1);
  });
}
