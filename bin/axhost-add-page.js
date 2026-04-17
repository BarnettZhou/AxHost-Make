#!/usr/bin/env node
const path = require('path');
const { createItem } = require('../server/api/create.js');
const { assignId } = require('../server/lib/ids.js');
const { regenerateSitemap } = require('../server/api/sitemap.js');
const { isValidName, resolveParent } = require('./lib/helpers.js');

function parseArgs() {
  const args = process.argv.slice(2);
  let name = '';
  let parent = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--parent' || args[i] === '-p') {
      parent = args[i + 1] || '';
      i++;
    } else if (!name && !args[i].startsWith('-')) {
      name = args[i];
    }
  }
  return { name, parent };
}

async function main() {
  const { name, parent } = parseArgs();
  if (!name) {
    console.error('Usage: axhost-add-page <name> [--parent <path-or-hash>]');
    process.exit(1);
  }
  if (!isValidName(name)) {
    console.error('Error: 名称包含非法字符');
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const parentPath = await resolveParent(projectRoot, parent, 'pages');

  try {
    const result = await createItem(projectRoot, parentPath, name, 'page');
    const relativePath = result.path.replace(/^prototype\/(pages|components)\/?/, '');
    await assignId(projectRoot, 'pages', relativePath);
    await regenerateSitemap(projectRoot);
    console.log(`✅ 页面创建成功: ${result.path}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
