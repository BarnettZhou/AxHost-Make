const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('./sitemap.js');

const TEMPLATE_ROOT = path.resolve(__dirname, '../../templates');

function isSafePath(projectRoot, inputPath) {
  if (inputPath.includes('..')) return false;
  const resolved = path.resolve(projectRoot, inputPath);
  return resolved.startsWith(path.resolve(projectRoot));
}

function isValidName(name) {
  return /^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(name);
}

function applyTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

async function createItem(projectRoot, parentPath, name, kind) {
  if (!isValidName(name)) {
    throw new Error('Invalid name');
  }
  if (!isSafePath(projectRoot, parentPath)) {
    throw new Error('Forbidden parent path');
  }

  const targetDir = path.resolve(projectRoot, parentPath, name);
  try {
    await fs.access(targetDir);
    throw new Error('Target already exists');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  await fs.mkdir(targetDir, { recursive: true });

  if (kind === 'folder') {
    return { path: path.posix.join(parentPath, name), kind };
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

  return { path: path.posix.join(parentPath, name), kind };
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

module.exports = { handleCreate };
