#!/usr/bin/env node
const { createItem } = require('../server/api/create.js');
const { regenerateSitemap } = require('../server/api/sitemap.js');
const { isValidName, resolveParent } = require('./lib/helpers.js');

function parseArgs() {
  const args = process.argv.slice(2);
  let name = '';
  let parent = '';
  let tab = 'pages';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--parent' || args[i] === '-p') {
      parent = args[i + 1] || '';
      i++;
    } else if (args[i] === '--tab' || args[i] === '-t') {
      tab = args[i + 1] || 'pages';
      i++;
    } else if (!name && !args[i].startsWith('-')) {
      name = args[i];
    }
  }
  return { name, parent, tab };
}

async function main() {
  const { name, parent, tab } = parseArgs();
  if (!name) {
    console.error('Usage: axhost-add-folder <name> [--parent <path-or-hash>] [-t pages|components]');
    process.exit(1);
  }
  if (!isValidName(name)) {
    console.error('Error: 名称包含非法字符');
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const parentPath = await resolveParent(projectRoot, parent, tab);

  try {
    const result = await createItem(projectRoot, parentPath, name, 'folder');
    await regenerateSitemap(projectRoot);
    console.log(`✅ 目录创建成功: ${result.path}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
