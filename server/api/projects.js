const fs = require('fs/promises');
const path = require('path');
const { init } = require('../../bin/axhost-init.js');
const { generateId } = require('../lib/ids.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function getProjectsDir(workspaceRoot) {
  return path.join(workspaceRoot, 'projects');
}

function getProjectsMetaPath(workspaceRoot) {
  return path.join(getProjectsDir(workspaceRoot), '.projects.json');
}

async function readProjectsMeta(workspaceRoot) {
  const metaPath = getProjectsMetaPath(workspaceRoot);
  try {
    const content = await fs.readFile(metaPath, 'utf-8');
    const data = JSON.parse(content);
    return data.projects || [];
  } catch (e) {
    return [];
  }
}

async function writeProjectsMeta(workspaceRoot, projects) {
  const metaPath = getProjectsMetaPath(workspaceRoot);
  await fs.writeFile(metaPath, JSON.stringify({ projects }, null, 2) + '\n', 'utf-8');
}

async function getProjectLastModified(projectPath) {
  let lastModified = null;
  try {
    const protoPath = path.join(projectPath, 'prototype');
    async function scan(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else {
          const stat = await fs.stat(fullPath);
          if (!lastModified || stat.mtime > lastModified) {
            lastModified = stat.mtime;
          }
        }
      }
    }
    await scan(protoPath);
  } catch (e) {}
  return lastModified;
}

async function getProjectInfo(projectsDir, meta) {
  const projectPath = path.join(projectsDir, meta.id);
  if (!await exists(projectPath)) return null;

  const lastModified = await getProjectLastModified(projectPath) || new Date(meta.lastModified);

  return {
    id: meta.id,
    name: meta.name,
    createdAt: meta.createdAt,
    lastModified
  };
}

async function handleProjectsGet(req, res, workspaceRoot) {
  try {
    const projectsDir = getProjectsDir(workspaceRoot);
    if (!await exists(projectsDir)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: [] }));
      return;
    }

    let metas = await readProjectsMeta(workspaceRoot);
    const results = [];
    let dirty = false;

    for (const meta of metas) {
      const info = await getProjectInfo(projectsDir, meta);
      if (!info) {
        dirty = true;
        continue;
      }
      const metaTime = new Date(meta.lastModified).getTime();
      const fsTime = info.lastModified.getTime();
      if (Math.abs(fsTime - metaTime) > 1000) {
        meta.lastModified = info.lastModified.toISOString();
        dirty = true;
      }
      results.push(info);
    }

    if (dirty) {
      await writeProjectsMeta(workspaceRoot, results.map(r => ({
        id: r.id,
        name: r.name,
        createdAt: r.createdAt,
        lastModified: r.lastModified.toISOString()
      })));
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: results }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
}

async function handleProjectsPost(req, res, workspaceRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { name } = JSON.parse(body || '{}');
      if (!name || !name.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Project name is required' }));
        return;
      }

      const projectsDir = getProjectsDir(workspaceRoot);
      await fs.mkdir(projectsDir, { recursive: true });

      const metas = await readProjectsMeta(workspaceRoot);
      const existingIds = new Set(metas.map(m => m.id.toLowerCase()));
      const id = generateId(name.trim(), existingIds);

      const projectRoot = path.join(projectsDir, id);
      await fs.mkdir(projectRoot, { recursive: true });
      await init(projectRoot);

      // Update project name in sitemap
      try {
        const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
        const content = await fs.readFile(sitemapPath, 'utf-8');
        const jsonPart = content.replace(/^window\.__axhostSitemap\s*=\s*/, '').replace(/;\s*$/, '');
        const data = JSON.parse(jsonPart);
        data.name = name.trim();
        await fs.writeFile(
          sitemapPath,
          `window.__axhostSitemap = ${JSON.stringify(data, null, 2)};\n`,
          'utf-8'
        );
      } catch (e) {}

      const now = new Date().toISOString();
      metas.push({
        id,
        name: name.trim(),
        createdAt: now,
        lastModified: now
      });
      await writeProjectsMeta(workspaceRoot, metas);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { id, name: name.trim() } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleProjectsGet, handleProjectsPost };
