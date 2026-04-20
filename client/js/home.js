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
    searchKeyword: ''
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
    newProjectModal: document.getElementById('new-project-modal'),
    newProjectName: document.getElementById('new-project-name'),
    btnCancelNew: document.getElementById('btn-cancel-new'),
    btnConfirmNew: document.getElementById('btn-confirm-new')
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

  function renderGallery() {
    const grid = document.createElement('div');
    grid.className = 'project-grid';
    state.filteredProjects.forEach(p => {
      const card = document.createElement('div');
      card.className = 'project-card';
      card.innerHTML = `
        <div class="card-cover">
          <div class="card-cover-placeholder">📐</div>
        </div>
        <div class="card-info">
          <div class="card-title" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
          <div class="card-meta">${escapeHtml(formatDate(p.lastModified))}</div>
        </div>
      `;
      card.addEventListener('click', () => openTab(p.id, p.name));
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
      `;
      item.addEventListener('click', () => openTab(p.id, p.name));
      list.appendChild(item);
    });
    els.projectListBody.innerHTML = '';
    els.projectListBody.appendChild(list);
  }

  // ===== Create Project =====
  async function createProject() {
    const name = els.newProjectName.value.trim();
    if (!name) {
      alert('请输入项目名称');
      return;
    }
    els.btnConfirmNew.disabled = true;
    els.btnConfirmNew.textContent = '创建中...';
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.code === 0) {
        closeModal();
        await loadProjects();
        openTab(data.data.id, data.data.name);
      } else {
        alert(data.message || '创建失败');
      }
    } catch (err) {
      alert('创建失败: ' + err.message);
    } finally {
      els.btnConfirmNew.disabled = false;
      els.btnConfirmNew.textContent = '创建';
    }
  }

  function openModal() {
    els.newProjectModal.classList.add('active');
    els.newProjectName.value = '';
    setTimeout(() => els.newProjectName.focus(), 50);
  }

  function closeModal() {
    els.newProjectModal.classList.remove('active');
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

    els.btnNewProject.addEventListener('click', openModal);
    els.btnCancelNew.addEventListener('click', closeModal);
    els.btnConfirmNew.addEventListener('click', createProject);
    els.newProjectName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') createProject();
      if (e.key === 'Escape') closeModal();
    });
    els.newProjectModal.addEventListener('click', (e) => {
      if (e.target === els.newProjectModal) closeModal();
    });

    els.btnImportProject.addEventListener('click', () => {
      alert('导入功能即将推出');
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
  }

  init();
})();
