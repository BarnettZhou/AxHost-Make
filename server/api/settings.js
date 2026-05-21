const fs = require('fs/promises');
const path = require('path');
const { readSitemap, writeSitemap } = require('../lib/sitemap-io.js');

const LINK_FILE = '.axhost-link.json';

async function readLink(projectRoot) {
  try {
    const content = await fs.readFile(path.join(projectRoot, LINK_FILE), 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

async function writeLink(projectRoot, data) {
  const linkPath = path.join(projectRoot, LINK_FILE);
  if (!data || !data.remoteProjectId) {
    try { await fs.unlink(linkPath); } catch (e) {}
    return;
  }
  await fs.writeFile(linkPath, JSON.stringify(data, null, 2), 'utf-8');
}

async function handleSettingsGet(req, res, projectRoot) {
  try {
    const data = await readSitemap(projectRoot);
    const link = await readLink(projectRoot);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: { name: data.name || 'Prototype', link } }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
}

async function handleSettingsPost(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { name, link } = JSON.parse(body || '{}');
      const data = await readSitemap(projectRoot);
      if (name !== undefined) data.name = name || 'Prototype';
      await writeSitemap(projectRoot, data);
      if (link !== undefined) {
        await writeLink(projectRoot, link);
      }

      // Sync name to workspace .projects.json so home page list stays in sync
      if (name !== undefined) {
        try {
          const workspaceRoot = path.resolve(projectRoot, '../..');
          const metaPath = path.join(workspaceRoot, 'projects', '.projects.json');
          const raw = await fs.readFile(metaPath, 'utf-8');
          const meta = JSON.parse(raw);
          const projects = meta.projects || [];
          const entry = projects.find(p => p.id === path.basename(projectRoot));
          if (entry) {
            entry.name = name.trim() || 'Prototype';
            await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
          }
        } catch (e) {}
      }

      const savedLink = await readLink(projectRoot);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { name: data.name, link: savedLink } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleSettingsGet, handleSettingsPost, readSitemap,
  routes: [
    { method: 'GET', path: '/api/settings', handler: handleSettingsGet, scope: 'project' },
    { method: 'POST', path: '/api/settings', handler: handleSettingsPost, scope: 'project' }
  ]
};
