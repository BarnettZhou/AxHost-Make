const fs = require('fs/promises');
const path = require('path');
const { staticHandler } = require('./middleware/static.js');
const { cors } = require('./middleware/cors.js');
const { workspaceRoutes, workspaceWithRoot, projectRoutes } = require('./routes.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

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
      const routeKey = `${req.method}:${urlPath}`;

      const wsHandler = workspaceRoutes[routeKey];
      if (wsHandler) {
        return wsHandler(req, res, ...(workspaceWithRoot.has(routeKey) ? [workspaceRoot] : []));
      }
      const prHandler = projectRoutes[routeKey];
      if (prHandler) {
        return prHandler(req, res, getProjectRoot(req));
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
