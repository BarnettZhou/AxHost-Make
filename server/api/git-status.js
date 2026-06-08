const { exec } = require('child_process');

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

    // Local status
    let localStatus = 'clean'; // clean | uncommitted | no_commits
    try {
      const statusText = await run('git status --porcelain', projectRoot);
      localStatus = statusText ? 'uncommitted' : 'clean';
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

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 0,
      data: {
        initialized: true,
        branch,
        hasCommits,
        remotes,
        localStatus
      }
    }));
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
