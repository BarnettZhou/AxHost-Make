const fs = require('fs/promises');
const path = require('path');
const { reorder: reorderFile } = require('../lib/order.js');

async function handleReorder(req, res, projectRoot) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const data = JSON.parse(body || '{}');
  const { type, parentPath, oldIndex, newIndex } = data;

  if (!type || (type !== 'pages' && type !== 'components') || typeof oldIndex !== 'number' || typeof newIndex !== 'number') {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 400, message: 'Invalid params' }));
    return;
  }

  const dirPath = parentPath
    ? path.join(projectRoot, 'prototype', type, parentPath)
    : path.join(projectRoot, 'prototype', type);

  const ok = await reorderFile(dirPath, oldIndex, newIndex);
  if (!ok) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 400, message: 'Reorder failed' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ code: 0 }));
}

module.exports = { handleReorder };
