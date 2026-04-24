const fs = require('fs/promises');
const path = require('path');
const { readSitemap, writeSitemap } = require('../lib/sitemap-io.js');
const { generateId } = require('../lib/ids.js');

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

function addNodeToSitemap(sitemap, tab, parentId, node) {
  const list = sitemap[tab] || [];
  if (!parentId) {
    list.push(node);
    sitemap[tab] = list;
  } else {
    function findAndInsert(nodes) {
      for (const n of nodes) {
        if (n.id === parentId) {
          if (!n.children) n.children = [];
          n.children.push(node);
          return true;
        }
        if (n.children && findAndInsert(n.children)) return true;
      }
      return false;
    }
    findAndInsert(list);
  }
  // Update flat map
  if (!sitemap._map) sitemap._map = {};
  sitemap._map[node.id] = {
    name: node.name,
    type: node.type,
    path: `${tab.slice(0, -1)}/${node.path}`
  };
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

  if (kind === 'folder') {
    // Dir nodes are logical only — no physical directory needed
    const sitemap = await readSitemap(projectRoot);
    addNodeToSitemap(sitemap, tab, parentId, {
      id: hash,
      name,
      path: hash,
      type: 'dir',
      parentId,
      docs: []
    });
    await writeSitemap(projectRoot, sitemap);
    return { id: hash, name, path: hash, kind };
  }

  await fs.mkdir(targetDir, { recursive: true });

  const meta = { name, kind };
  if (parentId) meta.parentId = parentId;
  await writeMeta(targetDir, meta);

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

  const tplDoc = await fs.readFile(path.join(TEMPLATE_ROOT, 'docs', 'readme.md'), 'utf-8');
  await fs.mkdir(path.join(targetDir, 'docs'), { recursive: true });
  await fs.writeFile(path.join(targetDir, 'docs', 'readme.md'), applyTemplate(tplDoc, vars), 'utf-8');

  // Update sitemap
  const sitemap = await readSitemap(projectRoot);
  const docs = ['readme.md'];
  addNodeToSitemap(sitemap, tab, parentId, {
    id: hash,
    name,
    path: hash,
    type: kind,
    parentId,
    docs
  });
  await writeSitemap(projectRoot, sitemap);

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
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleCreate, createItem };
