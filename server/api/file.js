const fs = require('fs/promises');
const path = require('path');

const ALLOWED_WRITE_EXTS = new Set(['.html', '.md', '.css', '.js', '.json', '.txt']);

function isSafePath(projectRoot, inputPath) {
  if (inputPath.includes('..')) return false;
  const resolved = path.resolve(projectRoot, inputPath);
  return resolved.startsWith(path.resolve(projectRoot));
}

async function handleFileGet(req, res, projectRoot) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const filePathInput = url.searchParams.get('path');
  if (!filePathInput || !isSafePath(projectRoot, filePathInput)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
    return;
  }
  const filePath = path.resolve(projectRoot, filePathInput);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(content);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 404, message: 'File not found' }));
  }
}

async function handleFilePost(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { path: filePathInput, content } = JSON.parse(body || '{}');
      if (!filePathInput || typeof content !== 'string' || !isSafePath(projectRoot, filePathInput)) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path or invalid content' }));
        return;
      }
      const ext = path.extname(filePathInput).toLowerCase();
      if (!ALLOWED_WRITE_EXTS.has(ext)) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'File type not allowed' }));
        return;
      }
      const filePath = path.resolve(projectRoot, filePathInput);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, message: 'saved' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleFileGet, handleFilePost };
