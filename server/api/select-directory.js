const { execSync } = require('child_process');

function handleSelectDirectory(req, res) {
  try {
    let stdout = '';

    if (process.platform === 'darwin') {
      // macOS: use osascript (AppleScript) — built-in, no extra deps
      stdout = execSync(
        `osascript -e 'POSIX path of (choose folder with prompt "选择包含 HTML 文件的目录")'`,
        { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
      ).trim();
    } else if (process.platform === 'win32') {
      // Windows: use PowerShell + FolderBrowserDialog
      stdout = execSync(
        'powershell -NoProfile -Command ' +
        '"Add-Type -AssemblyName System.Windows.Forms; ' +
        '$d = New-Object System.Windows.Forms.FolderBrowserDialog; ' +
        '$d.Description = \'选择包含 HTML 文件的目录\'; ' +
        '$d.ShowNewFolderButton = $false; ' +
        'if ($d.ShowDialog() -eq \'OK\') { $d.SelectedPath }"',
        { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
      ).trim();
    } else {
      // Linux: try zenity first, then kdialog
      try {
        stdout = execSync(
          'zenity --file-selection --directory --title="选择 HTML 目录"',
          { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
        ).trim();
      } catch {
        stdout = execSync(
          'kdialog --getexistingdirectory',
          { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
        ).trim();
      }
    }

    // Empty stdout means user cancelled
    const selectedPath = stdout || null;

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: { path: selectedPath } }));
  } catch (err) {
    // Command not found or user cancelled (cancelled = non-zero exit for zenity/kdialog)
    // Check if it looks like a "not found" error
    const msg = err.message || '';
    const isNotFound =
      msg.includes('command not found') ||
      msg.includes('not recognized') ||
      msg.includes('ENOENT');

    if (isNotFound) {
      let hint = '';
      if (process.platform === 'darwin') {
        hint = 'macOS 内置支持，不应出现此错误';
      } else if (process.platform === 'win32') {
        hint = '请确保 PowerShell 可用（Windows 内置）';
      } else {
        hint = '请安装 zenity (sudo apt install zenity) 或 kdialog';
      }
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: '无法打开目录选择器：' + hint }));
      return;
    }

    // User cancelled (exit code 1 for zenity/kdialog) — return null path gracefully
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: { path: null } }));
  }
}

module.exports = {
  handleSelectDirectory,
  routes: [
    { method: 'GET', path: '/api/select-directory', handler: handleSelectDirectory }
  ]
};
