const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');
const { generateId } = require('../lib/ids.js');
const { init } = require('../../bin/axhost-init.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function getProjectsDir(workspaceRoot) {
  return path.join(workspaceRoot, 'projects');
}

function getProjectsMetaPath(workspaceRoot) {
  return path.join(getProjectsDir(workspaceRoot), '.projects.json');
}

async function readProjectsMeta(workspaceRoot) {
  const metaPath = getProjectsMetaPath(workspaceRoot);
  try {
    const content = await fs.readFile(metaPath, 'utf-8');
    const data = JSON.parse(content);
    return data.projects || [];
  } catch (e) {
    return [];
  }
}

async function writeProjectsMeta(workspaceRoot, projects) {
  const metaPath = getProjectsMetaPath(workspaceRoot);
  await fs.writeFile(metaPath, JSON.stringify({ projects }, null, 2) + '\n', 'utf-8');
}

/**
 * 校验项目是否符合 AxHost-Make 格式：
 * - prototype/sitemap.js 存在
 * - 文件内容包含 window.__axhostSitemap
 */
async function validateAxhostProject(projectRoot) {
  const sitemapPath = path.join(projectRoot, 'prototype', 'sitemap.js');
  if (!await exists(sitemapPath)) return false;
  try {
    const content = await fs.readFile(sitemapPath, 'utf-8');
    return content.includes('window.__axhostSitemap');
  } catch (e) {
    return false;
  }
}

function gitClone(repoUrl, targetDir) {
  return new Promise((resolve, reject) => {
    exec(`git clone "${repoUrl}" "${targetDir}"`, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve(stdout || stderr);
      }
    });
  });
}

function unzipFile(zipPath, targetDir) {
  return new Promise((resolve, reject) => {
    exec(`unzip -o "${zipPath}" -d "${targetDir}"`, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve(stdout || stderr);
      }
    });
  });
}

// POST /api/projects/import — 从 Git 仓库导入
async function handleProjectsImport(req, res, workspaceRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { name, gitUrl } = JSON.parse(body || '{}');
      if (!name || !name.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: '项目名称不能为空' }));
        return;
      }
      if (!gitUrl || !gitUrl.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Git 仓库地址不能为空' }));
        return;
      }

      const projectsDir = getProjectsDir(workspaceRoot);
      await fs.mkdir(projectsDir, { recursive: true });

      const metas = await readProjectsMeta(workspaceRoot);
      const existingIds = new Set(metas.map(m => m.id.toLowerCase()));
      const id = generateId(name.trim(), existingIds);
      const projectRoot = path.join(projectsDir, id);

      // git clone
      try {
        await gitClone(gitUrl.trim(), projectRoot);
      } catch (cloneErr) {
        try { await fs.rm(projectRoot, { recursive: true, force: true }); } catch (e) {}
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 500, message: 'Git clone 失败: ' + cloneErr.message }));
        return;
      }

      // 校验格式
      if (!await validateAxhostProject(projectRoot)) {
        await fs.rm(projectRoot, { recursive: true, force: true });
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: '该仓库非 AxHost-Make 原型项目，请检查' }));
        return;
      }

      // 补充脚手架文件（不覆盖已有文件）
      try {
        await init(projectRoot);
      } catch (initErr) {
        console.warn('Project init warning:', initErr.message);
      }

      // 加入项目列表
      const now = new Date().toISOString();
      metas.push({
        id,
        name: name.trim(),
        createdAt: now,
        lastModified: now
      });
      await writeProjectsMeta(workspaceRoot, metas);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { id, name: name.trim() } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

