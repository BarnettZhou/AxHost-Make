#!/usr/bin/env node
const { createItem } = require('../server/api/create.js');
const { regenerateSitemap } = require('../server/api/sitemap.js');
const { isValidName, resolveParent } = require('./lib/helpers.js');

function parseArgs() {
  const args = process.argv.slice(2);
  let name = '';
  let parent = '';
  let type = 'default';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--parent' || args[i] === '-p') {
      parent = args[i + 1] || '';
      i++;
    } else if (args[i] === '--type' || args[i] === '-t') {
      type = args[i + 1] || 'default';
      i++;
    } else if (!name && !args[i].startsWith('-')) {
      name = args[i];
    }
  }
  return { name, parent, type };
}

async function main() {
  const { name, parent, type } = parseArgs();
  if (!name) {
    console.error('Usage: axhost-add-component <name> [--parent <path-or-hash>] [--type default|mobile]');
    process.exit(1);
  }
  if (!isValidName(name)) {
    console.error('Error: 名称不能为空或包含首尾空格');
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const parentPath = await resolveParent(projectRoot, parent, 'components');

  try {
    const result = await createItem(projectRoot, parentPath, name, 'component', type);
    await regenerateSitemap(projectRoot);
    console.log(`✅ 组件创建成功: ${result.id} (${name})`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
