#!/usr/bin/env node
const path = require('path');
const { startServer } = require('../server/index.js');
const { startPreviewServer } = require('../server/preview-server.js');
const { init } = require('./axhost-init.js');
const { update } = require('./axhost-update.js');
const { build } = require('./axhost-build.js');

function showHelp() {
  console.log(`
Axhost-Make CLI

Usage:
  axhost-make init
  axhost-make update
  axhost-make build
  axhost-make serve [--port <number>]
  axhost-make preview [--port <number>]
  axhost-make migrate

  # 创建操作
  axhost-make add-page <name> [--parent <path-or-hash>]
  axhost-make add-component <name> [--parent <path-or-hash>]
  axhost-make add-folder <name> [--parent <path-or-hash>] [-t pages|components]
  axhost-make add-doc <name> --to <path-or-hash>

  # 查询操作（Agent 友好）
  axhost-make list
  axhost-make find <name>
  axhost-make info <hash>
  axhost-make search <keyword>
  axhost-make path <hash> [doc-name]
  axhost-make copy <hash> <new-name> [--parent <path-or-hash>]

Commands:
  init           Initialize project directories and entry files
  update         Update prototype entry files and styles from the latest axhost-make core
  build          Build standalone prototype-index.html from client/preview-index.html
  serve          Start local dev server (with API and shell)
  preview        Start a simple static server for the prototype/ directory
  migrate        Migrate existing prototype data to hash-directory format

  add-page       Create a new page under prototype/pages/
  add-component  Create a new component under prototype/components/
  add-folder     Create a new folder under prototype/pages/ or prototype/components/
  add-doc        Create a new markdown doc for a page or component

  list           List all pages and components with hash and name
  find           Find hash by exact name
  info           Show detailed info by hash
  search         Fuzzy search by keyword
  path           Get absolute file path by hash (optionally for a doc)
  copy           Copy a page/component as a new one

Options:
  --port         Server port (default: 3820 for serve, 8080 for preview)
  --parent, -p   Parent path (full path like pages/xxx or hash like 6e3d21e9)
  --to, -t       Target page/component for add-doc (full path or hash)
  --help         Show this help message
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  if (command === 'init') {
    const projectRoot = process.cwd();
    init(projectRoot);
    return;
  }

  if (command === 'update') {
    const projectRoot = process.cwd();
    update(projectRoot);
    return;
  }

  if (command === 'build') {
    const projectRoot = process.cwd();
    build(projectRoot);
    return;
  }

  if (command === 'migrate') {
    const { migrate } = require('./axhost-migrate.js');
    const projectRoot = process.cwd();
    await migrate(projectRoot);
    return;
  }

  if (command === 'serve') {
    let port = 3820;
    const portIndex = args.indexOf('--port');
    if (portIndex !== -1 && args[portIndex + 1]) {
      const parsed = parseInt(args[portIndex + 1], 10);
      if (!isNaN(parsed)) port = parsed;
    }
    const projectRoot = process.cwd();
    startServer({ port, host: '127.0.0.1', projectRoot });
    return;
  }

  if (command === 'preview') {
    let port = 8080;
    const portIndex = args.indexOf('--port');
    if (portIndex !== -1 && args[portIndex + 1]) {
      const parsed = parseInt(args[portIndex + 1], 10);
      if (!isNaN(parsed)) port = parsed;
    }
    const projectRoot = process.cwd();
    const root = path.join(projectRoot, 'prototype');
    startPreviewServer({ port, host: '127.0.0.1', root });
    return;
  }

  const addCommands = ['add-page', 'add-component', 'add-folder', 'add-doc'];
  if (addCommands.includes(command)) {
    const scriptMap = {
      'add-page': 'axhost-add-page.js',
      'add-component': 'axhost-add-component.js',
      'add-folder': 'axhost-add-folder.js',
      'add-doc': 'axhost-add-doc.js'
    };
    const scriptPath = path.join(__dirname, scriptMap[command]);
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, [scriptPath, ...args.slice(1)], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    child.on('exit', code => process.exit(code || 0));
    return;
  }

  const queryCommands = ['list', 'find', 'info', 'search', 'path', 'copy'];
  if (queryCommands.includes(command)) {
    const scriptPath = path.join(__dirname, 'axhost-query.js');
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    child.on('exit', code => process.exit(code || 0));
    return;
  }

  console.error(`Unknown command: ${command}`);
  showHelp();
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
