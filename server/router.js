const fs = require('fs/promises');
const path = require('path');
const { staticHandler } = require('./middleware/static.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}
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
const { handleProjectsGet, handleProjectsPost } = require('./api/projects.js');
const { handleProjectInfoGet } = require('./api/project-info.js');
const { handleExportDefaultDir, handleExportPost, handleExportPublish } = require('./api/export.js');
const { handleOpenEditor } = require('./api/open-editor.js');
const { handleAxHostProxy } = require('./api/axhost-proxy.js');

function createRouter(workspaceRoot) {
  const CLIENT_ROOT = path.resolve(__dirname, '../client');

  function resolveStaticUrl(urlPath) {
    if (urlPath === '/' || urlPath === '/index.html') {
      return path.join(CLIENT_ROOT, 'home.html');
    }
    if (urlPath === '/shell' || urlPath === '/shell.html') {
      return path.join(CLIENT_ROOT, 'shell.html');
    }
    if (urlPath.startsWith('/client/')) {
      return path.join(CLIENT_ROOT, urlPath.slice('/client/'.length));
    }
    return null;
  }

  function resolveProjectStaticUrl(urlPath) {
    // /project/{id}/prototype/... → workspaceRoot/projects/{id}/prototype/...
    const match = urlPath.match(/^\/project\/([^/]+)(\/.*)$/);
    if (match) {
      const projectId = match[1];
      const rest = match[2];
      const resolved = path.join(workspaceRoot, 'projects', projectId, rest);
      if (resolved.startsWith(path.resolve(workspaceRoot))) {
        return resolved;
      }
    }
    return null;
  }

  function getProjectRoot(req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const projectId = url.searchParams.get('project');
    if (projectId) {
      const projectRoot = path.join(workspaceRoot, 'projects', projectId);
      const resolvedWorkspace = path.resolve(workspaceRoot);
      if (path.resolve(projectRoot).startsWith(resolvedWorkspace + path.sep) ||
          path.resolve(projectRoot) === resolvedWorkspace) {
        return projectRoot;
      }
    }
    // 兼容模式：如果没有 project 参数，使用 workspaceRoot 作为项目根目录
    return workspaceRoot;
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
      const projectRoot = getProjectRoot(req);

      if (urlPath === '/api/projects' && req.method === 'GET') {
        return handleProjectsGet(req, res, workspaceRoot);
      }
      if (urlPath === '/api/projects' && req.method === 'POST') {
        return handleProjectsPost(req, res, workspaceRoot);
      }
      if (urlPath === '/api/project-info' && req.method === 'GET') {
        return handleProjectInfoGet(req, res, workspaceRoot);
      }
      if (urlPath === '/api/export/default-dir' && req.method === 'GET') {
        return handleExportDefaultDir(req, res);
      }
      if (urlPath === '/api/export' && req.method === 'POST') {
        return handleExportPost(req, res, workspaceRoot);
      }
      if (urlPath === '/api/export/publish' && req.method === 'POST') {
        return handleExportPublish(req, res, workspaceRoot);
      }
      if (urlPath === '/api/open-editor' && req.method === 'POST') {
        return handleOpenEditor(req, res, workspaceRoot);
      }
      if (urlPath === '/api/axhost-proxy' && req.method === 'POST') {
        return handleAxHostProxy(req, res);
      }
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

    const projectStaticPath = resolveProjectStaticUrl(urlPath);
    if (projectStaticPath) {
      return staticHandler(req, res, projectStaticPath);
    }

    // 兼容单项目模式：/prototype/* 直接指向 workspaceRoot/prototype/*
    if (urlPath.startsWith('/prototype/')) {
      const fallbackPath = path.join(workspaceRoot, urlPath);

      // 先尝试单项目模式的 workspaceRoot/prototype/*
      if (await exists(fallbackPath)) {
        return staticHandler(req, res, fallbackPath);
      }

      // 多项目兼容：从 referer 中提取 project id
      const referer = req.headers.referer || '';
      const projectMatch = referer.match(/\/project\/([^/]+)\//);
      if (projectMatch) {
        const projectId = projectMatch[1];
        const projectPath = path.join(workspaceRoot, 'projects', projectId, urlPath);
        if (await exists(projectPath)) {
          return staticHandler(req, res, projectPath);
        }
      }

      return staticHandler(req, res, fallbackPath);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  };
}

module.exports = { createRouter };
