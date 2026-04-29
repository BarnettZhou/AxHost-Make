const { spawn, execSync } = require('child_process');
const path = require('path');

function findWindowsShell() {
  const candidates = ['pwsh', 'powershell'];
  for (const cmd of candidates) {
    try {
      execSync(`where ${cmd}`, { stdio: 'ignore', timeout: 3000 });
      return cmd;
    } catch {}
  }
  return null;
}

function findMacTerminal() {
  try {
    execSync('which osascript', { stdio: 'ignore', timeout: 3000 });
    return 'osascript';
  } catch {}
  return null;
}

async function handleOpenTerminal(req, res, workspaceRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const projectId = url.searchParams.get('project');
      if (!projectId) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'project is required' }));
        return;
      }

      const projectPath = path.join(workspaceRoot, 'projects', projectId);

      if (process.platform === 'win32') {
        const shell = findWindowsShell();
        if (!shell) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, message: '未找到 PowerShell（pwsh / powershell），请确认已安装' }));
          return;
        }
        // 打开新窗口并 cd 到项目目录
        spawn('cmd.exe', ['/c', 'start', shell, '-NoExit', '-Command', `cd "${projectPath}"`], {
          detached: true,
          windowsHide: false
        });
      } else {
        const terminal = findMacTerminal();
        if (!terminal) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, message: '未找到终端工具（osascript）' }));
          return;
        }
        spawn('osascript', ['-e', `tell application "Terminal" to do script "cd '${projectPath}'"`], {
          detached: true
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { projectPath } }));

    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleOpenTerminal };
