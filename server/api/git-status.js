const { exec } = require('child_process');
const { readSitemap } = require('../lib/sitemap-io');

function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, timeout: 10000 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}

async function handleGitStatus(req, res, projectRoot) {
  try {
    // Check if git is initialized
    let isRepo = false;
    try {
      await run('git rev-parse --git-dir', projectRoot);
      isRepo = true;
    } catch (e) {
      // not a git repo
    }

    if (!isRepo) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: { initialized: false } }));
      return;
    }

    // Get current branch
    let branch = '';
    try {
      branch = await run('git rev-parse --abbrev-ref HEAD', projectRoot);
    } catch (e) {
      branch = 'unknown';
    }

    // Get remotes
    let remotes = [];
    try {
      const remoteText = await run('git remote -v', projectRoot);
      const seen = new Set();
      if (remoteText) {
        for (const line of remoteText.split('\n')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const name = parts[0];
            const url = parts[1];
            if (!seen.has(name)) {
              seen.add(name);
              remotes.push({ name, url });
            }
          }
        }
      }
    } catch (e) {
      // no remotes
    }

    // For each remote, get ahead/behind counts
    for (const remote of remotes) {
      try {
        const counts = await run(
          `git rev-list --left-right --count ${remote.name}/${branch}...${branch}`,
          projectRoot
        );
        const parts = counts.split('\t');
        remote.behind = parseInt(parts[0]) || 0;
        remote.ahead = parseInt(parts[1]) || 0;
      } catch (e) {
        // Remote tracking branch may not exist (never fetched)
        remote.notFetched = true;
      }
    }

    // Local status — parse porcelain and resolve page/component/rules names
    let localStatus = 'clean'; // clean | uncommitted | no_commits
    let uncommittedItems = null; // { pages: [...], components: [...], rules: [...] }
    try {
      const statusText = await run('git status --porcelain', projectRoot);
      if (statusText) {
        localStatus = 'uncommitted';

        // Helpers
        function fileStatus(line) {
          const raw = line.substring(0, 2);
          if (raw[0] === 'D' || raw[1] === 'D') return 'deleted';
          if (raw === '??' || raw[0] === 'A') return 'added';
          return 'modified';
        }
        function worseStatus(a, b) {
          const order = { added: 0, modified: 1, deleted: 2 };
          return (order[a] || 0) >= (order[b] || 0) ? a : b;
        }

        // Parse porcelain lines
        const pageMap = {};   // hexId -> { status }
        const compMap = {};   // hexId -> { status }
        const ruleList = [];  // [{ path, status }]
        const hexRe = /^prototype\/(pages|components)\/([a-f0-9]{8})\//;
        const ruleRe = /^rules\//;

        for (const line of statusText.split('\n')) {
          let filePath = line.substring(2).trim();
          if (filePath.includes(' -> ')) filePath = filePath.split(' -> ')[1];
          const status = fileStatus(line);

          const hexM = filePath.match(hexRe);
          if (hexM) {
            const tab = hexM[1];
            const hexId = hexM[2];
            const map = tab === 'pages' ? pageMap : compMap;
            map[hexId] = map[hexId] ? worseStatus(map[hexId], status) : status;
            continue;
          }

          if (ruleRe.test(filePath)) {
            ruleList.push({ path: filePath, status });
          }
        }

        // Resolve pages/components via sitemap
        if (Object.keys(pageMap).length > 0 || Object.keys(compMap).length > 0) {
          try {
            const sitemap = await readSitemap(projectRoot);
            const nodeMap = {};
            function walkTree(nodes, parentId) {
              for (const n of nodes) {
                nodeMap[n.id] = { name: n.name, parentId: parentId || null };
                if (n.children && n.children.length) walkTree(n.children, n.id);
              }
            }
            walkTree(sitemap.pages || [], null);
            walkTree(sitemap.components || [], null);

            function buildItems(statusMap) {
              const items = [];
              for (const [id, s] of Object.entries(statusMap)) {
                const info = nodeMap[id];
                if (!info) continue;
                const parts = [];
                let cur = info;
                while (cur) {
                  parts.unshift(cur.name);
                  cur = cur.parentId ? nodeMap[cur.parentId] : null;
                }
                items.push({
                  name: parts[parts.length - 1],
                  breadcrumb: parts.length > 1 ? parts.join(' / ') : null,
                  status: s
                });
              }
              return items;
            }

            uncommittedItems = {};
            if (Object.keys(pageMap).length > 0) uncommittedItems.pages = buildItems(pageMap);
            if (Object.keys(compMap).length > 0) uncommittedItems.components = buildItems(compMap);
          } catch (e) {
            // sitemap read failed — pages/components just won't show
          }
        } else {
          uncommittedItems = {};
        }

        // Add rules (no sitemap needed)
        if (ruleList.length > 0) {
          if (!uncommittedItems) uncommittedItems = {};
          uncommittedItems.rules = ruleList.map(r => ({
            name: r.path.replace(/^rules\//, ''),
            breadcrumb: r.path,
            status: r.status
          }));
        }
      }
    } catch (e) {
      localStatus = 'unknown';
    }

    // Check if there are any commits
    let hasCommits = true;
    try {
      await run('git rev-parse HEAD', projectRoot);
    } catch (e) {
      hasCommits = false;
    }

    const respData = {
      initialized: true,
      branch,
      hasCommits,
      remotes,
      localStatus
    };
    if (uncommittedItems) respData.uncommittedItems = uncommittedItems;

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 0, data: respData }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
}

module.exports = {
  handleGitStatus,
  routes: [
    { method: 'GET', path: '/api/git-status', handler: handleGitStatus, scope: 'project' }
  ]
};
