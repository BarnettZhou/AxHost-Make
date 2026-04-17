#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const { resolvePageOrComponent, isValidName } = require('./lib/helpers.js');

function parseArgs() {
  const args = process.argv.slice(2);
  let name = '';
  let to = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--to' || args[i] === '-t') {
      to = args[i + 1] || '';
      i++;
    } else if (!name && !args[i].startsWith('-')) {
      name = args[i];
    }
  }
  return { name, to };
}

async function main() {
  const { name, to } = parseArgs();
  if (!name || !to) {
    console.error('Usage: axhost-add-doc <name> --to <path-or-hash>');
    process.exit(1);
  }

  let rawName = name;
  if (rawName.endsWith('.md')) {
    rawName = rawName.slice(0, -3);
  }
  if (!isValidName(rawName)) {
    console.error('Error: 文档名称不能为空');
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const resolved = await resolvePageOrComponent(projectRoot, to);
  const docName = rawName + '.md';
  const docDir = path.join(projectRoot, 'prototype', resolved.tab, resolved.relPath, 'docs');
  const docPath = path.join(docDir, docName);

  try {
    await fs.access(docPath);
    console.error(`Error: 文档已存在: ${docName}`);
    process.exit(1);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  const content = `# ${rawName}\n\n---\n创建时间：${now}\n---\n\n## 需求说明\n\n这里填写需求说明\n`;

  await fs.mkdir(docDir, { recursive: true });
  await fs.writeFile(docPath, content, 'utf-8');
  console.log(`✅ 文档创建成功: prototype/${resolved.tab}/${resolved.relPath}/docs/${docName}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
