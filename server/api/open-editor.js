const { spawn } = require('child_process');
const path = require('path');

async function handleOpenEditor(req, res, workspaceRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { editor } = JSON.parse(body || '{}');
      if (!editor || !['vscode', 'cursor'].includes(editor)) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'editor must be "vscode" or "cursor"' }));
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
      const command = editor === 'vscode' ? 'code' : 'cursor';

      const child = spawn(command, [projectPath], { shell: true, detached: true });
      let errorOutput = '';

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 500, message: `Failed to launch ${command}: ${err.message}` }));
      });

      // Give it a short time to fail; if it hasn't, assume success
      setTimeout(() => {
        if (!res.writableEnded) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 0, data: { editor, projectPath } }));
        }
      }, 300);

    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleOpenEditor };
