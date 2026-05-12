const { spawn, execSync } = require('child_process');
const path = require('path');

function isWsl() {
  if (process.platform !== 'linux') return false;
  try {
    const fs = require('fs');
    const v = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return v.includes('microsoft') || v.includes('wsl');
  } catch { return false; }
}

function commandExists(cmd) {
  try {
    const check = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    execSync(check, { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch { return false; }
}

function findWindowsShell() {
  const candidates = ['pwsh', 'powershell'];
  for (const cmd of candidates) {
    if (commandExists(cmd)) return cmd;
  }
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
      const platform = process.platform;
      const wsl = isWsl();

      if (wsl) {
        // WSL 环境：通过 Windows Interop 打开 WSL 终端
        if (!commandExists('wsl.exe')) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, message: '未找到 wsl.exe，WSL Interop 可能未启用' }));
          return;
        }
        spawn('cmd.exe', ['/c', 'start', 'wsl.exe', '--cd', projectPath], {
          detached: true,
          windowsHide: false
        });
      } else if (platform === 'win32') {
        // Windows：使用 PowerShell
        const shell = findWindowsShell();
        if (!shell) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, message: '未找到 PowerShell（pwsh / powershell），请确认已安装' }));
          return;
        }
        spawn('cmd.exe', ['/c', 'start', shell, '-NoExit', '-Command', `cd "${projectPath}"`], {
          detached: true,
          windowsHide: false
        });
      } else if (platform === 'darwin') {
        // macOS：使用 Terminal.app
        if (!commandExists('osascript')) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, message: '未找到终端工具（osascript）' }));
          return;
        }
        spawn('osascript', ['-e', `tell application "Terminal" to do script "cd '${projectPath}'"`], {
          detached: true
        });
      } else {
        // 原生 Linux：尝试常见终端模拟器
        const terminals = [
          { cmd: 'gnome-terminal', args: ['--working-directory', projectPath] },
          { cmd: 'konsole', args: ['--workdir', projectPath] },
          { cmd: 'xfce4-terminal', args: ['--working-directory', projectPath] },
          { cmd: 'alacritty', args: ['--working-directory', projectPath] },
          { cmd: 'xterm', args: ['-e', `cd "${projectPath}" && bash`] }
        ];
        let opened = false;
        for (const t of terminals) {
          if (commandExists(t.cmd)) {
            spawn(t.cmd, t.args, { detached: true });
            opened = true;
            break;
          }
        }
        if (!opened) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, message: '未找到可用的终端模拟器（gnome-terminal / konsole / xterm 等）' }));
          return;
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { projectPath, platform, wsl } }));

    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

function winToWslPath(p) {
  const m = p.match(/^([A-Za-z]):\\(.+)$/);
  if (!m) return p.replace(/\\/g, '/');
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`;
}

async function handleOpenWslTerminal(req, res, workspaceRoot) {
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
      const wslPath = winToWslPath(projectPath);

      if (!commandExists('wsl')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: '未找到 wsl 命令，请确认 WSL 已安装' }));
        return;
      }

      spawn('wsl.exe', ['--cd', wslPath], {
        detached: true,
        windowsHide: false
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { projectPath, wslPath } }));

    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleOpenTerminal, handleOpenWslTerminal };