// POST /api/projects/import-zip — 从 ZIP 文件导入
async function handleProjectsImportZip(req, res, workspaceRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    let tmpZipPath = null;
    try {
      const { name, data } = JSON.parse(body || '{}');
      if (!name || !name.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: '项目名称不能为空' }));
        return;
      }
      if (!data || typeof data !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'ZIP 文件数据不能为空' }));
        return;
      }

      // 解析 base64（支持 data URL 前缀）
      let base64Data = data;
      const dataUrlMatch = data.match(/^data:[^;]+;base64,(.+)$/i);
      if (dataUrlMatch) {
        base64Data = dataUrlMatch[1];
      }

      const projectsDir = getProjectsDir(workspaceRoot);
      await fs.mkdir(projectsDir, { recursive: true });

      const metas = await readProjectsMeta(workspaceRoot);
      const existingIds = new Set(metas.map(m => m.id.toLowerCase()));
      const id = generateId(name.trim(), existingIds);
      const projectRoot = path.join(projectsDir, id);

      // 将 base64 写入临时 zip 文件
      tmpZipPath = path.join(projectsDir, `${id}.zip`);
      await fs.writeFile(tmpZipPath, Buffer.from(base64Data, 'base64'));

      // 解压
      try {
        await unzipFile(tmpZipPath, projectRoot);
      } catch (unzipErr) {
        // 清理
        try { await fs.rm(projectRoot, { recursive: true, force: true }); } catch (e) {}
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 500, message: 'ZIP 解压失败: ' + unzipErr.message }));
        return;
      }

      // 展平多余嵌套目录：过滤掉 __MACOSX 等元数据目录后，
      // 如果 projectRoot 下只有一个目录且无其他文件，将其内容上移
      try {
        const IGNORE_DIRS = new Set(['__MACOSX', '.DS_Store']);
        const rootEntries = await fs.readdir(projectRoot, { withFileTypes: true });
        const dirs = rootEntries.filter(e => e.isDirectory() && !IGNORE_DIRS.has(e.name));
        const files = rootEntries.filter(e => !e.isDirectory() && !IGNORE_DIRS.has(e.name));
        if (dirs.length === 1 && files.length === 0) {
          const nestedDir = path.join(projectRoot, dirs[0].name);
          const nestedEntries = await fs.readdir(nestedDir, { withFileTypes: true });
          for (const entry of nestedEntries) {
            const src = path.join(nestedDir, entry.name);
            const dest = path.join(projectRoot, entry.name);
            await fs.rename(src, dest);
          }
          await fs.rm(nestedDir, { recursive: true, force: true });
        }
        // 清理残留的元数据目录
        for (const entry of rootEntries) {
          if (IGNORE_DIRS.has(entry.name)) {
            try { await fs.rm(path.join(projectRoot, entry.name), { recursive: true, force: true }); } catch (e) {}
          }
        }
      } catch (e) {
        // 展平失败不阻塞
        console.warn('Flatten warning:', e.message);
      }

      // 校验格式
      if (!await validateAxhostProject(projectRoot)) {
        await fs.rm(projectRoot, { recursive: true, force: true });
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: '该文件非 AxHost-Make 原型文件，请检查' }));
        return;
      }

      // 补充脚手架文件
      try {
        await init(projectRoot);
      } catch (initErr) {
        console.warn('Project init warning:', initErr.message);
      }

      // 加入项目列表
      const now = new Date().toISOString();
      metas.push({
        id,
        name: name.trim(),
        createdAt: now,
        lastModified: now
      });
      await writeProjectsMeta(workspaceRoot, metas);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { id, name: name.trim() } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    } finally {
      // 清理临时 zip 文件
      if (tmpZipPath) {
        try { await fs.unlink(tmpZipPath); } catch (e) {}
      }
    }
  });
}

// GET /api/workspace-info — 返回工作空间和框架目录的绝对路径
async function handleWorkspaceInfo(req, res, workspaceRoot) {
  const axhostMakeRoot = path.resolve(__dirname, '../../');
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    code: 0,
    data: {
      workspaceRoot: path.resolve(workspaceRoot),
      axhostMakeRoot
    }
  }));
}

module.exports = {
  handleProjectsImport,
  handleProjectsImportZip,
  handleWorkspaceInfo,
  routes: [
    { method: 'POST', path: '/api/projects/import', handler: handleProjectsImport, scope: 'workspace' },
    { method: 'POST', path: '/api/projects/import-zip', handler: handleProjectsImportZip, scope: 'workspace' },
    { method: 'GET', path: '/api/workspace-info', handler: handleWorkspaceInfo, scope: 'workspace' },
  ]
};
