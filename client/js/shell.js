(function () {
  const isPreview = location.search.includes('mode=preview');
  document.body.classList.toggle('preview-mode', isPreview);
  document.body.classList.toggle('dev-mode', !isPreview);

  window.__axhostState = {
    mode: isPreview ? 'preview' : 'dev',
    navVisible: true,
    docsVisible: false,
    rightBarVisible: true,
    currentPage: null,
    currentDoc: null
  };

  const panelNav = document.getElementById('panel-nav');
  const panelDocs = document.getElementById('panel-docs');
  const panelRightBar = document.getElementById('panel-right-bar');
  const btnToggleNav = document.getElementById('btn-toggle-nav');
  const btnToggleDocs = document.getElementById('btn-toggle-docs');
  const btnTouchEmulation = document.getElementById('btn-touch-emulation');
  const btnToggleRightBar = document.getElementById('btn-toggle-right-bar');
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
  const needsPasswordCheckbox = document.getElementById('needs-password');
  const passwordField = document.getElementById('password-field');
  const remotePasswordInput = document.getElementById('remote-password');
  const btnRandomPassword = document.getElementById('btn-random-password');
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
  const deleteRuleModal = document.getElementById('delete-rule-modal');
  const deleteRuleMessage = document.getElementById('delete-rule-message');
  const btnCancelDeleteRule = document.getElementById('btn-cancel-delete-rule');
  const btnConfirmDeleteRule = document.getElementById('btn-confirm-delete-rule');
  const iframeWrapper = document.getElementById('iframe-wrapper');
  const btnInspect = document.getElementById('btn-inspect');

  // Header controls
  const projectId = window.__axhostProjectId || '';
  const prototypeBase = projectId ? `/projects/${projectId}/prototype` : '/prototype';

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
        const action = item.dataset.action;
        if (action === 'terminal') {
          try {
            const res = await window.apiClient.postOpenTerminal();
            if (res.code === 0) {
              window.showToast('已打开命令行窗口', 'success');
            } else {
              window.showToast(res.message || '打开失败', 'error');
            }
          } catch (err) {
            window.showToast(err.message, 'error');
          }
          return;
        }
        const editor = item.dataset.editor;
        try {
          const res = await window.apiClient.postOpenEditor({ editor });
          if (res.code === 0) {
            const editorName = { vscode: 'VS Code', cursor: 'Cursor', trae: 'Trae' }[editor] || editor;
            window.showToast(`已在 ${editorName} 中打开`, 'success');
          } else {
            window.showToast(res.message || '打开失败', 'error');
          }
        } catch (err) {
          window.showToast(err.message, 'error');
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

  // Touch emulation — drag to scroll like mobile finger touch
  let touchEmulationActive = false;
  const touchDragHandlers = new WeakMap();
  const TOUCH_STYLE_ID = 'axhost-touch-emulation-style';

  function findScrollableParent(el, win) {
    while (el && el !== win.document.body) {
      const style = win.getComputedStyle(el);
      const canScrollY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
      const canScrollX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
      if (canScrollY || canScrollX) {
        return { el, canScrollY, canScrollX };
      }
      el = el.parentElement;
    }
    return { el: win, canScrollY: true, canScrollX: true };
  }

  function injectTouchStyle(doc) {
    if (!doc || !doc.head || doc.getElementById(TOUCH_STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = TOUCH_STYLE_ID;
    style.textContent = `
      * { user-select: none !important; -webkit-user-select: none !important; cursor: none !important; }
      #axhost-touch-cursor {
        position: fixed;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(22, 119, 255, 0.15);
        border: 2px solid rgba(22, 119, 255, 0.5);
        pointer-events: none;
        transform: translate(-50%, -50%);
        z-index: 999999;
        transition: opacity 0.15s ease;
        opacity: 0;
      }
      #axhost-touch-cursor.visible { opacity: 1; }
    `;
    doc.head.appendChild(style);
  }

  function createTouchCursor(doc) {
    if (!doc || doc.getElementById('axhost-touch-cursor')) return;
    const cursor = doc.createElement('div');
    cursor.id = 'axhost-touch-cursor';
    doc.body.appendChild(cursor);
    return cursor;
  }

  function removeTouchStyle(doc) {
    if (!doc) return;
    const style = doc.getElementById(TOUCH_STYLE_ID);
    if (style) style.remove();
    const cursor = doc.getElementById('axhost-touch-cursor');
    if (cursor) cursor.remove();
  }

  function onTouchCursorMove(e) {
    const doc = e.target.ownerDocument;
    const cursor = doc.getElementById('axhost-touch-cursor');
    if (cursor) {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
      cursor.classList.add('visible');
    }
  }

  function onTouchCursorLeave(e) {
    const doc = e.target.ownerDocument;
    const cursor = doc.getElementById('axhost-touch-cursor');
    if (cursor) cursor.classList.remove('visible');
  }

  function makeDragHandlers(doc, win) {
    let startX = 0, startY = 0;
    let startScrollLeft = 0, startScrollTop = 0;
    let scrollTarget = null;
    let canScrollX = false, canScrollY = false;
    let isDragging = false;
    let hasMoved = false;
    let velocityX = 0, velocityY = 0;
    let lastTime = 0, lastX = 0, lastY = 0;
    let momentumRaf = null;

    function cancelMomentum() {
      if (momentumRaf) {
        cancelAnimationFrame(momentumRaf);
        momentumRaf = null;
      }
    }

    function onMouseDown(e) {
      if (e.button !== 0) return;
      cancelMomentum();
      hasMoved = false;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = performance.now();
      velocityX = 0;
      velocityY = 0;
      const el = doc.elementFromPoint(e.clientX, e.clientY);
      const result = findScrollableParent(el, win);
      scrollTarget = result.el;
      canScrollX = result.canScrollX;
      canScrollY = result.canScrollY;
      if (scrollTarget === win) {
        startScrollLeft = win.pageXOffset;
        startScrollTop = win.pageYOffset;
      } else {
        startScrollLeft = scrollTarget.scrollLeft;
        startScrollTop = scrollTarget.scrollTop;
      }
      doc.addEventListener('mousemove', onMouseMove);
      doc.addEventListener('mouseup', onMouseUp);
      doc.addEventListener('mouseleave', onMouseUp);
    }

    function onMouseMove(e) {
      if (!isDragging) return;
      const now = performance.now();
      const dt = now - lastTime;
      const deltaX = startX - e.clientX;
      const deltaY = startY - e.clientY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) hasMoved = true;
      if (hasMoved) {
        e.preventDefault();
        let x = startScrollLeft;
        let y = startScrollTop;
        if (canScrollX) x += deltaX;
        if (canScrollY) y += deltaY;
        if (scrollTarget === win) {
          win.scrollTo(x, y);
        } else {
          scrollTarget.scrollLeft = x;
          scrollTarget.scrollTop = y;
        }
      }
      if (dt > 0) {
        velocityX = (lastX - e.clientX) / dt;
        velocityY = (lastY - e.clientY) / dt;
      }
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = now;
    }

    function startMomentum() {
      const deceleration = 0.95;
      const stopThreshold = 0.05;
      let prev = performance.now();

      function step(now) {
        const dt = now - prev;
        prev = now;
        if (Math.abs(velocityX) < stopThreshold && Math.abs(velocityY) < stopThreshold) {
          momentumRaf = null;
          return;
        }
        const dx = velocityX * dt;
        const dy = velocityY * dt;
        if (scrollTarget === win) {
          win.scrollBy(dx, dy);
        } else {
          scrollTarget.scrollLeft += dx;
          scrollTarget.scrollTop += dy;
        }
        const factor = Math.pow(deceleration, dt / 16);
        velocityX *= factor;
        velocityY *= factor;
        momentumRaf = requestAnimationFrame(step);
      }
      momentumRaf = requestAnimationFrame(step);
    }

    function onMouseUp(e) {
      if (!isDragging) return;
      isDragging = false;
      doc.removeEventListener('mousemove', onMouseMove);
      doc.removeEventListener('mouseup', onMouseUp);
      doc.removeEventListener('mouseleave', onMouseUp);
      if (hasMoved) {
        doc.addEventListener('click', suppressClick, true);
        setTimeout(() => doc.removeEventListener('click', suppressClick, true), 0);
        const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        if (speed > 0.3) startMomentum();
      }
    }

    function suppressClick(e) {
      e.stopPropagation();
      e.preventDefault();
    }

    return { onMouseDown };
  }

  function attachTouchEmulation() {
    const doc = previewFrame.contentDocument;
    const win = previewFrame.contentWindow;
    if (!doc || !win) return;
    injectTouchStyle(doc);
    createTouchCursor(doc);
    doc.addEventListener('mousemove', onTouchCursorMove);
    doc.addEventListener('mouseleave', onTouchCursorLeave);
    if (touchDragHandlers.has(doc)) return;
    const handlers = makeDragHandlers(doc, win);
    touchDragHandlers.set(doc, handlers);
    doc.addEventListener('mousedown', handlers.onMouseDown);
  }

  function detachTouchEmulation() {
    const doc = previewFrame.contentDocument;
    if (!doc) return;
    removeTouchStyle(doc);
    doc.removeEventListener('mousemove', onTouchCursorMove);
    doc.removeEventListener('mouseleave', onTouchCursorLeave);
    const handlers = touchDragHandlers.get(doc);
    if (handlers) {
      doc.removeEventListener('mousedown', handlers.onMouseDown);
      touchDragHandlers.delete(doc);
    }
  }

  function syncTouchEmulation() {
    if (touchEmulationActive) attachTouchEmulation();
    else detachTouchEmulation();
  }

  if (btnTouchEmulation) {
    btnTouchEmulation.addEventListener('click', () => {
      touchEmulationActive = !touchEmulationActive;
      btnTouchEmulation.classList.toggle('active', touchEmulationActive);
      syncTouchEmulation();
    });
    previewFrame.addEventListener('load', () => {
      if (touchEmulationActive) attachTouchEmulation();
    });
  }

  const rightBarResizer = document.getElementById('right-bar-resizer');
  if (rightBarResizer && !window.__axhostState.rightBarVisible) {
    rightBarResizer.classList.add('hidden');
  }
  if (btnToggleRightBar) {
    btnToggleRightBar.classList.toggle('active', window.__axhostState.rightBarVisible);
    btnToggleRightBar.addEventListener('click', () => {
      window.__axhostState.rightBarVisible = !window.__axhostState.rightBarVisible;
      if (panelRightBar) panelRightBar.classList.toggle('hidden', !window.__axhostState.rightBarVisible);
      if (rightBarResizer) rightBarResizer.classList.toggle('hidden', !window.__axhostState.rightBarVisible);
      btnToggleRightBar.classList.toggle('active', window.__axhostState.rightBarVisible);
    });
  }

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
    const projectIdEl = document.getElementById('settings-project-id');
    if (projectIdEl) {
      projectIdEl.textContent = projectId || '-';
    }
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
          path: '/api/projects?project_type=my',
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
        div.addEventListener('click', async () => {
          selectedHostProject = { id: p.object_id || p.id, name: p.name };
          currentSettingsLink = { remoteProjectId: p.object_id || p.id, remoteProjectName: p.name };
          hostProjectSearch.value = p.name || '';
          hostProjectDropdown.classList.remove('open');
          hostProjectHint.textContent = '';
          renderHostProjectState();
          try {
            await window.apiClient.postSettings({ link: currentSettingsLink });
          } catch (e) {}
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
    btnUnlinkProject.addEventListener('click', async () => {
      currentSettingsLink = null;
      renderHostProjectState();
      try {
        await window.apiClient.postSettings({ link: null });
      } catch (e) {}
    });
  }

  function generateRandomPassword() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let pwd = '';
    for (let i = 0; i < 6; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  }

  if (needsPasswordCheckbox && passwordField) {
    needsPasswordCheckbox.addEventListener('change', (e) => {
      passwordField.style.display = e.target.checked ? '' : 'none';
      if (!e.target.checked && remotePasswordInput) remotePasswordInput.value = '';
    });
  }

  if (btnRandomPassword && remotePasswordInput) {
    btnRandomPassword.addEventListener('click', () => {
      remotePasswordInput.value = generateRandomPassword();
    });
  }

  if (btnCreateRemoteProject) {
    btnCreateRemoteProject.addEventListener('click', () => {
      createRemoteModal.classList.add('active');
      newRemoteProjectName.value = '';
      if (needsPasswordCheckbox) needsPasswordCheckbox.checked = false;
      if (passwordField) passwordField.style.display = 'none';
      if (remotePasswordInput) remotePasswordInput.value = '';
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
            body: {
              name,
              is_public: !(needsPasswordCheckbox && needsPasswordCheckbox.checked),
              view_password: (needsPasswordCheckbox && needsPasswordCheckbox.checked) ? (remotePasswordInput ? remotePasswordInput.value.trim() : '') : undefined
            }
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
          // 保存关联到 settings
          try {
            await window.apiClient.postSettings({ link: currentSettingsLink });
          } catch (e) {}
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
    const tab = type === 'component' ? 'components' : type === 'flowchart' ? 'flowcharts' : 'pages';
    const url = `${prototypeBase}/${tab}/${pagePath}/index.html`;
    previewFrame.src = url;
    const info = window.__axhostProjectInfo || {};
    const pageRelativePath = `prototype\\${tab}\\${pagePath}`;
    const pageAbsolutePath = info.projectAbsolutePath
      ? `${info.projectAbsolutePath}\\prototype\\${tab}\\${pagePath}`
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

    // context menu on rules items and empty area
    rulesRoot.addEventListener('contextmenu', (e) => {
      const item = e.target.closest('.rules-item');
      e.preventDefault();
      if (item) {
        showRulesItemContextMenu(e, item.dataset.name);
      } else {
        showRulesContextMenu(e);
      }
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

  function showRulesItemContextMenu(e, fileName) {
    removeRulesContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.id = 'rules-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    // Edit submenu
    const editItem = document.createElement('div');
    editItem.className = 'context-menu-item';
    editItem.textContent = '编辑';
    const subMenu = document.createElement('div');
    subMenu.className = 'context-menu-submenu';
    ['vscode', 'cursor', 'trae'].forEach(editor => {
      const sub = document.createElement('div');
      sub.className = 'context-menu-item';
      const nameMap = { vscode: 'VS Code', cursor: 'Cursor', trae: 'Trae' };
      sub.textContent = `使用 ${nameMap[editor]} 打开`;
      sub.onclick = () => {
        removeRulesContextMenu();
        openRuleInEditor(editor, fileName);
      };
      subMenu.appendChild(sub);
    });
    editItem.appendChild(subMenu);
    menu.appendChild(editItem);

    // Delete
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item';
    if (fileName === 'dev-spec.md') {
      deleteItem.classList.add('disabled');
      deleteItem.textContent = '删除';
      deleteItem.title = 'dev-spec.md 不允许删除';
    } else {
      deleteItem.textContent = '删除';
      deleteItem.onclick = () => {
        removeRulesContextMenu();
        showDeleteRuleModal(fileName);
      };
    }
    menu.appendChild(deleteItem);

    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', removeRulesContextMenu, { once: true });
    }, 0);
  }

  async function openRuleInEditor(editor, fileName) {
    try {
      const res = await window.apiClient.postOpenEditor({ editor, filePath: `rules/${fileName}` });
      if (res.code === 0) {
        const nameMap = { vscode: 'VS Code', cursor: 'Cursor', trae: 'Trae' };
        window.showToast(`已在 ${nameMap[editor]} 中打开`, 'success');
      } else {
        window.showToast(res.message, 'error');
      }
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  }

  function showDeleteRuleModal(fileName) {
    if (!deleteRuleModal || !deleteRuleMessage) return;
    deleteRuleMessage.textContent = `是否删除 ${fileName}？`;
    deleteRuleModal.classList.add('active');
    deleteRuleModal._targetFile = fileName;
  }

  function hideDeleteRuleModal() {
    if (deleteRuleModal) deleteRuleModal.classList.remove('active');
  }

  async function confirmDeleteRule() {
    const fileName = deleteRuleModal ? deleteRuleModal._targetFile : null;
    if (!fileName) return;
    hideDeleteRuleModal();
    try {
      await window.apiClient.postDelete({ path: `rules/${fileName}` });
      window.showToast('删除成功', 'success');
      await loadRulesList();
      if (activeRuleItem && activeRuleItem.dataset.name === fileName) {
        ruleViewerContent.innerHTML = '';
        activeRuleItem = null;
      }
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  }

  if (btnCancelDeleteRule) {
    btnCancelDeleteRule.addEventListener('click', hideDeleteRuleModal);
  }
  if (btnConfirmDeleteRule) {
    btnConfirmDeleteRule.addEventListener('click', confirmDeleteRule);
  }
  if (deleteRuleModal) {
    deleteRuleModal.addEventListener('click', (e) => {
      if (e.target === deleteRuleModal) hideDeleteRuleModal();
    });
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
        let maxSize = isVertical ? (targetId === 'panel-docs' ? window.innerWidth * 0.5 : 400) : 300;
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
        const value = input.value.trim();
        if (!value) {
          window.showToast('名称不能为空', 'error');
          return;
        }
        cleanup();
        resolve(value);
      }

      function cancel() {
        cleanup();
        resolve(null);
      }

      btnOk.onclick = submit;
      btnCancel.onclick = cancel;
      input.onkeydown = (e) => {
        if (e.key === 'Enter') submit();
        else if (e.key === 'Escape') cancel();
      };
    });
  };

  window.shell = { loadPage, exitRuleMode };

  // Listen for iframe navigation requests
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'axhost-navigate') {
      const { path, tab } = e.data;
      if (path && window.shell.loadPage) {
        const type = tab === 'pages' ? 'page' : tab === 'components' ? 'component' : tab === 'flowcharts' ? 'flowchart' : (tab || 'page');
        window.shell.loadPage(type, path);
      }
    }
  });

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
