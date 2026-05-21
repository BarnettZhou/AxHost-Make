const fs = require('fs/promises');
const path = require('path');

async function handlePromptUpload(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { name, mimeType, data } = JSON.parse(body || '{}');
      if (!data || typeof data !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Missing image data' }));
        return;
      }

      let ext = 'png';
      if (mimeType) {
        const subtype = mimeType.split('/')[1];
        if (subtype) ext = subtype.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'png';
      } else if (name) {
        const dot = name.lastIndexOf('.');
        if (dot > 0) ext = name.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'png';
      }

      const now = new Date();
      const ts = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0') + '_' +
        String(now.getMilliseconds()).padStart(3, '0');
      const filename = `${ts}.${ext}`;
      const relativePath = path.join('cache', 'prompt', 'images', filename);
      const fullPath = path.resolve(projectRoot, relativePath);

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, Buffer.from(data, 'base64'));

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 0,
        path: relativePath.replace(/\\/g, '/')
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = {
  handlePromptUpload,
  routes: [
    { method: 'POST', path: '/api/prompt-upload', handler: handlePromptUpload, scope: 'project' }
  ]
};
