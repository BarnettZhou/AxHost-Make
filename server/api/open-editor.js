const { spawn, execSync } = require('child_process');
const path = require('path');

function commandExists(cmd) {
  try {
    const check = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    execSync(check, { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function handleOpenEditor(req, res, workspaceRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { editor } = JSON.parse(body || '{}');
      if (!editor || !['vscode', 'cursor', 'trae'].includes(editor)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'editor must be "vscode", "cursor" or "trae"' }));
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      const projectId = url.searchParams.get('project');
      if (!projectId) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'project is required' }));
        return;
      }

      const projectPath = path.join(workspaceRoot, 'projects', projectId);
      const command = { vscode: 'code', cursor: 'cursor', trae: 'trae' }[editor];

      if (!commandExists(command)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: `${command} 命令未找到，请确认 ${editor} 已安装并添加到系统 PATH` }));
        return;
      }

      const child = spawn(command, [projectPath], { windowsHide: true });
      child.unref();

      child.on('error', (err) => {
        if (!res.writableEnded) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, message: `Failed to launch ${command}: ${err.message}` }));
        }
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { editor, projectPath } }));

    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleOpenEditor };
