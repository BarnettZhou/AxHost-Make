(function () {
  const isPreview = location.search.includes('mode=preview');
  document.body.classList.toggle('preview-mode', isPreview);
  document.body.classList.toggle('dev-mode', !isPreview);

  window.__axhostState = {
    mode: isPreview ? 'preview' : 'dev',
    navVisible: true,
    docsVisible: false,
    currentPage: null,
    currentDoc: null
  };

  const panelNav = document.getElementById('panel-nav');
  const panelDocs = document.getElementById('panel-docs');
  const btnToggleNav = document.getElementById('btn-toggle-nav');
  const btnToggleDocs = document.getElementById('btn-toggle-docs');
  const btnPreview = document.getElementById('btn-preview');
  const btnSettings = document.getElementById('btn-settings');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = document.getElementById('settings-close');
  const projectNameInput = document.getElementById('project-name-input');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const previewFrame = document.getElementById('preview-frame');

  // Host project settings
  const hostProjectWrap = document.getElementById('host-project-wrap');
  const hostProjectSearch = document.getElementById('host-project-search');
  const hostProjectDropdown = document.getElementById('host-project-dropdown');
  const hostProjectLinked = document.getElementById('host-project-linked');
  const hostProjectLinkedName = document.getElementById('host-project-linked-name');
  const btnUnlinkProject = document.getElementById('btn-unlink-project');
  const btnCreateRemoteProject = document.getElementById('btn-create-remote-project');
  const hostProjectHint = document.getElementById('host-project-hint');
  const createRemoteModal = document.getElementById('create-remote-project-modal');
  const newRemoteProjectName = document.getElementById('new-remote-project-name');
  const btnCancelCreateRemote = document.getElementById('btn-cancel-create-remote');
  const btnConfirmCreateRemote = document.getElementById('btn-confirm-create-remote');
  const createRemoteError = document.getElementById('create-remote-error');

  let hostProjectList = [];
  let selectedHostProject = null;
  let currentSettingsLink = null;
  const projectNameEl = document.querySelector('#shell-header .title');
  const rulesRoot = document.getElementById('rules-root');
  const ruleViewer = document.getElementById('rule-viewer');
  const ruleViewerContent = document.getElementById('rule-viewer-content');
  const iframeWrapper = document.getElementById('iframe-wrapper');
  const promptBox = document.getElementById('prompt-box');
  const promptResizer = document.getElementById('prompt-resizer');
  const btnInspect = document.getElementById('btn-inspect');

  // Header controls
  const projectId = window.__axhostProjectId || '';
  const prototypeBase = projectId ? `/project/${projectId}/prototype` : '/prototype';

  if (btnPreview) {
    btnPreview.addEventListener('click', () => {
      window.open(`${prototypeBase}/index.html`, '_blank');
    });
  }

  // Editor dropdown
  const btnOpenEditor = document.getElementById('btn-open-editor');
  const editorDropdown = document.getElementById('editor-dropdown');
  if (btnOpenEditor && editorDropdown) {
    btnOpenEditor.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = btnOpenEditor.getBoundingClientRect();
      editorDropdown.style.left = rect.left + 'px';
      editorDropdown.style.top = (rect.bottom + 4) + 'px';
      editorDropdown.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!editorDropdown.contains(e.target) && e.target !== btnOpenEditor) {
        editorDropdown.classList.remove('open');
      }
    });
    editorDropdown.querySelectorAll('.editor-dropdown-item').forEach(item => {
      item.addEventListener('click', async () => {
        editorDropdown.classList.remove('open');
        const editor = item.dataset.editor;
        try {
          const res = await window.apiClient.postOpenEditor({ editor });
          if (res.code === 0) {
            window.showToast(`已在 ${editor === 'vscode' ? 'VS Code' : 'Cursor'} 中打开`, 'success');
          } else {
            window.showToast(res.message || '打开失败', 'error');
          }
        } catch (err) {
          window.showToast('打开失败: ' + err.message, 'error');
        }
      });
    });
  }

  btnToggleNav.addEventListener('click', () => {
    window.__axhostState.navVisible = !window.__axhostState.navVisible;
    panelNav.classList.toggle('hidden', !window.__axhostState.navVisible);
  });

  const docsResizer = document.getElementById('docs-resizer');
  if (docsResizer && !window.__axhostState.docsVisible) {
    docsResizer.classList.add('hidden');
  }
  btnToggleDocs.addEventListener('click', () => {
    window.__axhostState.docsVisible = !window.__axhostState.docsVisible;
    panelDocs.classList.toggle('hidden', !window.__axhostState.docsVisible);
    if (docsResizer) docsResizer.classList.toggle('hidden', !window.__axhostState.docsVisible);
  });

  async function loadProjectName() {
    try {
      const res = await window.apiClient.getSettings();
      if (res.code === 0 && projectNameEl) {
        projectNameEl.textContent = res.data.name;
      }
      if (res.code === 0 && projectNameInput) {
        projectNameInput.value = res.data.name;
      }
    } catch (e) {}
  }
  loadProjectName();

  async function loadProjectInfo() {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/project-info?projectId=${projectId}`);
      const data = await res.json();
      if (data.code === 0) {
        window.__axhostProjectInfo = data.data;
      }
    } catch (e) {}
  }
  loadProjectInfo();

  async function loadSettings() {
    try {
      const data = await window.apiClient.getSettings();
      if (data.code === 0 && data.data) {
        projectNameInput.value = data.data.name || '';
        currentSettingsLink = data.data.link || null;
        renderHostProjectState();
      }
    } catch (e) {}
  }

  function renderHostProjectState() {
    if (currentSettingsLink && currentSettingsLink.remoteProjectId) {
      hostProjectSearch.style.display = 'none';
      hostProjectLinked.style.display = 'flex';
      hostProjectLinkedName.textContent = currentSettingsLink.remoteProjectName || currentSettingsLink.remoteProjectId;
      selectedHostProject = { id: currentSettingsLink.remoteProjectId, name: currentSettingsLink.remoteProjectName };
    } else {
      hostProjectSearch.style.display = '';
      hostProjectLinked.style.display = 'none';
      selectedHostProject = null;
    }
    hostProjectHint.textContent = '';
  }

  async function fetchHostProjects() {
    const baseUrl = localStorage.getItem('axhost-server-url');
    if (!baseUrl) {
      hostProjectHint.textContent = '请先设置 AxHost 服务地址';
      return [];
    }
    const token = localStorage.getItem('axhost-token') || '';
    try {
      const res = await fetch('/api/axhost-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: baseUrl,
          path: '/api/projects',
          method: 'GET',
          headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        })
      });
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        return data.items;
      }
      if (Array.isArray(data)) return data;
      return [];
    } catch (e) {
      hostProjectHint.textContent = '加载项目列表失败';
      return [];
    }
  }

  function renderHostProjectDropdown(list, keyword) {
    hostProjectDropdown.innerHTML = '';
    const filtered = keyword
      ? list.filter(p => (p.name || '').toLowerCase().includes(keyword.toLowerCase()))
      : list;
    if (filtered.length === 0) {
      hostProjectDropdown.innerHTML = '<div class="host-project-dropdown-empty">无匹配项目</div>';
    } else {
      filtered.forEach(p => {
        const div = document.createElement('div');
        div.className = 'host-project-dropdown-item';
        div.textContent = p.name || p.object_id || p.id || '';
        div.addEventListener('click', () => {
          selectedHostProject = { id: p.object_id || p.id, name: p.name };
          hostProjectSearch.value = p.name || '';
          hostProjectDropdown.classList.remove('open');
          hostProjectHint.textContent = '';
        });
        hostProjectDropdown.appendChild(div);
      });
    }
    hostProjectDropdown.classList.add('open');
  }

  if (btnSettings && settingsModal) {
    btnSettings.addEventListener('click', async () => {
      await loadSettings();
      settingsModal.classList.add('open');
    });
    settingsClose.addEventListener('click', closeSettings);
    settingsModal.querySelector('.settings-modal-overlay').addEventListener('click', closeSettings);
    const btnCancel = document.getElementById('settings-modal-cancel');
    if (btnCancel) btnCancel.addEventListener('click', closeSettings);
  }

  function closeSettings() {
    settingsModal.classList.remove('open');
    hostProjectDropdown.classList.remove('open');
  }

  if (hostProjectSearch) {
    hostProjectSearch.addEventListener('focus', async () => {
      if (hostProjectList.length === 0) {
        hostProjectList = await fetchHostProjects();
      }
      renderHostProjectDropdown(hostProjectList, hostProjectSearch.value.trim());
    });
    hostProjectSearch.addEventListener('input', () => {
      renderHostProjectDropdown(hostProjectList, hostProjectSearch.value.trim());
    });
    document.addEventListener('click', (e) => {
      if (!hostProjectWrap.contains(e.target)) {
        hostProjectDropdown.classList.remove('open');
      }
    });
  }

  if (btnUnlinkProject) {
    btnUnlinkProject.addEventListener('click', () => {
      currentSettingsLink = null;
      renderHostProjectState();
    });
  }

  if (btnCreateRemoteProject) {
    btnCreateRemoteProject.addEventListener('click', () => {
      createRemoteModal.classList.add('active');
      newRemoteProjectName.value = '';
      createRemoteError.textContent = '';
      setTimeout(() => newRemoteProjectName.focus(), 50);
    });
  }

  if (btnCancelCreateRemote) {
    btnCancelCreateRemote.addEventListener('click', () => {
      createRemoteModal.classList.remove('active');
    });
  }
  if (createRemoteModal) {
    createRemoteModal.addEventListener('click', (e) => {
      if (e.target === createRemoteModal) createRemoteModal.classList.remove('active');
    });
  }

  if (btnConfirmCreateRemote) {
    btnConfirmCreateRemote.addEventListener('click', async () => {
      const name = newRemoteProjectName.value.trim();
      if (!name) {
        createRemoteError.textContent = '请输入项目名称';
        return;
      }
      const baseUrl = localStorage.getItem('axhost-server-url');
      if (!baseUrl) {
        createRemoteError.textContent = 'AxHost 服务地址未设置';
        return;
      }
      const token = localStorage.getItem('axhost-token') || '';
      if (!token) {
        createRemoteError.textContent = '请先登录';
        return;
      }
      btnConfirmCreateRemote.disabled = true;
      btnConfirmCreateRemote.textContent = '创建中...';
      try {
        const res = await fetch('/api/axhost-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverUrl: baseUrl,
            path: '/api/projects',
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: { name }
          })
        });
        const data = await res.json();
        if (res.ok && (data.object_id || data.id)) {
          const projectId = data.object_id || data.id;
          selectedHostProject = { id: projectId, name: data.name || name };
          currentSettingsLink = { remoteProjectId: projectId, remoteProjectName: data.name || name };
          renderHostProjectState();
          createRemoteModal.classList.remove('active');
          window.showToast('项目创建成功并已关联', 'success');
          // 刷新列表
          hostProjectList = await fetchHostProjects();
        } else {
          createRemoteError.textContent = data.message || '创建失败';
        }
      } catch (e) {
        createRemoteError.textContent = '网络错误';
      } finally {
        btnConfirmCreateRemote.disabled = false;
        btnConfirmCreateRemote.textContent = '创建';
      }
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      const name = projectNameInput.value.trim();
      if (!name) return;
      const payload = { name };
      if (selectedHostProject) {
        payload.link = {
          remoteProjectId: selectedHostProject.id,
          remoteProjectName: selectedHostProject.name
        };
      } else if (!hostProjectLinked || hostProjectLinked.style.display === 'none') {
        payload.link = null;
      }
      try {
        await window.apiClient.postSettings(payload);
        if (projectNameEl) projectNameEl.textContent = name;
        closeSettings();
        window.showToast('设置保存成功', 'success');
      } catch (err) {
        window.showToast('保存失败: ' + err.message, 'error');
      }
    });
  }

  if (isPreview) {
    const btnChangelog = document.getElementById('btn-changelog');
    if (btnChangelog) {
      btnChangelog.addEventListener('click', () => {
        window.open('/prototype/../changelog/changelog.md', '_blank');
      });
    }
  }

  function loadPage(type, pagePath) {
    exitRuleMode();
    const url = `${prototypeBase}/${type}s/${pagePath}/index.html`;
    previewFrame.src = url;
    const info = window.__axhostProjectInfo || {};
    const pageRelativePath = `prototype\\${type}s\\${pagePath}`;
    const pageAbsolutePath = info.projectAbsolutePath
      ? `${info.projectAbsolutePath}\\prototype\\${type}s\\${pagePath}`
      : '';
    window.__axhostState.currentPage = { type, path: pagePath, pageRelativePath, pageAbsolutePath };
    if (window.docPanel && window.docPanel.load) {
      window.docPanel.load(type, pagePath);
    }
    const promptContext = document.getElementById('prompt-context');
    if (promptContext) {
      promptContext.textContent = `${type}s/${pagePath}`;
    }
  }

  // Rule mode UI toggle
  function enterRuleMode() {
    if (btnInspect) btnInspect.classList.add('disabled');
    if (btnToggleDocs) {
      btnToggleDocs.classList.add('disabled');
      window.__axhostState.docsVisible = false;
      panelDocs.classList.add('hidden');
    }
    if (iframeWrapper) iframeWrapper.classList.add('hidden');
    if (promptBox) promptBox.classList.add('hidden');
    if (promptResizer) promptResizer.classList.add('hidden');
    if (ruleViewer) ruleViewer.classList.remove('hidden');
    // hide inspector popup if any
    const doc = previewFrame.contentDocument;
    if (doc) {
      const popup = doc.querySelector('.inspector-popup');
      if (popup) popup.remove();
    }
  }

  function exitRuleMode() {
    if (btnInspect) btnInspect.classList.remove('disabled');
    if (btnToggleDocs) btnToggleDocs.classList.remove('disabled');
    if (iframeWrapper) iframeWrapper.classList.remove('hidden');
    if (promptBox) promptBox.classList.remove('hidden');
    if (promptResizer) promptResizer.classList.remove('hidden');
    if (ruleViewer) ruleViewer.classList.add('hidden');
  }

  // Rules panel
  let activeRuleItem = null;

  async function loadRulesList() {
    if (!rulesRoot) return;
    try {
      const res = await window.apiClient.getDocs('rules');
      const files = res.code === 0 ? res.data : [];
      rulesRoot.innerHTML = '';
      if (files.length === 0) {
        rulesRoot.innerHTML = '<div style="padding:8px 12px;color:#999;font-size:12px;">暂无规则文件</div>';
        return;
      }
      files.forEach(name => {
        const item = document.createElement('div');
        item.className = 'rules-item';
        item.textContent = name;
        item.dataset.name = name;
        item.addEventListener('click', () => loadRuleFile(name, item));
        rulesRoot.appendChild(item);
      });
    } catch (err) {
      rulesRoot.innerHTML = '<div style="padding:8px 12px;color:#999;font-size:12px;">加载失败</div>';
    }
  }

  async function loadRuleFile(name, itemEl) {
    try {
      const content = await window.apiClient.getFile(`rules/${name}`);
      if (activeRuleItem) activeRuleItem.classList.remove('active');
      activeRuleItem = itemEl;
      if (activeRuleItem) activeRuleItem.classList.add('active');
      // clear tree nav active state
      document.querySelectorAll('#tree-root .tree-label.active').forEach(el => el.classList.remove('active'));
      enterRuleMode();
      const html = window.mdRenderer.renderMarkdown(content);
      ruleViewerContent.innerHTML = html;
      window.__axhostState.currentPage = { type: 'rule', path: name };
    } catch (err) {
      window.showToast('加载规则文件失败', 'error');
    }
  }

  function initRulesPanel() {
    if (isPreview || !rulesRoot) return;
    loadRulesList();

    // Collapse/expand rules panel
    const rulesHeader = document.getElementById('rules-header');
    const panelNavBottom = document.getElementById('panel-nav-bottom');
    const rulesResizer = document.getElementById('rules-resizer');
    const panelNav = document.getElementById('panel-nav');
    const panelNavTop = document.getElementById('panel-nav-top');
    let savedTreeHeight = null;
    if (rulesHeader && panelNavBottom && panelNav && panelNavTop) {
      const saved = localStorage.getItem('axhost-rules-collapsed');
      if (saved === 'true') {
        rulesHeader.classList.add('collapsed');
        panelNavBottom.classList.add('collapsed');
        panelNav.classList.add('collapsed-rules');
        if (rulesResizer) rulesResizer.classList.add('hidden');
        const rulesList = panelNavBottom.querySelector('.rules-list');
        if (rulesList) rulesList.style.display = 'none';
        savedTreeHeight = panelNavTop.style.height || '';
        panelNavTop.style.flex = '1 1 auto';
        panelNavTop.style.height = 'auto';
      }
      rulesHeader.addEventListener('click', () => {
        const isCollapsed = rulesHeader.classList.toggle('collapsed');
        panelNavBottom.classList.toggle('collapsed', isCollapsed);
        panelNav.classList.toggle('collapsed-rules', isCollapsed);
        if (rulesResizer) rulesResizer.classList.toggle('hidden', isCollapsed);
        const rulesList = panelNavBottom.querySelector('.rules-list');
        if (rulesList) {
          rulesList.style.display = isCollapsed ? 'none' : '';
        }
        if (isCollapsed) {
          savedTreeHeight = panelNavTop.style.height || '';
          panelNavTop.style.flex = '1 1 auto';
          panelNavTop.style.height = 'auto';
        } else {
          panelNavTop.style.flex = '0 0 auto';
          panelNavTop.style.height = savedTreeHeight || '60%';
        }
        localStorage.setItem('axhost-rules-collapsed', isCollapsed);
      });
    }

    // context menu on empty area
    rulesRoot.addEventListener('contextmenu', (e) => {
      const item = e.target.closest('.rules-item');
      if (item) return; // let default behavior or ignore
      e.preventDefault();
      showRulesContextMenu(e);
    });
  }

  function showRulesContextMenu(e) {
    removeRulesContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.id = 'rules-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    const div = document.createElement('div');
    div.className = 'context-menu-item';
    div.textContent = '新建文件';
    div.onclick = () => {
      removeRulesContextMenu();
      handleCreateRuleFile();
    };
    menu.appendChild(div);
    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', removeRulesContextMenu, { once: true });
    }, 0);
  }

  function removeRulesContextMenu() {
    const menu = document.getElementById('rules-context-menu');
    if (menu) menu.remove();
  }

  async function handleCreateRuleFile() {
    const name = await window.showPrompt('请输入规则文件名', '例如：design-spec');
    if (!name) return;
    const raw = name.trim();
    if (!raw) {
      window.showToast('文件名不能为空', 'error');
      return;
    }
    if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(raw)) {
      window.showToast('文件名包含非法字符', 'error');
      return;
    }
    const fileName = raw.endsWith('.md') ? raw : raw + '.md';
    const filePath = `rules/${fileName}`;
    try {
      await window.apiClient.postFile(filePath, `# ${raw}\n\n`);
      window.showToast('规则文件创建成功', 'success');
      await loadRulesList();
      // auto select the new file
      const newItem = rulesRoot.querySelector(`[data-name="${fileName}"]`);
      if (newItem) loadRuleFile(fileName, newItem);
    } catch (err) {
      window.showToast('创建失败: ' + err.message, 'error');
    }
  }

  // Resizer logic
  function initResizers() {
    let overlay = null;
    document.querySelectorAll('.resizer').forEach(resizer => {
      const targetId = resizer.dataset.target;
      const target = document.getElementById(targetId);
      if (!target) return;
      const direction = resizer.dataset.dir;
      const invert = resizer.dataset.invert === 'true';
      const isVertical = direction === 'v';
      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.body.style.userSelect = 'none';
        target.classList.add('resizing');
        overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:transparent;cursor:' + (isVertical ? 'col-resize' : 'row-resize') + ';';
        document.body.appendChild(overlay);
        const startPos = isVertical ? e.clientX : e.clientY;
        const startSize = isVertical ? target.offsetWidth : target.offsetHeight;
        const minSize = isVertical ? 180 : 80;
        let maxSize = isVertical ? (targetId === 'panel-docs' ? window.innerWidth * 0.5 : 400) : (targetId === 'prompt-box' ? 600 : 300);
        if (targetId === 'panel-nav-top') {
          const panelNav = document.getElementById('panel-nav');
          maxSize = panelNav ? panelNav.offsetHeight - 80 - 5 : 300;
        }
        function onMove(ev) {
          const currentPos = isVertical ? ev.clientX : ev.clientY;
          let delta = invert ? startPos - currentPos : currentPos - startPos;
          let newSize = Math.max(minSize, Math.min(maxSize, startSize + delta));
          target.style[isVertical ? 'width' : 'height'] = newSize + 'px';
        }
        function onUp() {
          document.body.style.userSelect = '';
          target.classList.remove('resizing');
          if (overlay) { overlay.remove(); overlay = null; }
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  window.showToast = function (message, type = 'info') {
    let toast = document.getElementById('axhost-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'axhost-toast';
      toast.className = 'axhost-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'axhost-toast ' + type;
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  };

  window.showConfirm = function (title, content) {
    return new Promise((resolve) => {
      let modal = document.getElementById('axhost-confirm-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'axhost-confirm-modal';
        modal.className = 'axhost-confirm-modal';
        modal.innerHTML = `
          <div class="axhost-confirm-modal-overlay"></div>
          <div class="axhost-confirm-modal-content">
            <h4 id="axhost-confirm-title">提示</h4>
            <p id="axhost-confirm-content"></p>
            <div class="axhost-confirm-modal-actions">
              <button id="axhost-confirm-cancel">取消</button>
              <button id="axhost-confirm-ok" class="primary">确认</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }
      modal.querySelector('#axhost-confirm-title').textContent = title || '提示';
      modal.querySelector('#axhost-confirm-content').textContent = content || '';
      modal.classList.add('open');

      const btnOk = modal.querySelector('#axhost-confirm-ok');
      const btnCancel = modal.querySelector('#axhost-confirm-cancel');
      const overlay = modal.querySelector('.axhost-confirm-modal-overlay');

      function cleanup() {
        modal.classList.remove('open');
        btnOk.onclick = null;
        btnCancel.onclick = null;
        overlay.onclick = null;
      }

      btnOk.onclick = () => { cleanup(); resolve(true); };
      btnCancel.onclick = () => { cleanup(); resolve(false); };
      overlay.onclick = () => { cleanup(); resolve(false); };
    });
  };

  window.showPrompt = function (title, placeholder = '', defaultValue = '') {
    return new Promise((resolve) => {
      let modal = document.getElementById('axhost-prompt-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'axhost-prompt-modal';
        modal.className = 'add-doc-modal';
        modal.innerHTML = `
          <div class="add-doc-modal-overlay"></div>
          <div class="add-doc-modal-content">
            <h4 id="axhost-prompt-title">输入</h4>
            <input type="text" id="axhost-prompt-input" placeholder="">
            <div class="add-doc-modal-actions">
              <button id="axhost-prompt-cancel">取消</button>
              <button id="axhost-prompt-ok" class="primary">确认</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }
      modal.querySelector('#axhost-prompt-title').textContent = title || '输入';
      const input = modal.querySelector('#axhost-prompt-input');
      input.placeholder = placeholder || '';
      input.value = defaultValue || '';
      modal.classList.add('open');
      setTimeout(() => input.focus(), 0);

      const btnOk = modal.querySelector('#axhost-prompt-ok');
      const btnCancel = modal.querySelector('#axhost-prompt-cancel');
      const overlay = modal.querySelector('.add-doc-modal-overlay');

      function cleanup() {
        modal.classList.remove('open');
        btnOk.onclick = null;
        btnCancel.onclick = null;
        overlay.onclick = null;
        input.onkeydown = null;
      }

      function submit() {
        cleanup();
        resolve(input.value.trim() || null);
      }

      function cancel() {
        cleanup();
        resolve(null);
      }

      btnOk.onclick = submit;
      btnCancel.onclick = cancel;
      overlay.onclick = cancel;
      input.onkeydown = (e) => {
        if (e.key === 'Enter') submit();
        else if (e.key === 'Escape') cancel();
      };
    });
  };

  window.shell = { loadPage, exitRuleMode };

  // Zoom control
  const zoomLevels = [0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5];
  let zoomIndex = 3;
  const zoomValueEl = document.getElementById('zoom-value');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomIn = document.getElementById('btn-zoom-in');

  function applyZoom() {
    const level = zoomLevels[zoomIndex];
    if (zoomValueEl) zoomValueEl.textContent = Math.round(level * 100) + '%';
    document.documentElement.style.setProperty('--preview-zoom', level);
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      if (zoomIndex > 0) { zoomIndex--; applyZoom(); }
    });
  }
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      if (zoomIndex < zoomLevels.length - 1) { zoomIndex++; applyZoom(); }
    });
  }
  applyZoom();

  // Initialize
  window.addEventListener('DOMContentLoaded', () => {
    if (window.treeNav && window.treeNav.init) {
      window.treeNav.init();
    }
    initResizers();
    initRulesPanel();
  });
})();
