const fs = require('fs/promises');
const path = require('path');

async function readSitemap(projectRoot) {
  const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
  try {
    const content = await fs.readFile(sitemapPath, 'utf-8');
    const jsonPart = content.replace(/^window\.__axhostSitemap\s*=\s*/, '').replace(/;\s*$/, '');
    return JSON.parse(jsonPart);
  } catch (e) {
    return { name: 'Prototype', pages: [], components: [] };
  }
}

async function writeSitemap(projectRoot, data) {
  const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
  await fs.writeFile(
    sitemapPath,
    `window.__axhostSitemap = ${JSON.stringify(data, null, 2)};\n`,
    'utf-8'
  );
}

async function handleSettingsGet(req, res, projectRoot) {
  try {
    const data = await readSitemap(projectRoot);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: { name: data.name || 'Prototype' } }));
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
      const { name } = JSON.parse(body || '{}');
      const data = await readSitemap(projectRoot);
      data.name = name || 'Prototype';
      await writeSitemap(projectRoot, data);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { name: data.name } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleSettingsGet, handleSettingsPost, readSitemap };
