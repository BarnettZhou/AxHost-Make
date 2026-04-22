#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('../server/api/sitemap.js');

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

async function writeMeta(absPath, meta) {
  await fs.writeFile(
    path.join(absPath, '.axhost-meta.json'),
    JSON.stringify(meta, null, 2) + '\n',
    'utf-8'
  );
}

async function migrateProject(projectRoot) {
  console.log(`\n📁 开始迁移项目: ${path.basename(projectRoot)}`);

  for (const tab of ['pages', 'components']) {
    const tabPath = path.join(projectRoot, 'prototype', tab);
    if (!await exists(tabPath)) continue;

    // 1. 收集所有节点（递归）
    const nodes = []; // { id, absPath, parentId, depth }
    async function collect(absPath, parentId, depth) {
      const entries = await fs.readdir(absPath, { withFileTypes: true }).catch(() => []);
      const dirs = entries.filter(e => e.isDirectory());
      for (const dir of dirs) {
        const name = dir.name;
        if (name === 'resources' || name === 'docs' || name === 'sub-pages') continue;

        const childAbs = path.join(absPath, name);
        const meta = await readMeta(childAbs);
        const nodeId = name;

        nodes.push({ id: nodeId, absPath: childAbs, parentId, depth, meta });

        // 递归收集子目录
        await collect(childAbs, nodeId, depth + 1);
      }
    }
    await collect(tabPath, null, 0);

    if (nodes.length === 0) {
      console.log(`  [${tab}] 无内容，跳过`);
      continue;
    }

    // 检查是否有 hash 冲突（不同父目录下相同 hash）
    const idSet = new Set();
    const conflicts = [];
    for (const node of nodes) {
      if (idSet.has(node.id)) {
        conflicts.push(node.id);
      }
      idSet.add(node.id);
    }
    if (conflicts.length > 0) {
      console.log(`  ⚠️ [${tab}] 发现 hash 冲突: ${[...new Set(conflicts)].join(', ')}，需要手动处理`);
      continue;
    }

    // 2. 按深度降序排序，先移动深层节点
    const sorted = nodes.slice().sort((a, b) => b.depth - a.depth);

    // 3. 物理移动到根目录
    for (const node of sorted) {
      if (node.depth === 0) continue; // 已在根目录

      const targetAbs = path.join(tabPath, node.id);
      if (targetAbs === node.absPath) continue;

      // 如果目标已存在（理论上不应发生，因为有冲突检查），跳过
      if (await exists(targetAbs)) {
        console.log(`  ⚠️ 目标已存在，跳过移动: ${node.id}`);
        continue;
      }

      await fs.mkdir(path.dirname(targetAbs), { recursive: true });
      await fs.rename(node.absPath, targetAbs);

      // 更新 meta 中的 parentId
      const meta = await readMeta(targetAbs);
      meta.parentId = node.parentId;
      await writeMeta(targetAbs, meta);

      // 修复资源引用路径
      const indexPath = path.join(targetAbs, 'index.html');
      if (await exists(indexPath)) {
        try {
          let content = await fs.readFile(indexPath, 'utf-8');
          // 将多级 ../../resources/ 替换为 ../resources/
          content = content.replace(/\.\.\/\.\.\/resources\//g, '../resources/');
          content = content.replace(/\.\.\/\.\.\/\.\.\/resources\//g, '../resources/');
          await fs.writeFile(indexPath, content, 'utf-8');
        } catch {}
      }

      console.log(`  📦 ${node.id} → 根目录 (parentId: ${node.parentId})`);
    }

    // 4. 处理根级节点的 meta（确保没有旧的物理嵌套痕迹）
    for (const node of nodes) {
      if (node.depth === 0) {
        const targetAbs = path.join(tabPath, node.id);
        const meta = await readMeta(targetAbs);
        if (meta.parentId !== undefined) {
          delete meta.parentId;
          await writeMeta(targetAbs, meta);
        }
      }
    }

    // 5. 重建 .axhost-order.json（只在 tab 根目录保留）
    const rootIds = nodes.filter(n => n.depth === 0).map(n => n.id);
    const orderPath = path.join(tabPath, '.axhost-order.json');
    if (rootIds.length > 0) {
      await fs.writeFile(orderPath, JSON.stringify(rootIds, null, 2) + '\n', 'utf-8');
    } else {
      await fs.unlink(orderPath).catch(() => {});
    }

    // 6. 清理空的 sub-pages 目录和旧的嵌套目录
    async function cleanupEmptyDirs(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      const dirs = entries.filter(e => e.isDirectory());
      for (const d of dirs) {
        const childAbs = path.join(dir, d.name);
        if (d.name === 'resources' || d.name === 'docs') continue;
        await cleanupEmptyDirs(childAbs);
        // 尝试删除空目录
        try {
          const remaining = await fs.readdir(childAbs);
          if (remaining.length === 0) {
            await fs.rmdir(childAbs);
            console.log(`  🗑️  清理空目录: ${path.relative(tabPath, childAbs)}`);
          }
        } catch {}
      }
    }
    await cleanupEmptyDirs(tabPath);
  }

  // 7. 重新生成 sitemap
  await regenerateSitemap(projectRoot);
  console.log(`  ✅ 迁移完成: ${path.basename(projectRoot)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0];

  if (target) {
    // 迁移指定项目
    const projectRoot = path.resolve(target);
    await migrateProject(projectRoot);
  } else {
    // 迁移工作空间下所有项目
    const workspaceRoot = path.resolve(__dirname, '../../');
    const projectsDir = path.join(workspaceRoot, 'projects');
    if (!await exists(projectsDir)) {
      console.error('未找到 projects 目录');
      process.exit(1);
    }
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    const projectDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));
    for (const dir of projectDirs) {
      await migrateProject(path.join(projectsDir, dir.name));
    }
  }
}

main().catch(err => {
  console.error('迁移失败:', err.message);
  process.exit(1);
});
