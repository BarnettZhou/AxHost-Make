const path = require('path');
const { execSync } = require('child_process');

function commandExists(cmd) {
  try {
    const check = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    execSync(check, { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch { return false; }
}

function isWsl() {
  if (process.platform !== 'linux') return false;
  try {
    const fs = require('fs');
    const v = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return v.includes('microsoft') || v.includes('wsl');
  } catch { return false; }
}

async function handleProjectInfoGet(req, res, workspaceRoot) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 400, message: 'projectId is required' }));
      return;
    }

    const projectAbsolutePath = path.join(workspaceRoot, 'projects', projectId);
    const projectRelativeDir = path.join('projects', projectId);

    const editors = [];
    if (commandExists('code')) editors.push('vscode');
    if (commandExists('cursor')) editors.push('cursor');
    if (commandExists('trae')) editors.push('trae');

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 0,
      data: {
        projectId,
        projectRelativeDir,
        projectAbsolutePath,
        platform: process.platform,
        isWsl: isWsl(),
        hasWsl: process.platform === 'win32' && commandExists('wsl'),
        editors
      }
    }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
}

module.exports = { handleProjectInfoGet,
  routes: [
    { method: 'GET', path: '/api/project-info', handler: handleProjectInfoGet, scope: 'workspace' }
  ]
};
