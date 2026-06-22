const fs = require('fs/promises');
const path = require('path');
const { readSitemap, writeSitemap } = require('../lib/sitemap-io.js');

async function readMeta(absPath) {
  try {
    const content = await fs.readFile(path.join(absPath, '.axhost-meta.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeMeta(absPath, meta) {
  await fs.writeFile(
    path.join(absPath, '.axhost-meta.json'),
    JSON.stringify(meta, null, 2) + '\n',
    'utf-8'
  );
}

// Find a node by id anywhere in the tree.
function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Whether `id` exists within `node`'s subtree (including node itself).
function isInSubtree(node, id) {
  if (node.id === id) return true;
  if (node.children) {
    for (const c of node.children) {
      if (isInSubtree(c, id)) return true;
    }
  }
  return false;
}

// Remove a node by id from the tree, returning the detached node (or null).
function removeNode(nodes, id) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      return nodes.splice(i, 1)[0];
    }
    if (nodes[i].children) {
      const removed = removeNode(nodes[i].children, id);
      if (removed) return removed;
    }
  }
  return null;
}

// Rebuild the flat _map so it always matches the tree structure.
function rebuildFlatMap(sitemap) {
  const map = {};
  function walk(nodes, tab) {
    for (const n of nodes) {
      if (n.id) {
        map[n.id] = { name: n.name, type: n.type, path: `${tab}/${n.path}` };
      }
      if (n.children) walk(n.children, tab);
    }
  }
  walk(sitemap.pages || [], 'pages');
  walk(sitemap.components || [], 'components');
  walk(sitemap.flowcharts || [], 'flowcharts');
  sitemap._map = map;
}

function getTab(p) {
  return p.includes('flowcharts') ? 'flowcharts' : p.includes('components') ? 'components' : 'pages';
}

function badRequest(res, message) {
  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ code: 400, message }));
}

async function handleMove(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      const { sourcePath, type } = payload;
      // parentPath: destination parent id ('' = top level)
      // anchorPath: sibling id to insert AFTER ('' = insert at index 0 of the parent)
      const parentPath = payload.parentPath || '';
      const anchorPath = payload.anchorPath || '';

      if (!sourcePath || sourcePath.includes('..') || parentPath.includes('..') || anchorPath.includes('..')) {
        return badRequest(res, 'Invalid parameters');
      }

      const tab = type || getTab(sourcePath);
      const prefix = `prototype/${tab}/`;
      const resolvedSource = sourcePath.startsWith('prototype/') ? sourcePath : prefix + sourcePath;
      const sourceAbs = path.resolve(projectRoot, resolvedSource);
      if (!sourceAbs.startsWith(path.resolve(projectRoot))) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
        return;
      }

      const sourceId = path.basename(resolvedSource);
      const parentId = parentPath ? path.basename(parentPath) : '';
      let anchorId = anchorPath ? path.basename(anchorPath) : '';
      if (anchorId === sourceId) anchorId = '';

      const sitemap = await readSitemap(projectRoot);
      const tree = sitemap[tab] || [];

      // Locate source node.
      const sourceNode = findNode(tree, sourceId);
      if (!sourceNode) return badRequest(res, 'Source not found');

      // Validate destination parent (must exist and must NOT be inside the source subtree).
      if (parentId) {
        if (parentId === sourceId || isInSubtree(sourceNode, parentId)) {
          return badRequest(res, '不能移动到自身或其子级下');
        }
        if (!findNode(tree, parentId)) {
          return badRequest(res, 'Target parent not found');
        }
      }

      // Detach the source from its current location.
      removeNode(tree, sourceId);

      // Resolve the destination array (root list or a parent's children).
      let destArray;
      if (!parentId) {
        destArray = tree;
      } else {
        const parentNode = findNode(tree, parentId);
        if (!parentNode) {
          // Should not happen (validated above), restore and abort.
          return badRequest(res, 'Target parent not found');
        }
        if (!parentNode.children) parentNode.children = [];
        destArray = parentNode.children;
      }

      // Compute insertion index from the anchor sibling.
      let insertIdx = 0;
      if (anchorId) {
        const idx = destArray.findIndex(n => n.id === anchorId);
        insertIdx = idx === -1 ? destArray.length : idx + 1;
      }
      sourceNode.parentId = parentId || null;
      destArray.splice(insertIdx, 0, sourceNode);

      // Keep the physical meta's parentId in sync (dirs are flat; hierarchy is logical).
      try {
        await fs.access(path.join(sourceAbs, '.axhost-meta.json'));
        const sourceMeta = await readMeta(sourceAbs);
        sourceMeta.parentId = parentId || '';
        await writeMeta(sourceAbs, sourceMeta);
      } catch {}

      // Rebuild _map so it never drifts from the tree.
      rebuildFlatMap(sitemap);

      await writeSitemap(projectRoot, sitemap);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { id: sourceId, parentId: parentId || null } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleMove,
  routes: [
    { method: 'POST', path: '/api/move', handler: handleMove, scope: 'project' }
  ]
};
