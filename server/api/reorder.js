const { readSitemap, writeSitemap } = require('../lib/sitemap-io.js');

async function handleReorder(req, res, projectRoot) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const data = JSON.parse(body || '{}');
  const { type, oldIndex, newIndex } = data;

  if (!type || (type !== 'pages' && type !== 'components') || typeof oldIndex !== 'number' || typeof newIndex !== 'number') {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 400, message: 'Invalid params' }));
    return;
  }

  const sitemap = await readSitemap(projectRoot);
  const list = sitemap[type] || [];

  if (oldIndex < 0 || oldIndex >= list.length || newIndex < 0 || newIndex >= list.length) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 400, message: 'Index out of range' }));
    return;
  }

  const [moved] = list.splice(oldIndex, 1);
  list.splice(newIndex, 0, moved);

  await writeSitemap(projectRoot, sitemap);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ code: 0 }));
}

module.exports = { handleReorder };
