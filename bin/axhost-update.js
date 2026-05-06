#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const { regenerateSitemap } = require('../server/api/sitemap.js');
const { ensureIdsForTree } = require('../server/lib/ids.js');
const { syncStartScripts } = require('./axhost-init.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function scanDirs(dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const childPath = path.join(dir, entry.name);
    const hasIndex = await exists(path.join(childPath, 'index.html'));
    if (hasIndex) {
      results.push(childPath);
    } else {
      const nested = await scanDirs(childPath);
      results.push(...nested);
    }
  }
  return results;
}

async function ensurePageResources(projectRoot) {
  let created = 0;
  for (const type of ['pages', 'components', 'flowcharts']) {
    const baseDir = path.join(projectRoot, 'prototype', type);
    if (!await exists(baseDir)) continue;
    const dirs = await scanDirs(baseDir);
    for (const dir of dirs) {
      const cssPath = path.join(dir, 'resources', 'css', 'style.css');
      const jsPath = path.join(dir, 'resources', 'js', 'main.js');
      if (!await exists(cssPath)) {
        await fs.mkdir(path.dirname(cssPath), { recursive: true });
        await fs.writeFile(cssPath, '', 'utf-8');
        created++;
      }
      if (!await exists(jsPath)) {
        await fs.mkdir(path.dirname(jsPath), { recursive: true });
        await fs.writeFile(jsPath, '', 'utf-8');
        created++;
      }
    }
  }
  if (created > 0) {
    console.log(`  - Created ${created} missing resource file(s) (style.css / main.js)`);
  }
}

