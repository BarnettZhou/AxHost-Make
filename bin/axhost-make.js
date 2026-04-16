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

Commands:
  init      Initialize project directories and entry files
  update    Update prototype entry files and styles from the latest axhost-make core
  build     Build standalone prototype-index.html from client/preview-index.html
  serve     Start local dev server (with API and shell)
  preview   Start a simple static server for the prototype/ directory

Options:
  --port    Server port (default: 3820 for serve, 8080 for preview)
  --help    Show this help message
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

  console.error(`Unknown command: ${command}`);
  showHelp();
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
