#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const { readMap } = require('./lib/helpers.js');
const { createItem } = require('../server/api/create.js');
const { regenerateSitemap } = require('../server/api/sitemap.js');

function printHelp() {
  console.log(`
Axhost-Make Query CLI

Usage:
  axhost-make list
  axhost-make info <hash>
  axhost-make search <keyword>
  axhost-make path <hash> [doc-name]
  axhost-make copy <hash> <new-name> [--parent <path-or-hash>]

Commands:
  list      列出所有页面和组件（树形结构）
  info      通过 hash 获取详细信息
  search    模糊搜索名称
  path      获取文件绝对路径（可指定文档名）
  copy      复制一个页面/组件作为新页面/组件
`);
}

async function cmdList(projectRoot) {
  const map = await readMap(projectRoot);
  const entries = Object.entries(map);

  const pages = entries.filter(([, v]) => v.type === 'page');
  const components = entries.filter(([, v]) => v.type === 'component');

  if (pages.length > 0) {
    console.log('Pages:');
    for (const [id, info] of pages) {
      console.log(`  ${id}  ${info.name}  (${info.path})`);
    }
  }
  if (components.length > 0) {
    console.log('Components:');
    for (const [id, info] of components) {
      console.log(`  ${id}  ${info.name}  (${info.path})`);
    }
  }
  if (pages.length === 0 && components.length === 0) {
    console.log('暂无页面或组件。');
  }
}

async function cmdInfo(projectRoot, hash) {
  const map = await readMap(projectRoot);
  const info = map[hash.toLowerCase()];
  if (!info) {
    console.error(`未找到 hash: ${hash}`);
    process.exit(1);
  }
  console.log(`ID:     ${hash}`);
  console.log(`Name:   ${info.name}`);
  console.log(`Type:   ${info.type}`);
  console.log(`Path:   ${info.path}`);

  // 尝试读取 docs
  const absDir = path.join(projectRoot, 'prototype', info.path);
  const docsDir = path.join(absDir, 'docs');
  try {
    const entries = await fs.readdir(docsDir, { withFileTypes: true });
    const docs = entries.filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name);
    if (docs.length > 0) {
      console.log(`Docs:   ${docs.join(', ')}`);
    }
  } catch {}
}

async function cmdSearch(projectRoot, keyword) {
  const map = await readMap(projectRoot);
  const results = [];
  for (const [id, info] of Object.entries(map)) {
    if (info.name.includes(keyword)) {
      results.push({ id, ...info });
    }
  }
  if (results.length === 0) {
    console.log('未找到匹配结果。');
    return;
  }
  for (const r of results) {
    console.log(`${r.id}  ${r.name}  (${r.path})`);
  }
}

async function cmdPath(projectRoot, hash, docName) {
  const map = await readMap(projectRoot);
  const info = map[hash.toLowerCase()];
  if (!info) {
    console.error(`未找到 hash: ${hash}`);
    process.exit(1);
  }
  const absDir = path.join(projectRoot, 'prototype', info.path);
  if (docName) {
    const docPath = path.join(absDir, 'docs', docName.endsWith('.md') ? docName : docName + '.md');
    console.log(docPath);
  } else {
    console.log(path.join(absDir, 'index.html'));
  }
}

async function cmdCopy(projectRoot, hash, newName, parentInput) {
  const map = await readMap(projectRoot);
  const info = map[hash.toLowerCase()];
  if (!info) {
    console.error(`未找到 hash: ${hash}`);
    process.exit(1);
  }

  const { resolveParent } = require('./lib/helpers.js');
  const tab = info.type === 'component' ? 'components' : 'pages';

  let parentPath;
  if (parentInput) {
    parentPath = await resolveParent(projectRoot, parentInput, tab);
  } else {
    // 默认复制到同级目录
    const parts = info.path.split('/');
    parts.pop(); // 去掉 hash 本身
    parentPath = `prototype/${parts.join('/')}`;
  }

  // 先创建新目录结构（使用新 hash）
  const result = await createItem(projectRoot, parentPath, newName, info.type);

  // 复制源目录内容（覆盖模板文件）
  const srcDir = path.join(projectRoot, 'prototype', info.path);
  const destDir = path.join(projectRoot, 'prototype', result.path);

  async function copyDir(src, dest) {
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.name === '.axhost-meta.json') continue; // 保留目标 meta
      if (entry.name === '.axhost-order.json') continue; // 保留目标 order
      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  await copyDir(srcDir, destDir);

  // 更新 meta 中的名称（确保正确）
  await fs.writeFile(
    path.join(destDir, '.axhost-meta.json'),
    JSON.stringify({ name: newName }, null, 2) + '\n',
    'utf-8'
  );

  await regenerateSitemap(projectRoot);
  console.log(`✅ 复制成功: ${result.id} (${newName})`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const projectRoot = process.cwd();

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  if (command === 'list') {
    await cmdList(projectRoot);
    return;
  }

  if (command === 'info') {
    const hash = args[1];
    if (!hash) { console.error('Usage: axhost-make info <hash>'); process.exit(1); }
    await cmdInfo(projectRoot, hash);
    return;
  }

  if (command === 'search') {
    const keyword = args[1];
    if (!keyword) { console.error('Usage: axhost-make search <keyword>'); process.exit(1); }
    await cmdSearch(projectRoot, keyword);
    return;
  }

  if (command === 'path') {
    const hash = args[1];
    const docName = args[2];
    if (!hash) { console.error('Usage: axhost-make path <hash> [doc-name]'); process.exit(1); }
    await cmdPath(projectRoot, hash, docName);
    return;
  }

  if (command === 'copy') {
    const hash = args[1];
    const newName = args[2];
    if (!hash || !newName) { console.error('Usage: axhost-make copy <hash> <new-name> [--parent <path-or-hash>]'); process.exit(1); }
    let parentInput = '';
    const pIdx = args.indexOf('--parent');
    if (pIdx !== -1 && args[pIdx + 1]) parentInput = args[pIdx + 1];
    await cmdCopy(projectRoot, hash, newName, parentInput);
    return;
  }

  console.error(`Unknown query command: ${command}`);
  printHelp();
  process.exit(1);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