async function updateSingleProject(projectRoot) {
  const templateRoot = path.resolve(__dirname, '../templates');
  const previewTplRoot = path.join(templateRoot, 'preview');
  const projectTplRoot = path.join(templateRoot, 'project');

  // Update prototype/index.html
  const protoIndexPath = path.join(projectRoot, 'prototype', 'index.html');
  const tplPath = path.join(previewTplRoot, 'index.html');
  if (await exists(tplPath)) {
    await fs.copyFile(tplPath, protoIndexPath);
    console.log('  - Updated prototype/index.html');
  }

  // Ensure start.html exists
  const protoStartPath = path.join(projectRoot, 'prototype', 'start.html');
  if (!await exists(protoStartPath)) {
    const startTpl = path.join(previewTplRoot, 'start.html');
    if (await exists(startTpl)) {
      await fs.copyFile(startTpl, protoStartPath);
      console.log('  - Created prototype/start.html');
    }
  }

  // Copy marked.min.js
  const markedSrc = path.resolve(__dirname, '../client/assets/marked.min.js');
  const markedDest = path.join(projectRoot, 'prototype/resources/js/marked.min.js');
  if (await exists(markedSrc)) {
    await fs.mkdir(path.dirname(markedDest), { recursive: true });
    await fs.copyFile(markedSrc, markedDest);
    console.log('  - Updated prototype/resources/js/marked.min.js');
  }

  // Copy mermaid.min.js only if project has flowcharts
  async function hasFlowcharts(root) {
    const flowchartsDir = path.join(root, 'prototype', 'flowcharts');
    if (!await exists(flowchartsDir)) return false;
    const entries = await fs.readdir(flowchartsDir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const metaPath = path.join(flowchartsDir, e.name, '.axhost-meta.json');
      try {
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        if (meta.kind === 'flowchart') return true;
      } catch (e) {}
    }
    return false;
  }
  const mermaidSrc = path.join(projectTplRoot, 'resources/js/mermaid.min.js');
  const mermaidDest = path.join(projectRoot, 'prototype/resources/js/mermaid.min.js');
  if (await hasFlowcharts(projectRoot)) {
    if (await exists(mermaidSrc)) {
      await fs.mkdir(path.dirname(mermaidDest), { recursive: true });
      await fs.copyFile(mermaidSrc, mermaidDest);
      console.log('  - Updated prototype/resources/js/mermaid.min.js');
    }
  } else if (await exists(mermaidDest)) {
    await fs.unlink(mermaidDest);
    console.log('  - Removed prototype/resources/js/mermaid.min.js (no flowcharts)');
  }

  // Copy icons.js
  const iconsSrc = path.resolve(__dirname, '../client/js/icons.js');
  const iconsDest = path.join(projectRoot, 'prototype/resources/js/icons.js');
  if (await exists(iconsSrc)) {
    await fs.mkdir(path.dirname(iconsDest), { recursive: true });
    await fs.copyFile(iconsSrc, iconsDest);
    console.log('  - Updated prototype/resources/js/icons.js');
  }

  // Copy shell.css
  const cssSrc = path.resolve(__dirname, '../client/css/shell.css');
  const cssDest = path.join(projectRoot, 'prototype/resources/css/shell.css');
  if (await exists(cssSrc)) {
    await fs.mkdir(path.dirname(cssDest), { recursive: true });
    await fs.copyFile(cssSrc, cssDest);
    console.log('  - Updated prototype/resources/css/shell.css');
  }

  // Copy preview-app.js
  const previewAppSrc = path.resolve(__dirname, '../client/js/preview-app.js');
  const previewAppDest = path.join(projectRoot, 'prototype/resources/js/preview-app.js');
  if (await exists(previewAppSrc)) {
    await fs.mkdir(path.dirname(previewAppDest), { recursive: true });
    await fs.copyFile(previewAppSrc, previewAppDest);
    console.log('  - Updated prototype/resources/js/preview-app.js');
  }

  // Copy icon.svg
  const iconSrc = path.join(previewTplRoot, 'icon.svg');
  const iconDest = path.join(projectRoot, 'prototype', 'icon.svg');
  if (await exists(iconSrc)) {
    await fs.copyFile(iconSrc, iconDest);
    console.log('  - Updated prototype/icon.svg');
  }

  // Copy agents.md
  const agentsSrc = path.join(projectTplRoot, 'agents.md');
  const agentsDest = path.join(projectRoot, 'agents.md');
  if (await exists(agentsSrc)) {
    await fs.copyFile(agentsSrc, agentsDest);
    console.log('  - Updated agents.md');
  }

  // Copy CLAUDE.md
  const claudeSrc = path.join(projectTplRoot, 'CLAUDE.md');
  const claudeDest = path.join(projectRoot, 'CLAUDE.md');
  if (await exists(claudeSrc)) {
    await fs.copyFile(claudeSrc, claudeDest);
    console.log('  - Updated CLAUDE.md');
  }

  // Copy project resources (e.g. flowchart viewer)
  const resourcesSrcDir = path.join(projectTplRoot, 'resources');
  const resourcesDestDir = path.join(projectRoot, 'prototype', 'resources');
  async function copyDir(src, dest) {
    const entries = await fs.readdir(src, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name === 'mermaid.min.js') continue;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await copyDir(srcPath, destPath);
      } else {
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
  if (await exists(resourcesSrcDir)) {
    await copyDir(resourcesSrcDir, resourcesDestDir);
    console.log('  - Updated prototype/resources/');
  }

  // Ensure missing page resources
  await ensurePageResources(projectRoot);

  // Regenerate sitemap while preserving project name
  await regenerateSitemap(projectRoot);
  console.log('  - Regenerated prototype/sitemap.js');

  console.log('Axhost-Make project updated successfully.');
}

async function resolveWorkspaceRoot(currentDir) {
  let workspaceRoot = currentDir;
  while (workspaceRoot !== path.dirname(workspaceRoot)) {
    if (await exists(path.join(workspaceRoot, 'axhost-make'))) {
      break;
    }
    workspaceRoot = path.dirname(workspaceRoot);
  }
  return workspaceRoot;
}

async function update(currentDir, options = {}) {
  const workspaceRoot = await resolveWorkspaceRoot(currentDir);
  const projectsDir = path.join(workspaceRoot, 'projects');

  if (options.all) {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true }).catch(() => []);
    let updated = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const childPath = path.join(projectsDir, entry.name);
      if (await exists(path.join(childPath, 'prototype'))) {
        console.log(`\n[${entry.name}]`);
        try {
          await updateSingleProject(childPath);
          updated++;
        } catch (err) {
          console.error(`  - Update failed: ${err.message}`);
        }
      }
    }
    console.log(`\nTotal ${updated} project(s) updated.`);
    await syncStartScripts(workspaceRoot);
    return;
  }

  if (options.id) {
    const projectPath = path.join(projectsDir, options.id);
    if (!await exists(projectPath)) {
      console.error(`Project ${options.id} not found.`);
      process.exit(1);
    }
    if (!await exists(path.join(projectPath, 'prototype'))) {
      console.error(`Project ${options.id} does not have a prototype directory.`);
      process.exit(1);
    }
    await updateSingleProject(projectPath);
    return;
  }

  console.error('Usage: axhost-make update --all | --id <hash>');
  process.exit(1);
}

module.exports = { update };

if (require.main === module) {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const idIndex = args.indexOf('--id');
  const id = idIndex !== -1 && args[idIndex + 1] ? args[idIndex + 1] : null;

  if (!isAll && !id) {
    console.error('Usage: axhost-make update --all | --id <hash>');
    process.exit(1);
  }

  const projectRoot = process.cwd();
  update(projectRoot, { all: isAll, id }).catch(err => {
    console.error('Update failed:', err);
    process.exit(1);
  });
}
