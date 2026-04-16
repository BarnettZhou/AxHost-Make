#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function copyResource(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  console.log(`  - Copied ${path.basename(src)} -> ${path.relative(process.cwd(), dest)}`);
}

async function build(projectRoot) {
  const clientRoot = path.resolve(__dirname, '../client');
  const templateRoot = path.resolve(__dirname, '../templates');
  const previewRoot = path.join(templateRoot, 'preview');
  const sourceHtmlPath = path.join(clientRoot, 'preview-index.html');
  const outputHtmlPath = path.join(previewRoot, 'index.html');

  if (!await exists(sourceHtmlPath)) {
    console.error('Build failed: client/preview-index.html not found');
    process.exit(1);
  }

  let html = await fs.readFile(sourceHtmlPath, 'utf-8');

  // Replace base path marker for standalone mode
  html = html.replace("window.__axhostBasePath = '/prototype/'", "window.__axhostBasePath = './'");

  // Replace /client/ paths to ./resources/
  html = html.replace(/(href|src)="\/client\/css\//g, '$1="./resources/css/');
  html = html.replace(/(href|src)="\/client\/js\//g, '$1="./resources/js/');
  html = html.replace(/(href|src)="\/client\/icon\.svg"/g, '$1="./icon.svg"');

  // Replace /prototype/ paths to ./
  html = html.replace(/(href|src)="\/prototype\//g, '$1="./');

  // Copy CSS resources
  await copyResource(
    path.join(clientRoot, 'css', 'shell.css'),
    path.join(previewRoot, 'resources', 'css', 'shell.css')
  );

  // Copy JS resources
  await copyResource(
    path.join(clientRoot, 'js', 'icons.js'),
    path.join(previewRoot, 'resources', 'js', 'icons.js')
  );
  await copyResource(
    path.join(clientRoot, 'js', 'preview-app.js'),
    path.join(previewRoot, 'resources', 'js', 'preview-app.js')
  );

  await fs.mkdir(path.dirname(outputHtmlPath), { recursive: true });
  await fs.writeFile(outputHtmlPath, html, 'utf-8');
  console.log(`  - Generated ${path.relative(projectRoot, outputHtmlPath)}`);
  console.log('Build completed successfully.');
}

module.exports = { build };

if (require.main === module) {
  const projectRoot = process.cwd();
  build(projectRoot).catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
  });
}
