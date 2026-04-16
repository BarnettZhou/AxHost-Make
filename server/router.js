const path = require('path');
const { staticHandler } = require('./middleware/static.js');
const { cors } = require('./middleware/cors.js');
const { handleScan } = require('./api/scan.js');
const { handleFileGet, handleFilePost } = require('./api/file.js');
const { handleCreate } = require('./api/create.js');
const { handleRename } = require('./api/rename.js');
const { handleDelete } = require('./api/delete.js');
const { handleSettingsGet, handleSettingsPost } = require('./api/settings.js');
const { handleDocsGet } = require('./api/docs.js');
const { handleReorder } = require('./api/reorder.js');
const { handleMove } = require('./api/move.js');

function createRouter(projectRoot) {
  const CLIENT_ROOT = path.resolve(__dirname, '../client');
  const PROTOTYPE_ROOT = path.join(projectRoot, 'prototype');

  function resolveStaticUrl(urlPath) {
    if (urlPath === '/' || urlPath === '/index.html') {
      return path.join(CLIENT_ROOT, 'index.html');
    }
    if (urlPath.startsWith('/client/')) {
      return path.join(CLIENT_ROOT, urlPath.slice('/client/'.length));
    }
    if (urlPath.startsWith('/prototype/')) {
      return path.join(PROTOTYPE_ROOT, urlPath.slice('/prototype/'.length));
    }
    return null;
  }

  return async function router(req, res) {
    cors(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);

    if (urlPath.startsWith('/api/')) {
      if (urlPath === '/api/scan' && req.method === 'GET') {
        return handleScan(req, res, projectRoot);
      }
      if (urlPath === '/api/file' && req.method === 'GET') {
        return handleFileGet(req, res, projectRoot);
      }
      if (urlPath === '/api/file' && req.method === 'POST') {
        return handleFilePost(req, res, projectRoot);
      }
      if (urlPath === '/api/create' && req.method === 'POST') {
        return handleCreate(req, res, projectRoot);
      }
      if (urlPath === '/api/rename' && req.method === 'POST') {
        return handleRename(req, res, projectRoot);
      }
      if (urlPath === '/api/delete' && req.method === 'POST') {
        return handleDelete(req, res, projectRoot);
      }
      if (urlPath === '/api/settings' && req.method === 'GET') {
        return handleSettingsGet(req, res, projectRoot);
      }
      if (urlPath === '/api/settings' && req.method === 'POST') {
        return handleSettingsPost(req, res, projectRoot);
      }
      if (urlPath === '/api/docs' && req.method === 'GET') {
        return handleDocsGet(req, res, projectRoot);
      }
      if (urlPath === '/api/sitemap/reorder' && req.method === 'POST') {
        return handleReorder(req, res, projectRoot);
      }
      if (urlPath === '/api/move' && req.method === 'POST') {
        return handleMove(req, res, projectRoot);
      }
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 404, message: 'API not found' }));
      return;
    }

    const staticPath = resolveStaticUrl(urlPath);
    if (staticPath) {
      return staticHandler(req, res, staticPath);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  };
}

module.exports = { createRouter };
