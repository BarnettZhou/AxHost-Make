const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('./sitemap.js');
const { generateId } = require('../lib/ids.js');
const { addToOrder } = require('../lib/order.js');

const TEMPLATE_ROOT = path.resolve(__dirname, '../../templates/project');

function isSafePath(projectRoot, inputPath) {
  if (inputPath.includes('..')) return false;
  const resolved = path.resolve(projectRoot, inputPath);
  return resolved.startsWith(path.resolve(projectRoot));
}

function applyTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

async function collectExistingIds(projectRoot) {
  const ids = new Set();
  async function scan(absPath) {
    const entries = await fs.readdir(absPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (/^[a-f0-9]{8}$/i.test(name)) {
        ids.add(name.toLowerCase());
      }
    }
  }
  await scan(path.join(projectRoot, 'prototype/pages'));
  await scan(path.join(projectRoot, 'prototype/components'));
  return ids;
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

async function createItem(projectRoot, parentPath, name, kind) {
  if (!isSafePath(projectRoot, parentPath)) {
    throw new Error('Forbidden parent path');
  }

  // parentPath is like "prototype/pages" or "prototype/pages/85a10724"
  // Extract tab and parentId
  const parts = parentPath.replace(/^prototype\//, '').split(/[\\/]/);
  const tab = parts[0]; // "pages" or "components"
  const parentId = parts.length > 1 ? parts[parts.length - 1] : null;
  const tabPath = path.join(projectRoot, 'prototype', tab);

  // Generate unique hash as directory name
  const existingIds = await collectExistingIds(projectRoot);
  const hash = generateId(name, existingIds);
  const targetDir = path.join(tabPath, hash);

  try {
    await fs.access(targetDir);
    throw new Error('Target already exists');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  await fs.mkdir(targetDir, { recursive: true });
  await addToOrder(tabPath, hash);

  const meta = { name, kind };
  if (parentId) meta.parentId = parentId;
  await writeMeta(targetDir, meta);

  if (kind === 'folder') {
    return { id: hash, name, path: hash, kind };
  }

  const vars = { PAGE_NAME: name, DATE: new Date().toISOString().slice(0, 10) };
  const templateFile = kind === 'page' ? 'page.html' : 'component.html';

  const tplHtml = await fs.readFile(path.join(TEMPLATE_ROOT, templateFile), 'utf-8');
  await fs.writeFile(path.join(targetDir, 'index.html'), applyTemplate(tplHtml, vars), 'utf-8');

  await fs.mkdir(path.join(targetDir, 'resources', 'css'), { recursive: true });
  await fs.mkdir(path.join(targetDir, 'resources', 'js'), { recursive: true });

  const cssPath = path.join(targetDir, 'resources', 'css', 'style.css');
  const jsPath = path.join(targetDir, 'resources', 'js', 'main.js');
  try { await fs.access(cssPath); } catch { await fs.writeFile(cssPath, '', 'utf-8'); }
  try { await fs.access(jsPath); } catch { await fs.writeFile(jsPath, '', 'utf-8'); }

  const tplDoc = await fs.readFile(path.join(TEMPLATE_ROOT, 'doc.md'), 'utf-8');
  await fs.mkdir(path.join(targetDir, 'docs'), { recursive: true });
  await fs.writeFile(path.join(targetDir, 'docs', 'readme.md'), applyTemplate(tplDoc, vars), 'utf-8');

  return { id: hash, name, path: hash, kind };
}

async function handleCreate(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { parentPath, name, kind } = JSON.parse(body || '{}');
      if (!parentPath || !name || !kind || !['folder', 'page', 'component'].includes(kind)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Invalid parameters' }));
        return;
      }
      const result = await createItem(projectRoot, parentPath, name, kind);
      await regenerateSitemap(projectRoot);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleCreate, createItem };
