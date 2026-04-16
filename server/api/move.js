const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('./sitemap.js');

async function handleMove(req, res, projectRoot) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const data = JSON.parse(body || '{}');
  const { type, sourcePath, targetPath } = data;

  if (!type || (type !== 'pages' && type !== 'components') || !sourcePath || typeof sourcePath !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 400, message: 'Invalid params' }));
    return;
  }

  // 禁止将节点移入自身或其子级
  if (targetPath && (sourcePath === targetPath || targetPath.startsWith(sourcePath + '/'))) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 400, message: 'Cannot move into itself' }));
    return;
  }

  const sourceAbs = path.join(projectRoot, 'prototype', type, sourcePath);
  const sourceName = path.basename(sourcePath);

  let targetAbs;
  if (!targetPath) {
    targetAbs = path.join(projectRoot, 'prototype', type, sourceName);
  } else {
    const targetIndexHtml = path.join(projectRoot, 'prototype', type, targetPath, 'index.html');
    const isTargetPage = await fs.access(targetIndexHtml).then(() => true).catch(() => false);
    if (isTargetPage) {
      targetAbs = path.join(projectRoot, 'prototype', type, targetPath, 'sub-pages', sourceName);
    } else {
      targetAbs = path.join(projectRoot, 'prototype', type, targetPath, sourceName);
    }
  }

  if (sourceAbs === targetAbs) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 400, message: 'Same location' }));
    return;
  }

  try {
    if (targetPath && targetAbs.includes('/sub-pages/')) {
      const subPagesDir = path.dirname(targetAbs);
      await fs.mkdir(subPagesDir, { recursive: true });
    }
    await fs.rename(sourceAbs, targetAbs);
    await regenerateSitemap(projectRoot);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0 }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
}

module.exports = { handleMove };
