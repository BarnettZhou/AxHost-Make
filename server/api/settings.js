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
      const savedLink = await readLink(projectRoot);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { name: data.name, link: savedLink } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleSettingsGet, handleSettingsPost, readSitemap };
