const fs = require('fs/promises');
const path = require('path');
const { readSitemap, writeSitemap } = require('../lib/sitemap-io.js');

function removeNodeFromTree(nodes, id) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      nodes.splice(i, 1);
      return true;
    }
    if (nodes[i].children && removeNodeFromTree(nodes[i].children, id)) {
      return true;
    }
  }
  return false;
}

function collectDescendantIds(nodes, parentId, result) {
  for (const node of nodes) {
    if (node.parentId === parentId) {
      result.push(node.id);
      if (node.children) {
        collectDescendantIds(node.children, node.id, result);
      }
    }
  }
}

async function handleDelete(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { path: targetPath } = JSON.parse(body || '{}');
      if (!targetPath || targetPath.includes('..')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 400, message: 'Invalid path' }));
        return;
      }
      const absPath = path.resolve(projectRoot, targetPath);
      if (!absPath.startsWith(path.resolve(projectRoot))) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 403, message: 'Forbidden path' }));
        return;
      }

      const tabPath = path.dirname(absPath);
      const id = path.basename(absPath);
      const tab = tabPath.endsWith('flowcharts') ? 'flowcharts' : tabPath.endsWith('components') ? 'components' : 'pages';

      // 1. Remove from sitemap (cascade: remove node and all descendants)
      const sitemap = await readSitemap(projectRoot);
      const tree = sitemap[tab] || [];

      // Collect all descendant ids from the tree
      function findNode(nodes, targetId) {
        for (const n of nodes) {
          if (n.id === targetId) return n;
          if (n.children) {
            const f = findNode(n.children, targetId);
            if (f) return f;
          }
        }
        return null;
      }
      const targetNode = findNode(tree, id);
      const idsToDelete = [id];
      if (targetNode && targetNode.children) {
        function collectIds(nodes) {
          for (const n of nodes) {
            idsToDelete.push(n.id);
            if (n.children) collectIds(n.children);
          }
        }
        collectIds(targetNode.children);
      }
      removeNodeFromTree(tree, id);

      // Clean up flat map
      if (sitemap._map) {
        for (const delId of idsToDelete) {
          delete sitemap._map[delId];
        }
      }
      await writeSitemap(projectRoot, sitemap);

      // 2. Remove physical files/directories (skip nodes that have no physical entry)
      for (const delId of idsToDelete) {
        const delPath = path.join(tabPath, delId);
        const delStat = await fs.stat(delPath).catch(() => null);
        if (delStat) {
          if (delStat.isDirectory()) {
            await fs.rm(delPath, { recursive: true, force: true });
          } else {
            await fs.unlink(delPath);
          }
        }
      }

      // 3. Clean up mermaid.min.js if no flowcharts remain
      async function hasFlowcharts(root) {
        const flowchartsDir = path.join(root, 'prototype', 'flowcharts');
        const stat = await fs.stat(flowchartsDir).catch(() => null);
        if (!stat || !stat.isDirectory()) return false;
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
      if (!await hasFlowcharts(projectRoot)) {
        const mermaidPath = path.join(projectRoot, 'prototype/resources/js/mermaid.min.js');
        try { await fs.unlink(mermaidPath); } catch (e) {}
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0 }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}

module.exports = { handleDelete };
