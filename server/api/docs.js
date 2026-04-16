const fs = require('fs/promises');
const path = require('path');

function isSafePath(projectRoot, inputPath) {
  if (inputPath.includes('..')) return false;
  const resolved = path.resolve(projectRoot, inputPath);
  return resolved.startsWith(path.resolve(projectRoot));
}

async function handleDocsGet(req, res, projectRoot) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const docsPathInput = url.searchParams.get('path');
  if (!docsPathInput || !isSafePath(projectRoot, docsPathInput)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
    return;
  }
  const docsPath = path.resolve(projectRoot, docsPathInput);
  try {
    const entries = await fs.readdir(docsPath, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name)
      .sort();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: files }));
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: [] }));
  }
}

module.exports = { handleDocsGet };
