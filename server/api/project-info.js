const path = require('path');

async function handleProjectInfoGet(req, res, workspaceRoot) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 400, message: 'projectId is required' }));
      return;
    }

    const projectAbsolutePath = path.join(workspaceRoot, 'projects', projectId);
    const projectRelativeDir = path.join('projects', projectId);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 0,
      data: {
        projectId,
        projectRelativeDir,
        projectAbsolutePath
      }
    }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: err.message }));
  }
}

module.exports = { handleProjectInfoGet };
