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
  const projectTplRoot = path.join(templateRoot, 'project');

  // index.html / start.html / shell-resources 由框架 /client/ 统一提供，不再复制到项目

  // Clean up legacy shell-resources if exists from old version
  const legacyShellRes = path.join(projectRoot, 'prototype', 'shell-resources');
  if (await exists(legacyShellRes)) {
    await fs.rm(legacyShellRes, { recursive: true, force: true });
    console.log('  - Removed legacy prototype/shell-resources/');
  }

  // Clean up legacy index.html if exists (now served from framework)
  const legacyIndex = path.join(projectRoot, 'prototype', 'index.html');
  if (await exists(legacyIndex)) {
    await fs.unlink(legacyIndex);
    console.log('  - Removed legacy prototype/index.html');
  }
  const legacyStart = path.join(projectRoot, 'prototype', 'start.html');
  if (await exists(legacyStart)) {
    await fs.unlink(legacyStart);
  }
  const legacyIcon = path.join(projectRoot, 'prototype', 'icon.svg');
  if (await exists(legacyIcon)) {
    await fs.unlink(legacyIcon);
  }

  // Copy AGENTS.md
  const agentsSrc = path.join(projectTplRoot, 'AGENTS.md');
  const agentsDest = path.join(projectRoot, 'AGENTS.md');
  if (await exists(agentsSrc)) {
    await fs.copyFile(agentsSrc, agentsDest);
    console.log('  - Updated AGENTS.md');
  }

  // Copy CLAUDE.md
  const claudeSrc = path.join(projectTplRoot, 'CLAUDE.md');
  const claudeDest = path.join(projectRoot, 'CLAUDE.md');
  if (await exists(claudeSrc)) {
    await fs.copyFile(claudeSrc, claudeDest);
    console.log('  - Updated CLAUDE.md');
  }

  // Copy rules/design.md if not exists (user-maintained, don't overwrite)
  const designMdSrc = path.join(projectTplRoot, 'rules', 'design.md');
  const designMdDest = path.join(projectRoot, 'rules', 'design.md');
  if (await exists(designMdSrc) && !await exists(designMdDest)) {
    await fs.copyFile(designMdSrc, designMdDest);
    console.log('  - Created rules/design.md');
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
