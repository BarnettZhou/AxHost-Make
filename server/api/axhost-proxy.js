async function handleAxHostProxy(req, res) {
  let raw = '';
  try {
    for await (const chunk of req) raw += chunk;
    const data = JSON.parse(raw);
    const { serverUrl, path: apiPath, method, headers, body: proxyBody } = data;

    if (!serverUrl || !/^https?:\/\//i.test(serverUrl)) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 400, message: 'Invalid serverUrl' }));
      return;
    }

    const targetUrl = serverUrl.replace(/\/+$/, '') + (apiPath || '');
    const fetchOptions = {
      method: method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
    };
    if (proxyBody && (fetchOptions.method === 'POST' || fetchOptions.method === 'PUT' || fetchOptions.method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(proxyBody);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || 'application/json; charset=utf-8';
    const responseBody = await response.text();
    res.writeHead(response.status, { 'Content-Type': contentType });
    res.end(responseBody);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 502, message: 'Proxy error: ' + err.message }));
  }
}

module.exports = { handleAxHostProxy };
