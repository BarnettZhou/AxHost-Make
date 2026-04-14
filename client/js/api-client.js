(function () {
  const API_BASE = '';

  async function request(url, options = {}) {
    const res = await fetch(API_BASE + url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json();
    }
    return res.text();
  }

  window.apiClient = {
    getScan: (type) => request(`/api/scan?type=${encodeURIComponent(type)}`),
    getFile: (path) => request(`/api/file?path=${encodeURIComponent(path)}`),
    postFile: (path, content) => request('/api/file', {
      method: 'POST',
      body: JSON.stringify({ path, content })
    }),
    postCreate: (data) => request('/api/create', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    postRename: (data) => request('/api/rename', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    postDelete: (data) => request('/api/delete', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    getSettings: () => request('/api/settings'),
    postSettings: (data) => request('/api/settings', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  };
})();
