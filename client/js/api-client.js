(function () {
  const API_BASE = '';
  const projectId = window.__axhostProjectId || '';

  function buildUrl(path) {
    if (!projectId) return path;
    const sep = path.includes('?') ? '&' : '?';
    return path + sep + 'project=' + encodeURIComponent(projectId);
  }

  async function request(url, options = {}) {
    const res = await fetch(API_BASE + buildUrl(url), {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errData = await res.json();
        if (errData && errData.message) {
          errMsg = errData.message;
        }
      } catch (e) {}
      console.error('[API Error]', url, errMsg);
      throw new Error(errMsg);
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
    }),
    getDocs: (path) => request(`/api/docs?path=${encodeURIComponent(path)}`),
    postReorder: (data) => request('/api/sitemap/reorder', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    postMove: (data) => request('/api/move', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    postCopy: (data) => request('/api/copy', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    postExport: (data) => request('/api/export', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    postOpenEditor: (data) => request('/api/open-editor', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  };
})();
