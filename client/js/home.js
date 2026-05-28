(function () {
  const TAB_RELEASE_MS = 10 * 60 * 1000;
  const CHECK_INTERVAL_MS = 60 * 1000;
  const STORAGE_TABS = 'axhost-tabs';
  const STORAGE_ACTIVE_TAB = 'axhost-active-tab';
  const STORAGE_VIEW = 'axhost-view-mode';
  const STORAGE_SORT_FIELD = 'axhost-sort-field';
  const STORAGE_SORT_DIR = 'axhost-sort-dir';

  const state = {
    projects: [],
    filteredProjects: [],
    viewMode: localStorage.getItem(STORAGE_VIEW) || 'gallery',
    sortField: localStorage.getItem(STORAGE_SORT_FIELD) || 'lastModified',
    sortDir: localStorage.getItem(STORAGE_SORT_DIR) || 'desc',
    tabs: [],
    activeTabId: null,
    searchKeyword: '',
    coverUrls: {}
  };

  const els = {
    btnHome: document.getElementById('btn-home'),
    tabBar: document.getElementById('tab-bar'),
    searchInput: document.getElementById('search-input'),
    sortDropdown: document.getElementById('sort-dropdown'),
    btnSort: document.getElementById('btn-sort'),
    sortLabel: document.getElementById('sort-label'),
    btnViewMode: document.getElementById('btn-view-mode'),
    viewIcon: document.getElementById('view-icon'),
    btnNewProject: document.getElementById('btn-new-project'),
    btnImportProject: document.getElementById('btn-import-project'),
    projectListBody: document.getElementById('project-list-body'),
    projectListView: document.getElementById('project-list-view'),
    shellContainer: document.getElementById('shell-container'),
    avatarWrap: document.getElementById('avatar-wrap'),
    btnAvatar: document.getElementById('btn-avatar'),
    avatarDropdown: document.getElementById('avatar-dropdown'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    themeToggleIcon: document.getElementById('theme-toggle-icon'),
    btnSystemSettings: document.getElementById('btn-system-settings'),
    btnLogin: document.getElementById('btn-login'),
  };

  // ===== Utilities =====
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function truncateName(name, maxLen) {
    maxLen = maxLen || 10;
    let len = 0;
    let result = '';
    for (const char of name) {
      len += (char.charCodeAt(0) > 127) ? 2 : 1;
      if (len > maxLen * 2) return result + '…';
      result += char;
    }
    return result;
  }

  function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 0) return '刚刚';
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ===== Theme =====
  function applyTheme() {
    const isDark = localStorage.getItem('axhost-theme') === 'dark';
    document.body.classList.toggle('dark', isDark);
    if (els.themeToggleIcon) {
      els.themeToggleIcon.setAttribute('icon-id', isDark ? 'dome-light' : 'moon');
    }
    // 同步到所有已打开的 iframe
    document.querySelectorAll('.shell-frame').forEach(frame => {
      try {
        frame.contentWindow.postMessage({ type: 'axhost-theme', theme: isDark ? 'dark' : 'light' }, '*');
      } catch (e) {}
    });
  }

  function toggleTheme() {
    const isDark = !document.body.classList.contains('dark');
    localStorage.setItem('axhost-theme', isDark ? 'dark' : 'light');
    applyTheme();
  }

  // ===== Toast =====
  function showToast(message, type) {
    type = type || 'info';
    let toast = document.getElementById('axhost-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'axhost-toast';
      toast.className = 'axhost-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'axhost-toast ' + type;
    requestAnimationFrame(function () {
      toast.classList.add('show');
    });
    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2500);
  }

  // ===== API Helpers =====
  function getAxHostBaseUrl() {
    const url = localStorage.getItem('axhost-server-url');
    if (!url) return null;
    return url.replace(/\/+$/, '');
  }

  function getAxHostToken() {
    return localStorage.getItem('axhost-token') || '';
  }

  function isLoggedIn() {
    return !!getAxHostToken();
  }

  function updateLoginUI() {
    const token = getAxHostToken();
    const userName = localStorage.getItem('axhost-user-name') || '';
    const avatarEl = document.querySelector('.avatar');
    const loginBtn = els.btnLogin;
    if (token && userName) {
      if (avatarEl) avatarEl.textContent = userName.charAt(0).toUpperCase();
      if (loginBtn) {
        loginBtn.innerHTML = `<iconpark-icon icon-id="logout" size="14" color="currentColor"></iconpark-icon><span>退出登录</span>`;
      }
    } else {
      if (avatarEl) avatarEl.textContent = 'A';
      if (loginBtn) {
        loginBtn.innerHTML = `<iconpark-icon icon-id="login" size="14" color="currentColor"></iconpark-icon><span>登录账号</span>`;
      }
    }
  }

  function logout() {
    localStorage.removeItem('axhost-token');
    localStorage.removeItem('axhost-user-name');
    updateLoginUI();
    showToast('已退出登录', 'info');
  }

  async function axhostRequest(apiPath, options) {
    const baseUrl = getAxHostBaseUrl();
    if (!baseUrl) throw new Error('AxHost 服务地址未设置');
    const token = getAxHostToken();
    const headers = Object.assign({}, options && options.headers);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const proxyBody = options && options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined;
    const res = await fetch('/api/axhost-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: baseUrl,
        path: apiPath,
        method: (options && options.method) || 'GET',
        headers: headers,
        body: proxyBody
      })
    });
    return res;
  }

  // ===== Tabs =====
  function loadTabs() {
    try {
      const raw = localStorage.getItem(STORAGE_TABS);
      if (raw) state.tabs = JSON.parse(raw);
    } catch (e) { state.tabs = []; }
    state.activeTabId = localStorage.getItem(STORAGE_ACTIVE_TAB) || null;
  }

  function saveTabs() {
    localStorage.setItem(STORAGE_TABS, JSON.stringify(state.tabs));
    localStorage.setItem(STORAGE_ACTIVE_TAB, state.activeTabId || '');
  }

  function openTab(projectId, projectName) {
    let tab = state.tabs.find(t => t.projectId === projectId);
    if (!tab) {
      tab = { projectId, projectName, lastActiveAt: Date.now(), released: false };
      state.tabs.push(tab);
    }
    switchToTab(projectId);
    saveTabs();
    renderTabs();
  }

  function switchToTab(projectId) {
    state.activeTabId = projectId;
    if (els.btnHome) els.btnHome.classList.remove('active');

    let frame = document.querySelector(`.shell-frame[data-project="${CSS.escape(projectId)}"]`);
    const tab = state.tabs.find(t => t.projectId === projectId);

    if (!frame) {
      frame = document.createElement('iframe');
      frame.className = 'shell-frame';
      frame.dataset.project = projectId;
      els.shellContainer.appendChild(frame);
    }

    const needsReload = !frame.src || frame.src === 'about:blank' || (tab && tab.released);
    if (needsReload) {
      frame.src = `/shell.html?project=${encodeURIComponent(projectId)}`;
      if (tab) tab.released = false;
    }

    document.querySelectorAll('.shell-frame').forEach(f => f.classList.toggle('active', f.dataset.project === projectId));

    if (tab) tab.lastActiveAt = Date.now();

    els.projectListView.style.display = 'none';
    els.shellContainer.classList.add('active');
    saveTabs();
    renderTabs();
  }

  function closeTab(projectId) {
    const idx = state.tabs.findIndex(t => t.projectId === projectId);
    if (idx === -1) return;
    state.tabs.splice(idx, 1);

    const frame = document.querySelector(`.shell-frame[data-project="${CSS.escape(projectId)}"]`);
    if (frame) frame.remove();

    if (state.activeTabId === projectId) {
      if (state.tabs.length > 0) {
        switchToTab(state.tabs[state.tabs.length - 1].projectId);
      } else {
        showProjectList();
      }
    } else {
      saveTabs();
      renderTabs();
    }
  }

  function showProjectList() {
    state.activeTabId = null;
    els.projectListView.style.display = 'block';
    els.shellContainer.classList.remove('active');
    saveTabs();
    renderTabs();
    if (els.btnHome) els.btnHome.classList.add('active');
  }

  function renderTabs() {
    els.tabBar.innerHTML = '';
    state.tabs.forEach(tab => {
      const div = document.createElement('div');
      div.className = 'tab-item' + (tab.projectId === state.activeTabId ? ' active' : '');
      div.innerHTML = `<span class="tab-name">${escapeHtml(truncateName(tab.projectName))}</span><button class="tab-close" data-project="${escapeHtml(tab.projectId)}"><iconpark-icon icon-id="close-small" size="12"></iconpark-icon></button>`;
      div.addEventListener('click', (e) => {
        if (e.target.closest('.tab-close')) return;
        switchToTab(tab.projectId);
      });
      els.tabBar.appendChild(div);
    });

    els.tabBar.querySelectorAll('.tab-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(btn.dataset.project);
      });
    });
  }

  // Soft release timer
  function startReleaseTimer() {
    setInterval(() => {
      const now = Date.now();
      let changed = false;
      state.tabs.forEach(tab => {
        if (tab.projectId === state.activeTabId) return;
        if (tab.released) return;
        if (now - tab.lastActiveAt > TAB_RELEASE_MS) {
          const frame = document.querySelector(`.shell-frame[data-project="${CSS.escape(tab.projectId)}"]`);
          if (frame) frame.src = 'about:blank';
          tab.released = true;
          changed = true;
        }
      });
      if (changed) saveTabs();
    }, CHECK_INTERVAL_MS);
  }

  // ===== Projects =====
  async function loadProjects() {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.code === 0) {
        state.projects = data.data || [];
        filterAndSort();
        loadCoverInfo();
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      els.projectListBody.innerHTML = '<div class="empty-state">加载失败，请刷新重试</div>';
    }
  }

  function filterAndSort() {
    let list = state.projects.slice();

    // Search
    if (state.searchKeyword.trim()) {
      const kw = state.searchKeyword.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(kw));
    }

    // Sort
    list.sort((a, b) => {
      let va = a[state.sortField];
      let vb = b[state.sortField];
      if (state.sortField === 'name') {
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
      } else {
        va = new Date(va).getTime();
        vb = new Date(vb).getTime();
      }
      if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
      if (va > vb) return state.sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    state.filteredProjects = list;
    renderProjects();
  }

  function renderProjects() {
    if (state.filteredProjects.length === 0) {
      els.projectListBody.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📁</div>
          <div class="empty-state-title">暂无项目</div>
          <div>点击「新建原型项目」创建你的第一个项目</div>
        </div>`;
      return;
    }

    if (state.viewMode === 'gallery') {
      renderGallery();
    } else {
      renderList();
    }
  }

  var activeDropdownId = null;

  function closeDropdown() {
    if (activeDropdownId) {
      var dd = document.querySelector('.card-dropdown.open');
      if (dd) dd.remove();
      var btn = document.querySelector('.card-hamburger.active, .list-hamburger.active');
      if (btn) btn.classList.remove('active');
      activeDropdownId = null;
    }
  }

  function toggleDropdown(projectId, anchorEl) {
    if (activeDropdownId === projectId) { closeDropdown(); return; }
    closeDropdown();
    activeDropdownId = projectId;
    anchorEl.classList.add('active');

    var dd = document.createElement('div');
    dd.className = 'card-dropdown open';
    dd.innerHTML =
      '<button class="card-dropdown-item" data-action="rename">重命名</button>' +
      '<button class="card-dropdown-item" data-action="set-cover">设置封面</button>' +
      '<button class="card-dropdown-item" data-action="copy">复制项目</button>' +
      '<button class="card-dropdown-item danger" data-action="delete">删除项目</button>';
    document.body.appendChild(dd);

    var rect = anchorEl.getBoundingClientRect();
    dd.style.position = 'fixed';
    dd.style.top = (rect.bottom + 4) + 'px';
    dd.style.right = (window.innerWidth - rect.right) + 'px';

    function onAction(e) {
      var btn = e.target.closest('.card-dropdown-item');
      if (!btn) return;
      e.stopPropagation();
      var action = btn.dataset.action;
      closeDropdown();
      if (action === 'rename') renameProject(projectId);
      else if (action === 'set-cover') setCover(projectId);
      else if (action === 'copy') copyProject(projectId);
      else if (action === 'delete') deleteProject(projectId);
    }

    dd.addEventListener('click', onAction);

    // Close on doc click
    setTimeout(function () {
      document.addEventListener('click', function handler(e) {
        if (!dd.contains(e.target) && !anchorEl.contains(e.target)) {
          document.removeEventListener('click', handler);
          closeDropdown();
        }
      });
    }, 0);
  }

  async function renameProject(projectId) {
    var project = state.projects.find(function(p) { return p.id === projectId; });
    if (!project) return;
    var name = await AxhostModal.prompt({
      title: '重命名项目',
      placeholder: '请输入新名称',
      defaultValue: project.name
    });
    if (!name || name === project.name) return;
    try {
      var res = await fetch('/api/projects/rename', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, name: name })
      });
      var data = await res.json();
      if (data.code !== 0) { showToast(data.message || '重命名失败', 'error'); return; }
      project.name = name;
      // Update tab if open
      var tab = state.tabs.find(function(t) { return t.projectId === projectId; });
      if (tab) { tab.projectName = name; renderTabs(); }
      saveTabs();
      filterAndSort();
      showToast('重命名成功', 'success');
    } catch (err) { showToast('重命名失败: ' + err.message, 'error'); }
  }

  async function copyProject(projectId) {
    var name = await AxhostModal.prompt({
      title: '复制项目',
      placeholder: '请输入新项目名称'
    });
    if (!name) return;
    try {
      var res = await fetch('/api/projects/copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, name: name })
      });
      var data = await res.json();
      if (data.code !== 0) { showToast(data.message || '复制失败', 'error'); return; }
      await loadProjects();
      showToast('复制成功', 'success');
    } catch (err) { showToast('复制失败: ' + err.message, 'error'); }
  }

  async function deleteProject(projectId) {
    var project = state.projects.find(function(p) { return p.id === projectId; });
    if (!project) return;
    var ok = await AxhostModal.confirm({
      title: '删除项目',
      message: '确认删除项目 "' + escapeHtml(project.name) + '" 吗？删除后数据无法恢复。'
    });
    if (!ok) return;
    try {
      var res = await fetch('/api/projects/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId })
      });
      var data = await res.json();
      if (data.code !== 0) { showToast(data.message || '删除失败', 'error'); return; }
      // Close tab if open
      if (state.tabs.some(function(t) { return t.projectId === projectId; })) {
        closeTab(projectId);
      }
      await loadProjects();
      showToast('删除成功', 'success');
    } catch (err) { showToast('删除失败: ' + err.message, 'error'); }
  }

  // ===== Cover setting =====
  var COVER_GRADIENTS = [
    { css: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)', label: '#ff9a9e → #fad0c4' },
    { css: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', label: '#a18cd1 → #fbc2eb' },
    { css: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)', label: '#fbc2eb → #a6c1ee' },
    { css: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', label: '#30cfd0 → #330867' },
    { css: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)', label: '#89f7fe → #66a6ff' },
    { css: 'linear-gradient(135deg, #fdfcfb 0%, #e2d1c3 100%)', label: '#fdfcfb → #e2d1c3' },
    { css: 'linear-gradient(135deg, #6a85b6 0%, #bac8e0 100%)', label: '#6a85b6 → #bac8e0' },
  ];

  async function loadCoverInfo() {
    var ids = state.projects.map(function(p) { return p.id; });
    if (!ids.length) return;
    try {
      var res = await fetch('/api/cover?ids=' + encodeURIComponent(ids.join(',')));
      var data = await res.json();
      if (data.code === 0) state.coverUrls = data.data || {};
    } catch (e) { /* ignore */ }
    filterAndSort();
  }

  function setCover(projectId) {
    var project = state.projects.find(function(p) { return p.id === projectId; });
    if (!project) return;

    var cs = {
      tab: 'upload',
      uploadFile: null,
      uploadDataUrl: null,
      uploadExt: null,
      gradientIdx: 0,
      textColor: '#ffffff',
      textShadow: false,
      text: project.name,
    };

    function drawPreview(canvas) {
      if (!canvas) return;
      var dpr = window.devicePixelRatio || 1;
      var w = 300, h = 192;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      var gradCss = COVER_GRADIENTS[cs.gradientIdx].css;
      var m = gradCss.match(/linear-gradient\((\d+)deg,\s*(#[^ ]+)\s+(\d+)%,\s*(#[^ ]+)\s+(\d+)%\)/);
      var angle = m ? parseInt(m[1]) : 135;
      var c1 = m ? m[2] : '#ff9a9e';
      var c2 = m ? m[4] : '#fad0c4';
      var rad = angle * Math.PI / 180;
      var x1 = w/2 - Math.cos(rad) * w/2;
      var y1 = h/2 - Math.sin(rad) * h/2;
      var x2 = w/2 + Math.cos(rad) * w/2;
      var y2 = h/2 + Math.sin(rad) * h/2;
      var grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      var lines = cs.text.split('\n');
      var padding = 24;
      var maxWidth = w - padding * 2;
      var totalHeight = 0;
      var lineHeights = [];

      var fontSize = 60;
      ctx.font = 'bold ' + fontSize + 'px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
      var needResize = false;
      for (var i = 0; i < lines.length; i++) {
        if (ctx.measureText(lines[i]).width > maxWidth) { needResize = true; break; }
      }
      if (needResize) {
        var lo = 8, hi = 60;
        for (var k = 0; k < 20; k++) {
          var mid = (lo + hi) / 2;
          ctx.font = 'bold ' + mid + 'px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
          var fits = true;
          for (var j = 0; j < lines.length; j++) {
            if (ctx.measureText(lines[j]).width > maxWidth) { fits = false; break; }
          }
          if (fits) lo = mid; else hi = mid;
        }
        fontSize = lo;
      }

      ctx.font = 'bold ' + fontSize + 'px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      for (var i2 = 0; i2 < lines.length; i2++) {
        var metrics = ctx.measureText(lines[i2]);
        var lh = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) || fontSize * 1.3;
        lineHeights.push(lh);
        totalHeight += lh;
      }

      var startY = (h - totalHeight) / 2;
      var curY = startY;

      for (var i3 = 0; i3 < lines.length; i3++) {
        curY += lineHeights[i3] / 2;
        if (cs.textShadow) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillText(lines[i3], padding + 2, curY + 2);
        }
        ctx.fillStyle = cs.textColor;
        ctx.fillText(lines[i3], padding, curY);
        curY += lineHeights[i3] / 2;
      }
    }

    var modal = new AxhostModal({
      title: '设置封面',
      width: '560px',
      hideConfirm: true,
      hideCancel: true,
      body: function(bodyEl) {
        bodyEl.innerHTML =
          '<div class="cover-modal">' +
            '<div class="cover-tabs">' +
              '<button class="cover-tab active" data-tab="upload">上传封面</button>' +
              '<button class="cover-tab" data-tab="generate">生成封面</button>' +
            '</div>' +
            '<div class="cover-tab-content" data-tab-content="upload">' +
              '<div class="cover-upload-area" id="cover-upload-area">' +
                '<div class="cover-upload-hint">' +
                  '<p>点击或拖拽上传封面图片</p>' +
                  '<p class="cover-upload-size-hint">建议尺寸 300×192 或相近比例</p>' +
                '</div>' +
                '<img id="cover-upload-preview" class="cover-upload-preview" style="display:none">' +
              '</div>' +
            '</div>' +
            '<div class="cover-tab-content hidden" data-tab-content="generate">' +
              '<div class="cover-gen-layout">' +
                '<div class="cover-gen-controls">' +
                  '<label class="cover-gen-label">主题色</label>' +
                  '<div class="cover-gradients" id="cover-gradients"></div>' +
                  '<label class="cover-gen-label">文字颜色</label>' +
                  '<div class="cover-text-options">' +
                    '<div class="cover-color-picker">' +
                      '<input type="color" id="cover-text-color" value="' + cs.textColor + '">' +
                    '</div>' +
                    '<label class="cover-toggle">' +
                      '<input type="checkbox" id="cover-text-shadow">' +
                      '<span class="cover-toggle-track"></span>' +
                      '<span class="cover-toggle-text">阴影</span>' +
                    '</label>' +
                  '</div>' +
                  '<label class="cover-gen-label">文字内容</label>' +
                  '<textarea id="cover-text-input" class="cover-text-input" rows="3">' + escapeHtml(cs.text) + '</textarea>' +
                '</div>' +
                '<div class="cover-gen-preview-wrap">' +
                  '<label class="cover-gen-label">预览</label>' +
                  '<canvas id="cover-preview-canvas" class="cover-preview-canvas"></canvas>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';

        var gradContainer = bodyEl.querySelector('#cover-gradients');
        COVER_GRADIENTS.forEach(function(g, idx) {
          var swatch = document.createElement('button');
          swatch.className = 'cover-gradient-swatch' + (idx === cs.gradientIdx ? ' active' : '');
          swatch.style.background = g.css;
          swatch.title = g.label;
          swatch.addEventListener('click', function() {
            cs.gradientIdx = idx;
            gradContainer.querySelectorAll('.cover-gradient-swatch').forEach(function(b) { b.classList.remove('active'); });
            swatch.classList.add('active');
            drawPreview(canvas);
          });
          gradContainer.appendChild(swatch);
        });

        bodyEl.querySelectorAll('.cover-tab').forEach(function(tab) {
          tab.addEventListener('click', function() {
            cs.tab = tab.dataset.tab;
            bodyEl.querySelectorAll('.cover-tab').forEach(function(t) { t.classList.toggle('active', t === tab); });
            bodyEl.querySelectorAll('.cover-tab-content').forEach(function(c) {
              c.classList.toggle('hidden', c.dataset.tabContent !== cs.tab);
            });
          });
        });

        var uploadArea = bodyEl.querySelector('#cover-upload-area');
        var uploadPreview = bodyEl.querySelector('#cover-upload-preview');
        var uploadHint = uploadArea.querySelector('.cover-upload-hint');

        function handleFile(file) {
          if (!file || !file.type.startsWith('image/')) return;
          cs.uploadFile = file;
          cs.uploadExt = file.name.split('.').pop() || 'png';
          var reader = new FileReader();
          reader.onload = function(e) {
            cs.uploadDataUrl = e.target.result;
            uploadPreview.src = e.target.result;
            uploadPreview.style.display = 'block';
            uploadHint.style.display = 'none';
          };
          reader.readAsDataURL(file);
        }

        uploadArea.addEventListener('click', function() {
          var input = document.getElementById('cover-file-input');
          input.value = '';
          input.onchange = function() {
            if (input.files && input.files[0]) handleFile(input.files[0]);
          };
          input.click();
        });

        uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.classList.add('drag-over'); });
        uploadArea.addEventListener('dragleave', function() { uploadArea.classList.remove('drag-over'); });
        uploadArea.addEventListener('drop', function(e) {
          e.preventDefault();
          uploadArea.classList.remove('drag-over');
          if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        });

        var canvas = bodyEl.querySelector('#cover-preview-canvas');
        drawPreview(canvas);

        bodyEl.querySelector('#cover-text-color').addEventListener('input', function() {
          cs.textColor = this.value;
          drawPreview(canvas);
        });
        bodyEl.querySelector('#cover-text-shadow').addEventListener('change', function() {
          cs.textShadow = this.checked;
          drawPreview(canvas);
        });
        bodyEl.querySelector('#cover-text-input').addEventListener('input', function() {
          cs.text = this.value;
          drawPreview(canvas);
        });
      },
      footer: function(footerEl) {
        footerEl.innerHTML =
          '<button class="axhost-modal-btn axhost-modal-btn-cancel">取消</button>' +
          '<button class="axhost-modal-btn axhost-modal-btn-primary">确定</button>';
        footerEl.querySelector('.axhost-modal-btn-cancel').addEventListener('click', function() { modal.close(); });
        footerEl.querySelector('.axhost-modal-btn-primary').addEventListener('click', async function() {
          var btn = footerEl.querySelector('.axhost-modal-btn-primary');
          btn.disabled = true;
          btn.textContent = '保存中...';
          try {
            var data, ext;
            if (cs.tab === 'upload') {
              if (!cs.uploadDataUrl) { showToast('请选择封面图片', 'error'); btn.disabled = false; btn.textContent = '确定'; return; }
              data = cs.uploadDataUrl.split(',')[1];
              ext = cs.uploadExt || 'png';
            } else {
              var canvas = modal.getBody().querySelector('#cover-preview-canvas');
              data = canvas.toDataURL('image/png').split(',')[1];
              ext = 'png';
            }
            var res = await fetch('/api/cover/upload', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: projectId, data: data, ext: ext })
            });
            var result = await res.json();
            if (result.code !== 0) { showToast(result.message || '保存失败', 'error'); btn.disabled = false; btn.textContent = '确定'; return; }
            state.coverUrls[projectId] = '/api/cover-file?file=' + encodeURIComponent(result.filename) + '&t=' + Date.now();
            filterAndSort();
            showToast('封面设置成功', 'success');
            modal.close();
          } catch (err) {
            showToast('保存失败: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = '确定';
          }
        });
      }
    });
    modal.open();
  }

  function renderGallery() {
    const grid = document.createElement('div');
    grid.className = 'project-grid';
    state.filteredProjects.forEach(p => {
      const card = document.createElement('div');
      card.className = 'project-card';
      var coverHtml;
      if (state.coverUrls[p.id]) {
        coverHtml = '<div class="card-cover"><img class="card-cover-img" src="' + escapeHtml(state.coverUrls[p.id]) + '" alt="' + escapeHtml(p.name) + '"></div>';
      } else {
        coverHtml = '<div class="card-cover"><div class="card-cover-placeholder">📐</div></div>';
      }
      card.innerHTML = coverHtml +
        '        <div class="card-info">' +
        '          <div class="card-title" title="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</div>' +
        '          <div class="card-meta">' + escapeHtml(formatDate(p.lastModified)) + '</div>' +
        '          <button class="card-hamburger" data-project="' + escapeHtml(p.id) + '" title="更多操作">' +
        '            <iconpark-icon icon-id="hamburger-button" size="14" color="currentColor"></iconpark-icon>' +
        '          </button>' +
        '        </div>';
      card.addEventListener('click', function(e) {
        if (e.target.closest('.card-hamburger') || e.target.closest('.card-dropdown')) return;
        openTab(p.id, p.name);
      });
      card.querySelector('.card-hamburger').addEventListener('click', function(e) {
        e.stopPropagation();
        toggleDropdown(p.id, this);
      });
      grid.appendChild(card);
    });
    els.projectListBody.innerHTML = '';
    els.projectListBody.appendChild(grid);
  }

  function renderList() {
    const list = document.createElement('div');
    list.className = 'project-list';
    state.filteredProjects.forEach(p => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <span class="list-item-name">${escapeHtml(p.name)}</span>
        <span class="list-item-time">${escapeHtml(formatDate(p.lastModified))}</span>
        <button class="list-hamburger" data-project="${escapeHtml(p.id)}" title="更多操作">
          <iconpark-icon icon-id="hamburger-button" size="14" color="currentColor"></iconpark-icon>
        </button>
      `;
      item.addEventListener('click', function(e) {
        if (e.target.closest('.list-hamburger') || e.target.closest('.card-dropdown')) return;
        openTab(p.id, p.name);
      });
      item.querySelector('.list-hamburger').addEventListener('click', function(e) {
        e.stopPropagation();
        toggleDropdown(p.id, this);
      });
      list.appendChild(item);
    });
    els.projectListBody.innerHTML = '';
    els.projectListBody.appendChild(list);
  }

  // ===== Events =====
  function bindEvents() {
    els.btnHome.addEventListener('click', showProjectList);

    els.searchInput.addEventListener('input', (e) => {
      state.searchKeyword = e.target.value;
      filterAndSort();
    });

    els.btnSort.addEventListener('click', (e) => {
      e.stopPropagation();
      els.sortDropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!els.sortDropdown.contains(e.target)) {
        els.sortDropdown.classList.remove('open');
      }
    });

    els.sortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const group = item.dataset.sortGroup;
        const value = item.dataset.sortField || item.dataset.sortDir;
        if (group === 'field') {
          state.sortField = value;
        } else if (group === 'dir') {
          state.sortDir = value;
        }
        localStorage.setItem(STORAGE_SORT_FIELD, state.sortField);
        localStorage.setItem(STORAGE_SORT_DIR, state.sortDir);
        updateSortUI();
        filterAndSort();
      });
    });

    els.btnViewMode.addEventListener('click', () => {
      state.viewMode = state.viewMode === 'gallery' ? 'list' : 'gallery';
      localStorage.setItem(STORAGE_VIEW, state.viewMode);
      updateViewUI();
      renderProjects();
    });

    els.btnNewProject.addEventListener('click', async () => {
      const name = await AxhostModal.prompt({
        title: '新建原型项目',
        placeholder: '请输入项目名称'
      });
      if (!name) return;
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.code === 0) {
          await loadProjects();
          openTab(data.data.id, data.data.name);
        } else {
          alert(data.message || '创建失败');
        }
      } catch (err) {
        alert('创建失败: ' + err.message);
      }
    });


    els.btnImportProject.addEventListener('click', () => {
      alert('导入功能即将推出');
    });

    // Avatar dropdown
    els.btnAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      els.avatarDropdown.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!els.avatarWrap.contains(e.target)) {
        els.avatarDropdown.classList.remove('open');
      }
    });
    els.btnThemeToggle.addEventListener('click', () => {
      toggleTheme();
      els.avatarDropdown.classList.remove('open');
    });
    els.btnSystemSettings.addEventListener('click', () => {
      els.avatarDropdown.classList.remove('open');
      var modal = new AxhostModal({
        title: '系统设置',
        confirmText: '保存',
        body: function(container) {
          var saved = getAxHostBaseUrl() || '';
          container.innerHTML =
            '<label for="axhost-server-url-input">AxHost 服务地址</label>' +
            '<input type="url" id="axhost-server-url-input" placeholder="https://axhost.example.com" value="' + saved.replace(/"/g, '&quot;') + '" autocomplete="off">';
        },
        onConfirm: function() {
          var input = modal.getBody().querySelector('#axhost-server-url-input');
          var url = (input.value || '').trim();
          if (!url) { showToast('请输入 AxHost 服务地址', 'error'); throw new Error(); }
          if (!/^https?:\/\//i.test(url)) { showToast('地址必须以 http:// 或 https:// 开头', 'error'); throw new Error(); }
          localStorage.setItem('axhost-server-url', url.replace(/\/+$/, ''));
          showToast('设置已保存', 'success');
        }
      });
      modal.open();
    });
    els.btnLogin.addEventListener('click', () => {
      if (isLoggedIn()) {
        logout();
        els.avatarDropdown.classList.remove('open');
        return;
      }
      els.avatarDropdown.classList.remove('open');
      var modal = new AxhostModal({
        title: '登录账号',
        confirmText: '登录',
        body: function(container) {
          container.innerHTML =
            '<label for="login-employee-id-input">工号</label>' +
            '<input type="text" id="login-employee-id-input" placeholder="请输入工号" autocomplete="off">' +
            '<label for="login-password-input" style="margin-top:12px;">密码</label>' +
            '<input type="password" id="login-password-input" placeholder="请输入密码" style="margin-bottom:8px;">' +
            '<div id="login-error-msg" style="color:#ff4d4f;font-size:12px;min-height:16px;"></div>';
          setTimeout(function() { container.querySelector('#login-employee-id-input').focus(); }, 50);
        },
        onConfirm: async function() {
          var baseUrl = getAxHostBaseUrl();
          if (!baseUrl) { showToast('AxHost 服务地址未设置，请先前往设置页面完成设置', 'error'); throw new Error(); }
          var bodyEl = modal.getBody();
          var employeeId = bodyEl.querySelector('#login-employee-id-input').value.trim();
          var password = bodyEl.querySelector('#login-password-input').value;
          var errorEl = bodyEl.querySelector('#login-error-msg');
          if (!employeeId || !password) { errorEl.textContent = '请输入工号和密码'; throw new Error(); }
          errorEl.textContent = '';
          try {
            var res = await axhostRequest('/api/auth/login', {
              method: 'POST',
              body: JSON.stringify({ employee_id: employeeId, password: password })
            });
            var data = await res.json();
            if (res.ok && data.access_token) {
              localStorage.setItem('axhost-token', data.access_token);
              showToast('登录成功', 'success');
              if (data.user && data.user.name) {
                localStorage.setItem('axhost-user-name', data.user.name);
                updateLoginUI();
              }
            } else {
              errorEl.textContent = data.message || '登录失败，请检查工号和密码';
              throw new Error();
            }
          } catch (err) {
            if (errorEl.textContent) throw err;
            errorEl.textContent = '网络错误，请检查服务地址是否正确';
            throw err;
          }
        }
      });
      modal.open();
      // Enter key on password field
      var pwdInput = modal.getBody().querySelector('#login-password-input');
      if (pwdInput) {
        pwdInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' && modal._btnConfirm) modal._btnConfirm.click();
        });
      }
    });
  }

  function updateSortUI() {
    const fieldLabels = { lastModified: '最近修改', name: '名称', createdAt: '创建时间' };
    els.sortLabel.textContent = fieldLabels[state.sortField] || '排序';

    els.sortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      const group = item.dataset.sortGroup;
      const value = item.dataset.sortField || item.dataset.sortDir;
      let active = false;
      if (group === 'field' && value === state.sortField) active = true;
      if (group === 'dir' && value === state.sortDir) active = true;
      item.classList.toggle('active', active);
    });
  }

  function updateViewUI() {
    els.viewIcon.setAttribute('icon-id', state.viewMode === 'gallery' ? 'grid-four' : 'hamburger-button');
  }

  // ===== Init =====
  function init() {
    applyTheme();
    loadTabs();
    bindEvents();
    updateSortUI();
    updateViewUI();
    renderTabs();
    loadProjects();
    startReleaseTimer();
    updateLoginUI();

    // If there was an active tab, restore it
    if (state.activeTabId) {
      const tab = state.tabs.find(t => t.projectId === state.activeTabId);
      if (tab) {
        switchToTab(state.activeTabId);
      } else {
        state.activeTabId = null;
        saveTabs();
      }
    }

    // Listen for messages from iframe shells
    window.addEventListener('message', (e) => {
      if (!e.data) return;
      if (e.data.type === 'axhost-request-login') {
        if (!isLoggedIn()) els.btnLogin.click();
      } else if (e.data.type === 'axhost-project-renamed') {
        var name = e.data.name;
        var projectId = state.activeTabId;
        if (projectId && name) {
          var tab = state.tabs.find(function(t) { return t.projectId === projectId; });
          if (tab) { tab.projectName = name; renderTabs(); saveTabs(); }
          var proj = state.projects.find(function(p) { return p.id === projectId; });
          if (proj) { proj.name = name; renderProjects(); }
        }
      }
    });
  }

  init();
})();
