const fs = require('fs/promises');
const path = require('path');

async function scanDir(dirPath, relativePath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const children = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const childRel = path.posix.join(relativePath, name);
    const childAbs = path.join(dirPath, name);

    const hasIndex = await fs.access(path.join(childAbs, 'index.html'))
      .then(() => true)
      .catch(() => false);

    if (hasIndex) {
      const hasDocsDir = await fs.access(path.join(childAbs, 'docs'))
        .then(() => true)
        .catch(() => false);
      let hasDocs = false;
      if (hasDocsDir) {
        const docsEntries = await fs.readdir(path.join(childAbs, 'docs'), { withFileTypes: true })
          .catch(() => []);
        hasDocs = docsEntries.some(e => e.isFile() && e.name.endsWith('.md'));
      }
      children.push({ name, path: childRel, type: 'page', hasDocs });
    } else {
      const subChildren = await scanDir(childAbs, childRel);
      children.push({ name, path: childRel, type: 'dir', children: subChildren });
    }
  }

  return children;
}

async function handleScan(req, res, projectRoot) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const type = url.searchParams.get('type');
  if (!type || (type !== 'pages' && type !== 'components')) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 400, message: 'Invalid or missing type param' }));
    return;
  }

  const targetDir = path.join(projectRoot, 'prototype', type);
  try {
    const tree = await scanDir(targetDir, '');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: tree }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
}

module.exports = { handleScan };
