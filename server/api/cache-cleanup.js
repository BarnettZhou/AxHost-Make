const fs = require('fs/promises');
const path = require('path');

function isSafeCachePath(projectRoot, inputPath) {
  if (!inputPath || inputPath.includes('..')) return false;
  const resolved = path.resolve(projectRoot, inputPath);
  const cacheRoot = path.resolve(projectRoot, 'cache');
  return resolved.startsWith(cacheRoot + path.sep) || resolved === cacheRoot;
}

async function handleDeleteCacheFile(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { path: filePathInput } = JSON.parse(body || '{}');
      if (!filePathInput || !isSafeCachePath(projectRoot, filePathInput)) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
        return;
      }
      const filePath = path.resolve(projectRoot, filePathInput);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, message: 'deleted' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

async function scanAndCleanProject(projectRoot, maxAgeMs) {
  const cacheDir = path.join(projectRoot, 'cache', 'prompt', 'images');
  try {
    const files = await fs.readdir(cacheDir);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(cacheDir, file);
      try {
        const stat = await fs.stat(filePath);
        if (now - stat.mtime.getTime() > maxAgeMs) {
          await fs.unlink(filePath);
          console.log('[cache-cleanup] removed:', filePath);
        }
      } catch (err) {
        // ignore per-file errors
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[cache-cleanup] scan error:', err);
  }
}

async function scanAllProjects(workspaceRoot, maxAgeMs) {
  const projectsDir = path.join(workspaceRoot, 'projects');
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await scanAndCleanProject(path.join(projectsDir, entry.name), maxAgeMs);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[cache-cleanup] scan projects error:', err);
  }
}

function alignToNextInterval(intervalMs) {
  const now = Date.now();
  return intervalMs - (now % intervalMs);
}

function startCacheCleanup(workspaceRoot, options = {}) {
  const intervalMs = options.intervalMs || 10 * 60 * 1000;
  const maxAgeMs = options.maxAgeMs || 60 * 60 * 1000;

  // Align to 10-minute boundary (00:00, 00:10, 00:20...)
  const delay = alignToNextInterval(intervalMs);

  let timer = null;
  const run = () => scanAllProjects(workspaceRoot, maxAgeMs);

  const timeoutId = setTimeout(() => {
    run();
    timer = setInterval(run, intervalMs);
  }, delay);

  return {
    stop: () => {
      clearTimeout(timeoutId);
      if (timer) clearInterval(timer);
    }
  };
}

module.exports = { handleDeleteCacheFile, startCacheCleanup };
