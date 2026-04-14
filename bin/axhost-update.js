#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('../server/api/sitemap.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function update(projectRoot) {
  const templateRoot = path.resolve(__dirname, '../templates');

  // Update prototype/index.html
  const protoIndexPath = path.join(projectRoot, 'prototype', 'index.html');
  const tplPath = path.join(templateRoot, 'prototype-index.html');
  if (await exists(tplPath)) {
    await fs.copyFile(tplPath, protoIndexPath);
    console.log('  - Updated prototype/index.html');
  }

  // Ensure start.html exists
  const protoStartPath = path.join(projectRoot, 'prototype', 'start.html');
  if (!await exists(protoStartPath)) {
    const startTpl = path.join(templateRoot, 'prototype-start.html');
    if (await exists(startTpl)) {
      await fs.copyFile(startTpl, protoStartPath);
      console.log('  - Created prototype/start.html');
    }
  }

  // Copy marked.min.js
  const markedSrc = path.resolve(__dirname, '../client/assets/marked.min.js');
  const markedDest = path.join(projectRoot, 'prototype/resources/js/marked.min.js');
  if (await exists(markedSrc)) {
    await fs.mkdir(path.dirname(markedDest), { recursive: true });
    await fs.copyFile(markedSrc, markedDest);
    console.log('  - Updated prototype/resources/js/marked.min.js');
  }

  // Copy shell.css
  const cssSrc = path.resolve(__dirname, '../client/css/shell.css');
  const cssDest = path.join(projectRoot, 'prototype/resources/css/shell.css');
  if (await exists(cssSrc)) {
    await fs.mkdir(path.dirname(cssDest), { recursive: true });
    await fs.copyFile(cssSrc, cssDest);
    console.log('  - Updated prototype/resources/css/shell.css');
  }

  // Regenerate sitemap while preserving project name
  await regenerateSitemap(projectRoot);
  console.log('  - Regenerated prototype/sitemap.js');

  console.log('Axhost-Make project updated successfully.');
}

module.exports = { update };

if (require.main === module) {
  const projectRoot = process.cwd();
  update(projectRoot).catch(err => {
    console.error('Update failed:', err);
    process.exit(1);
  });
}
