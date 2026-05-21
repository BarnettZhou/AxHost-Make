const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const IMAGES_DIR = 'prototype/images';

async function readIndex(projectRoot) {
  const indexPath = path.join(projectRoot, IMAGES_DIR, 'images.json');
  try {
    const raw = await fs.readFile(indexPath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) { return {}; }
}

async function writeIndex(projectRoot, index) {
  const indexPath = path.join(projectRoot, IMAGES_DIR, 'images.json');
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

// Walk all docs/**/*.md recursively under prototype/
async function walkDocFiles(projectRoot) {
  const results = [];
  const prototypeDir = path.join(projectRoot, 'prototype');
  async function walk(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch (e) { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'images') await walk(full);
      } else if (entry.name.endsWith('.md')) {
        results.push(full);
      }
    }
  }
  await walk(prototypeDir);
  return results;
}

// POST /api/images/upload
async function handleImagesUpload(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { name, data } = JSON.parse(body || '{}');
      if (!data || typeof data !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Missing image data' }));
        return;
      }

      let mimeType = 'image/png';
      let base64Data = data;
      const dataUrlMatch = data.match(/^data:([^;]+);base64,(.+)$/i);
      if (dataUrlMatch) {
        mimeType = dataUrlMatch[1];
        base64Data = dataUrlMatch[2];
      }

      const mimeToExt = {
        'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
        'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp'
      };
      let ext = mimeToExt[mimeType] || 'png';
      if (name) {
        const dot = name.lastIndexOf('.');
        if (dot > 0) {
          const nameExt = name.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          if (nameExt.length >= 2 && nameExt.length <= 5) ext = nameExt;
        }
      }

      const hash = crypto.createHash('md5').update(base64Data).digest('hex').substring(0, 8);
      const filename = `${hash}.${ext}`;

      const imagesDir = path.join(projectRoot, IMAGES_DIR);
      await fs.mkdir(imagesDir, { recursive: true });
      await fs.writeFile(path.join(imagesDir, filename), Buffer.from(base64Data, 'base64'));

      const index = await readIndex(projectRoot);
      index[hash] = { name: name || filename };
      await writeIndex(projectRoot, index);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, filename }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

// GET /api/images/list
async function handleImagesList(req, res, projectRoot) {
  try {
    const index = await readIndex(projectRoot);
    const imagesDir = path.join(projectRoot, IMAGES_DIR);
    const list = [];
    for (const [hash, info] of Object.entries(index)) {
      // Find actual file
      let filename = null;
      try {
        const files = await fs.readdir(imagesDir);
        filename = files.find(f => f.startsWith(hash + '.'));
      } catch (e) {}
      list.push({
        hash,
        name: info.name || filename || (hash + '.png'),
        filename: filename || (hash + '.png')
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: list }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
}

// POST /api/images/rename
async function handleImagesRename(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { hash, name } = JSON.parse(body || '{}');
      if (!hash || !name) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Missing hash or name' }));
        return;
      }
      const index = await readIndex(projectRoot);
      if (!index[hash]) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 404, message: 'Image not found' }));
        return;
      }
      index[hash].name = name;
      await writeIndex(projectRoot, index);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0 }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

// POST /api/images/delete
async function handleImagesDelete(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { hashes } = JSON.parse(body || '{}');
      if (!hashes || !Array.isArray(hashes)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Missing hashes array' }));
        return;
      }
      const index = await readIndex(projectRoot);
      const imagesDir = path.join(projectRoot, IMAGES_DIR);
      for (const hash of hashes) {
        delete index[hash];
        try {
          const files = await fs.readdir(imagesDir);
          const file = files.find(f => f.startsWith(hash + '.'));
          if (file) await fs.unlink(path.join(imagesDir, file));
        } catch (e) {}
      }
      await writeIndex(projectRoot, index);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0 }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

// POST /api/images/scan-unused
async function handleImagesScanUnused(req, res, projectRoot) {
  try {
    const index = await readIndex(projectRoot);
    const usedHashes = new Set();
    const docFiles = await walkDocFiles(projectRoot);
    for (const docPath of docFiles) {
      try {
        const content = await fs.readFile(docPath, 'utf-8');
        const re = /\$([a-f0-9]{8})\.(png|jpg|gif|webp|svg|bmp)/gi;
        let match;
        while ((match = re.exec(content)) !== null) {
          usedHashes.add(match[1].toLowerCase());
        }
      } catch (e) {}
    }
    const unused = [];
    for (const hash of Object.keys(index)) {
      if (!usedHashes.has(hash)) {
        unused.push({ hash, name: index[hash].name });
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: { unused, total: Object.keys(index).length } }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
}

module.exports = {
  handleImagesUpload, handleImagesList, handleImagesRename, handleImagesDelete, handleImagesScanUnused,
  routes: [
    { method: 'POST', path: '/api/images/upload', handler: handleImagesUpload, scope: 'project' },
    { method: 'GET', path: '/api/images/list', handler: handleImagesList, scope: 'project' },
    { method: 'POST', path: '/api/images/rename', handler: handleImagesRename, scope: 'project' },
    { method: 'POST', path: '/api/images/delete', handler: handleImagesDelete, scope: 'project' },
    { method: 'POST', path: '/api/images/scan-unused', handler: handleImagesScanUnused, scope: 'project' },
  ]
};
