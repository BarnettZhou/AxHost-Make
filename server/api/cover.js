const fs = require('fs/promises');
const fsc = require('fs');
const path = require('path');

function getCoversDir(workspaceRoot) {
  return path.join(workspaceRoot, 'projects', 'covers');
}

// POST /api/cover/upload — save cover image
async function handleCoverUpload(req, res, workspaceRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { id, data, ext } = JSON.parse(body || '{}');
      if (!id || !data) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Missing id or data' }));
        return;
      }
      const coversDir = getCoversDir(workspaceRoot);
      await fs.mkdir(coversDir, { recursive: true });

      // Remove any existing cover for this project
      try {
        const existing = await fs.readdir(coversDir);
        for (const f of existing) {
          const base = f.replace(/\.[^.]+$/, '');
          if (base === id) {
            await fs.unlink(path.join(coversDir, f));
          }
        }
      } catch (e) {}

      const safeExt = (ext || 'png').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'png';
      const filename = `${id}.${safeExt}`;
      const filePath = path.join(coversDir, filename);
      await fs.writeFile(filePath, Buffer.from(data, 'base64'));

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, filename }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

// GET /api/cover?ids=hash1,hash2 — return which hashes have covers
async function handleCoverGet(req, res, workspaceRoot) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const idsParam = url.searchParams.get('ids') || '';
    const ids = idsParam ? idsParam.split(',').filter(Boolean) : [];
    const coversDir = getCoversDir(workspaceRoot);
    let files = [];
    try {
      files = await fs.readdir(coversDir);
    } catch (e) { /* dir doesn't exist yet */ }

    const covered = {};
    for (const id of ids) {
      const match = files.find(f => f.startsWith(id + '.'));
      if (match) covered[id] = '/api/cover-file?file=' + encodeURIComponent(match);
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: covered }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
}

// GET /api/cover-file?file=xxx.png — serve cover image file
async function handleCoverFileServe(req, res, workspaceRoot) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const filename = url.searchParams.get('file') || '';
    if (!filename || filename.includes('..') || filename.includes('/')) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }
    const filePath = path.join(getCoversDir(workspaceRoot), filename);
    try {
      await fs.access(filePath);
    } catch {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filename).toLowerCase();
    const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' };
    const mime = mimeMap[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' });
    fsc.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal error');
  }
}

module.exports = {
  handleCoverUpload, handleCoverGet, handleCoverFileServe,
  routes: [
    { method: 'POST', path: '/api/cover/upload',  handler: handleCoverUpload,    scope: 'workspace' },
    { method: 'GET',  path: '/api/cover',          handler: handleCoverGet,       scope: 'workspace' },
    { method: 'GET',  path: '/api/cover-file',     handler: handleCoverFileServe, scope: 'workspace' },
  ]
};
