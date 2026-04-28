const fs = require('fs/promises');
const path = require('path');
const { readSitemap, writeSitemap } = require('../lib/sitemap-io.js');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

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

function findParentArray(nodes, id, parentRef) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      parentRef.arr = nodes;
      parentRef.idx = i;
      return true;
    }
    if (nodes[i].children) {
      if (findParentArray(nodes[i].children, id, parentRef)) return true;
    }
  }
  return false;
}

function removeNode(nodes, id) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      const removed = nodes.splice(i, 1)[0];
      return removed;
    }
    if (nodes[i].children) {
      const removed = removeNode(nodes[i].children, id);
      if (removed) return removed;
    }
  }
  return null;
}

async function handleMove(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { sourcePath, targetPath, type, position } = JSON.parse(body || '{}');
      if (!sourcePath || !targetPath || sourcePath.includes('..') || targetPath.includes('..')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Invalid parameters' }));
        return;
      }
      const prefix = type ? `prototype/${type}/` : '';
      const resolvedSource = sourcePath.startsWith('prototype/') ? sourcePath : prefix + sourcePath;
      const resolvedTarget = targetPath.startsWith('prototype/') ? targetPath : prefix + targetPath;
      const sourceAbs = path.resolve(projectRoot, resolvedSource);
      const targetAbs = path.resolve(projectRoot, resolvedTarget);
      if (!sourceAbs.startsWith(path.resolve(projectRoot)) || !targetAbs.startsWith(path.resolve(projectRoot))) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
        return;
      }

      const sourceName = path.basename(sourceAbs);
      const targetName = path.basename(targetAbs);
      function getTab(p) { return p.includes('flowcharts') ? 'flowcharts' : p.includes('components') ? 'components' : 'pages'; }
      const tab = type || getTab(resolvedSource);
      const sitemap = await readSitemap(projectRoot);
      const tree = sitemap[tab] || [];

      // before / after: reorder within the same parent array, or move across parents
      if (position === 'before' || position === 'after') {
        const sourceRef = {};
        const targetRef = {};
        findParentArray(tree, sourceName, sourceRef);
        findParentArray(tree, targetName, targetRef);

        if (!sourceRef.arr || !targetRef.arr) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, message: 'Source or target not found' }));
          return;
        }

        if (sourceRef.arr === targetRef.arr) {
          // Same parent: just reorder
          const arr = sourceRef.arr;
          const oldIdx = sourceRef.idx;
          let newIdx = targetRef.idx;
          const node = arr.splice(oldIdx, 1)[0];
          if (position === 'after') {
            if (newIdx > oldIdx) newIdx -= 1;
            newIdx += 1;
          }
          arr.splice(newIdx, 0, node);
        } else {
          // Different parents: move source into target's parent at the specified position
          const movedNode = sourceRef.arr.splice(sourceRef.idx, 1)[0];

          // Find target's parent id
          function findParentId(nodes, childId, parentId) {
            for (const n of nodes) {
              if (n.id === childId) return parentId;
              if (n.children) {
                const found = findParentId(n.children, childId, n.id);
                if (found !== undefined) return found;
              }
            }
            return undefined;
          }
          const targetParentId = findParentId(tree, targetName, null);
          movedNode.parentId = targetParentId;

          let newIdx = targetRef.idx;
          if (position === 'after') {
            newIdx += 1;
          }
          targetRef.arr.splice(newIdx, 0, movedNode);

          // Update meta
          try {
            await fs.access(path.join(sourceAbs, '.axhost-meta.json'));
            const sourceMeta = await readMeta(sourceAbs);
            sourceMeta.parentId = targetParentId;
            await writeMeta(sourceAbs, sourceMeta);
          } catch {}
        }

        await writeSitemap(projectRoot, sitemap);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 0, data: { newPath: sourceName } }));
        return;
      }

      // drop-into: change parentId in meta and move in sitemap tree
      const targetMeta = await readMeta(targetAbs);
      const targetHasIndex = await exists(path.join(targetAbs, 'index.html'));
      const targetKind = targetMeta.kind || (targetHasIndex ? 'page' : 'dir');
      if (targetKind !== 'dir') {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Target is not a directory' }));
        return;
      }

      // Update meta if physical dir exists
      try {
        await fs.access(path.join(sourceAbs, '.axhost-meta.json'));
        const sourceMeta = await readMeta(sourceAbs);
        sourceMeta.parentId = targetName;
        await writeMeta(sourceAbs, sourceMeta);
      } catch {}

      // Update sitemap: remove from current position, insert under target
      const movedNode = removeNode(tree, sourceName);
      if (movedNode) {
        movedNode.parentId = targetName;
        function insertUnderTarget(nodes) {
          for (const n of nodes) {
            if (n.id === targetName) {
              if (!n.children) n.children = [];
              n.children.push(movedNode);
              return true;
            }
            if (n.children && insertUnderTarget(n.children)) return true;
          }
          return false;
        }
        insertUnderTarget(tree);
      }

      await writeSitemap(projectRoot, sitemap);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { newPath: sourceName } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleMove };
