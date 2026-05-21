// Route aggregation: each api/*.js exports its own routes[] metadata.
// This file imports all modules, collects their routes, and exports
// two lookup maps (keyed by "METHOD:path") plus a set identifying
// which workspace routes need workspaceRoot.
//
// To add a new API endpoint:
//   1. Create server/api/new.js with handler + routes[] export
//   2. Add `require('./api/new.js')` in modules[] below
// That's it — no changes needed in router.js or anywhere else.

const modules = [
  require('./api/projects.js'),
  require('./api/project-info.js'),
  require('./api/export.js'),
  require('./api/open-editor.js'),
  require('./api/terminal.js'),
  require('./api/axhost-proxy.js'),
  require('./api/scan.js'),
  require('./api/file.js'),
  require('./api/create.js'),
  require('./api/rename.js'),
  require('./api/page-type.js'),
  require('./api/delete.js'),
  require('./api/settings.js'),
  require('./api/docs.js'),
  require('./api/reorder.js'),
  require('./api/move.js'),
  require('./api/copy.js'),
  require('./api/export-component.js'),
  require('./api/prompt-upload.js'),
  require('./api/images.js'),
  require('./api/cache-cleanup.js'),
];

const workspaceRoutes = {};      // key → handler (req, res, workspaceRoot?) — scope: workspace|none
const workspaceWithRoot = new Set(); // keys that need workspaceRoot (scope: workspace)
const projectRoutes = {};        // key → handler (req, res, projectRoot) — scope: project

for (const mod of modules) {
  for (const r of (mod.routes || [])) {
    const key = `${r.method}:${r.path}`;
    if (r.scope === 'project') {
      projectRoutes[key] = r.handler;
    } else {
      workspaceRoutes[key] = r.handler;
      if (r.scope === 'workspace') {
        workspaceWithRoot.add(key);
      }
    }
  }
}

module.exports = { workspaceRoutes, workspaceWithRoot, projectRoutes };
