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
const { handlePageType } = require('./api/page-type.js');
const { handleDelete } = require('./api/delete.js');
const { handleSettingsGet, handleSettingsPost } = require('./api/settings.js');
const { handleDocsGet, handleDocsReorder } = require('./api/docs.js');
const { handleReorder } = require('./api/reorder.js');
const { handleMove } = require('./api/move.js');
const { handleCopy } = require('./api/copy.js');
const { handleProjectsGet, handleProjectsPost } = require('./api/projects.js');
const { handleProjectInfoGet } = require('./api/project-info.js');
const { handleExportDefaultDir, handleExportPost, handleExportPublish } = require('./api/export.js');
const { handleOpenEditor } = require('./api/open-editor.js');
const { handleOpenTerminal, handleOpenWslTerminal } = require('./api/terminal.js');
const { handleAxHostProxy } = require('./api/axhost-proxy.js');
const { handleUploadImage } = require('./api/upload-image.js');
const { handleDeleteCacheFile } = require('./api/cache-cleanup.js');

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
    // /projects/{id}/prototype/... → workspaceRoot/projects/{id}/prototype/...
    const match = urlPath.match(/^\/projects\/([^/]+)(\/.*)$/);
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
      const method = req.method;

      // Routes that receive workspaceRoot
      const workspaceRoutes = {
        'GET:/api/projects':             [handleProjectsGet, workspaceRoot],
        'POST:/api/projects':            [handleProjectsPost, workspaceRoot],
        'GET:/api/project-info':         [handleProjectInfoGet, workspaceRoot],
        'GET:/api/export/default-dir':   [handleExportDefaultDir],
        'POST:/api/export':              [handleExportPost, workspaceRoot],
        'POST:/api/export/publish':      [handleExportPublish, workspaceRoot],
        'POST:/api/open-editor':         [handleOpenEditor, workspaceRoot],
        'POST:/api/terminal/open':       [handleOpenTerminal, workspaceRoot],
        'POST:/api/terminal/open-wsl':   [handleOpenWslTerminal, workspaceRoot],
        'POST:/api/axhost-proxy':        [handleAxHostProxy],
      };

      // Routes that receive projectRoot (per-project, from ?project= query)
      const projectRoutes = {
        'GET:/api/scan':                 handleScan,
        'GET:/api/file':                 handleFileGet,
        'POST:/api/file':                handleFilePost,
        'POST:/api/create':              handleCreate,
        'POST:/api/rename':              handleRename,
        'POST:/api/page-type':           handlePageType,
        'POST:/api/delete':              handleDelete,
        'GET:/api/settings':             handleSettingsGet,
        'POST:/api/settings':            handleSettingsPost,
        'GET:/api/docs':                 handleDocsGet,
        'POST:/api/docs/reorder':        handleDocsReorder,
        'POST:/api/sitemap/reorder':     handleReorder,
        'POST:/api/move':                handleMove,
        'POST:/api/copy':                handleCopy,
        'POST:/api/upload-image':        handleUploadImage,
        'POST:/api/cache-file-delete':   handleDeleteCacheFile,
      };

      const routeKey = `${method}:${urlPath}`;
      const wsMatch = workspaceRoutes[routeKey];
      if (wsMatch) {
        const [handler, ...extra] = wsMatch;
        return handler(req, res, ...extra);
      }
      const prMatch = projectRoutes[routeKey];
      if (prMatch) {
        return prMatch(req, res, getProjectRoot(req));
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
