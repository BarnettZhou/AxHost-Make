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
  const floatingPromptBox = document.getElementById('floating-prompt-box');
  const btnPreview = document.getElementById('btn-preview');
  const btnRefreshPreview = document.getElementById('btn-refresh-preview');
  const btnOpenOnline = document.getElementById('btn-open-online');
  const btnSettings = document.getElementById('btn-settings');
  const previewFrame = document.getElementById('preview-frame');

  // Host project settings (elements created inside settings modal body)
  let hostProjectWrap, hostProjectSearch, hostProjectDropdown;
  let hostProjectLinked, hostProjectLinkedName, btnUnlinkProject;
  let btnCreateRemoteProject, hostProjectHint;
  let projectNameInput;

  let hostProjectList = [];
  let selectedHostProject = null;
  let currentSettingsLink = null;
  const projectNameEl = document.querySelector('#shell-header .title');
  const rulesRoot = document.getElementById('rules-root');
  const ruleViewer = document.getElementById('rule-viewer');
  const ruleViewerContent = document.getElementById('rule-viewer-content');
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
  if (btnRefreshPreview) {
    btnRefreshPreview.addEventListener('click', () => {
      const doc = previewFrame.contentDocument;
      if (doc && doc.location) {
        doc.location.reload();
      } else {
        previewFrame.src = previewFrame.src;
      }
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
  }

  function renderEditorDropdown(env) {
    if (!editorDropdown) return;
    const editorNames = { vscode: 'VS Code', cursor: 'Cursor', trae: 'Trae' };
    let html = '';

    if (env.editors && env.editors.length) {
      for (const editor of env.editors) {
        html += `<div class="editor-dropdown-item" data-editor="${editor}">使用 ${editorNames[editor] || editor} 打开</div>`;
      }
    }

    html += `<div class="editor-dropdown-divider"></div>`;
    html += `<div class="editor-dropdown-item" data-action="copy-project-path">复制项目路径</div>`;
    html += `<div class="editor-dropdown-divider"></div>`;

    if (env.isWsl) {
      html += `<div class="editor-dropdown-item" data-action="terminal">打开 WSL 终端</div>`;
    } else if (env.platform === 'win32') {
      html += `<div class="editor-dropdown-item" data-action="terminal">使用 PowerShell 打开</div>`;
      if (env.hasWsl) {
        html += `<div class="editor-dropdown-item" data-action="wsl-terminal">在 WSL 中打开</div>`;
      }
    } else if (env.platform === 'darwin') {
      html += `<div class="editor-dropdown-item" data-action="terminal">在 Terminal 中打开</div>`;
    } else {
      html += `<div class="editor-dropdown-item" data-action="terminal">打开终端</div>`;
    }

    editorDropdown.innerHTML = html;

    editorDropdown.querySelectorAll('.editor-dropdown-item').forEach(item => {
      item.addEventListener('click', async () => {
        editorDropdown.classList.remove('open');
        const action = item.dataset.action;
        if (action === 'terminal') {
          try {
            const res = await window.apiClient.postOpenTerminal();
            if (res.code === 0) {
              window.showToast('已打开终端', 'success');
            } else {
              window.showToast(res.message || '打开失败', 'error');
            }
          } catch (err) {
            window.showToast(err.message, 'error');
          }
          return;
        }
        if (action === 'wsl-terminal') {
          try {
            const res = await window.apiClient.postOpenWslTerminal();
            if (res.code === 0) {
              window.showToast('已在 WSL 中打开目录', 'success');
            } else {
              window.showToast(res.message || '打开失败', 'error');
            }
          } catch (err) {
            window.showToast(err.message, 'error');
          }
          return;
        }
        if (action === 'copy-project-path') {
          const info = window.__axhostProjectInfo;
          if (info && info.projectAbsolutePath) {
            navigator.clipboard.writeText(info.projectAbsolutePath).then(() => {
              window.showToast('项目路径已复制', 'success');
            }).catch(() => {
              window.showToast('复制失败', 'error');
            });
          } else {
            window.showToast('未获取到项目路径', 'error');
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

  function freezePanelChildren(panel) {
    var children = panel.children;
    var w = panel.getBoundingClientRect().width;
    for (var i = 0; i < children.length; i++) {
      children[i].style.minWidth = w + 'px';
    }
    function cleanup() {
      for (var j = 0; j < children.length; j++) {
        children[j].style.minWidth = '';
      }
      panel.removeEventListener('transitionend', cleanup);
    }
    panel.addEventListener('transitionend', cleanup);
  }

  btnToggleNav.addEventListener('click', () => {
    window.__axhostState.navVisible = !window.__axhostState.navVisible;
    var hide = !window.__axhostState.navVisible;
    if (hide) freezePanelChildren(panelNav);
    panelNav.classList.toggle('hidden', hide);
  });

  const docsResizer = document.getElementById('docs-resizer');
  if (docsResizer && !window.__axhostState.docsVisible) {
    docsResizer.classList.add('hidden');
  }
  btnToggleDocs.addEventListener('click', () => {
    window.__axhostState.docsVisible = !window.__axhostState.docsVisible;
    var hide = !window.__axhostState.docsVisible;
    if (hide) freezePanelChildren(panelDocs);
    panelDocs.classList.toggle('hidden', hide);
    if (docsResizer) docsResizer.classList.toggle('hidden', hide);
    btnToggleDocs.classList.toggle('active', window.__axhostState.docsVisible);
  });

  // Touch emulation — drag to scroll like mobile finger touch
  const touchEmu = window.touchEmulation.init(previewFrame);
  let touchEmulationActive = false;

  if (btnTouchEmulation) {
    btnTouchEmulation.addEventListener('click', () => {
      touchEmulationActive = !touchEmulationActive;
      btnTouchEmulation.classList.toggle('active', touchEmulationActive);
      touchEmu.setActive(touchEmulationActive);
      touchEmu.sync();
    });
    previewFrame.addEventListener('load', () => {
      if (touchEmulationActive) touchEmu.attach();
    });
  }

  const rightBarResizer = document.getElementById('right-bar-resizer');
  // Right bar is now hidden by default; floating prompt box replaces it
  if (panelRightBar) panelRightBar.classList.add('hidden');
  if (rightBarResizer) rightBarResizer.classList.add('hidden');
  if (btnToggleRightBar) {
    btnToggleRightBar.classList.toggle('active', window.__axhostState.rightBarVisible);
    btnToggleRightBar.addEventListener('click', () => {
      window.__axhostState.rightBarVisible = !window.__axhostState.rightBarVisible;
      var hide = !window.__axhostState.rightBarVisible;
      if (floatingPromptBox) {
        floatingPromptBox.classList.toggle('hidden', hide);
      }
      btnToggleRightBar.classList.toggle('active', window.__axhostState.rightBarVisible);
    });
  }

  // --- Floating prompt box: drag-to-snap, collapse, and position memory ---
  if (floatingPromptBox) {
    const SNAP_PADDING = 12; // px from edges

    // Restore last position
    var savedCorner = localStorage.getItem('axhost-prompt-corner') || 'top-left';
    applyCorner(savedCorner, false);

    function applyCorner(corner, animate) {
      floatingPromptBox.style.transition = animate ? 'left 0.2s ease, top 0.2s ease' : 'none';
      // Always use left/top so transitions animate smoothly in all directions
      floatingPromptBox.style.right = 'auto';
      floatingPromptBox.style.bottom = 'auto';
      var parentW = floatingPromptBox.parentElement.clientWidth;
      var parentH = floatingPromptBox.parentElement.clientHeight;
      var boxW = floatingPromptBox.offsetWidth;
      var boxH = floatingPromptBox.offsetHeight;
      switch (corner) {
        case 'top-left':
          floatingPromptBox.style.left = SNAP_PADDING + 'px';
          floatingPromptBox.style.top = SNAP_PADDING + 'px';
          break;
        case 'top-right':
          floatingPromptBox.style.left = (parentW - boxW - SNAP_PADDING) + 'px';
          floatingPromptBox.style.top = SNAP_PADDING + 'px';
          break;
        case 'bottom-left':
          floatingPromptBox.style.left = SNAP_PADDING + 'px';
          floatingPromptBox.style.top = (parentH - boxH - SNAP_PADDING) + 'px';
          break;
        case 'bottom-right':
        default:
          floatingPromptBox.style.left = (parentW - boxW - SNAP_PADDING) + 'px';
          floatingPromptBox.style.top = (parentH - boxH - SNAP_PADDING) + 'px';
          break;
      }
      if (animate) {
        setTimeout(function () {
          floatingPromptBox.style.transition = 'none';
        }, 200);
      }
    }

    function getClosestCorner() {
      var rect = floatingPromptBox.getBoundingClientRect();
      var parentRect = floatingPromptBox.parentElement.getBoundingClientRect();
      // Current top-left relative to parent
      var curLeft = rect.left - parentRect.left;
      var curTop = rect.top - parentRect.top;
      var curRight = parentRect.width - (rect.right - parentRect.left);
      var curBottom = parentRect.height - (rect.bottom - parentRect.top);

      var corners = [
        { name: 'top-left',     dist: Math.abs(curLeft - SNAP_PADDING) + Math.abs(curTop - SNAP_PADDING) },
        { name: 'top-right',    dist: Math.abs(curRight - SNAP_PADDING) + Math.abs(curTop - SNAP_PADDING) },
        { name: 'bottom-left',  dist: Math.abs(curLeft - SNAP_PADDING) + Math.abs(curBottom - SNAP_PADDING) },
        { name: 'bottom-right', dist: Math.abs(curRight - SNAP_PADDING) + Math.abs(curBottom - SNAP_PADDING) }
      ];
      corners.sort(function (a, b) { return a.dist - b.dist; });
      return corners[0].name;
    }

    // Drag to reposition
    var dragState = null;
    var dragOverlay = null;
    var floatingHeader = floatingPromptBox.querySelector('.floating-prompt-header');

    function onDragStart(e) {
      if (e.target.closest('button')) return; // don't drag when clicking buttons
      e.preventDefault();
      var rect = floatingPromptBox.getBoundingClientRect();
      dragState = {
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top
      };
      // Transparent overlay to capture events over iframe
      dragOverlay = document.createElement('div');
      dragOverlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:transparent;cursor:grabbing;';
      document.body.appendChild(dragOverlay);
      floatingPromptBox.style.transition = 'none';
      floatingPromptBox.style.right = 'auto';
      floatingPromptBox.style.bottom = 'auto';
      floatingPromptBox.style.left = (rect.left - floatingPromptBox.parentElement.getBoundingClientRect().left) + 'px';
      floatingPromptBox.style.top = (rect.top - floatingPromptBox.parentElement.getBoundingClientRect().top) + 'px';
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
    }

    function onDragMove(e) {
      if (!dragState) return;
      var parentRect = floatingPromptBox.parentElement.getBoundingClientRect();
      var newLeft = e.clientX - parentRect.left - dragState.offsetX;
      var newTop = e.clientY - parentRect.top - dragState.offsetY;
      // Clamp to parent bounds
      var boxW = floatingPromptBox.offsetWidth;
      var boxH = floatingPromptBox.offsetHeight;
      newLeft = Math.max(0, Math.min(newLeft, parentRect.width - boxW));
      newTop = Math.max(0, Math.min(newTop, parentRect.height - boxH));
      floatingPromptBox.style.left = newLeft + 'px';
      floatingPromptBox.style.top = newTop + 'px';
    }

    function onDragEnd(e) {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      if (dragOverlay) { dragOverlay.remove(); dragOverlay = null; }
      if (!dragState) return;
      var corner = getClosestCorner();
      applyCorner(corner, true);
      localStorage.setItem('axhost-prompt-corner', corner);
      dragState = null;
      // Re-apply corner with transition in case snap moved it
    }

    if (floatingHeader) {
      floatingHeader.addEventListener('mousedown', onDragStart);
    }

    // Resize button: cycle 320px → 540px → fill container
    var sizeLevels = [320, 540, 'fill'];
    var sizeLevel = localStorage.getItem('axhost-prompt-size') !== null ? parseInt(localStorage.getItem('axhost-prompt-size'), 10) : 2;
    var btnFloatResize = document.getElementById('btn-float-resize');

    function applySizeLevel(level) {
      floatingPromptBox.style.maxHeight = '';
      if (level === 2) {
        var parentH = floatingPromptBox.parentElement.clientHeight;
        floatingPromptBox.style.height = Math.max(320, parentH - 24) + 'px';
      } else {
        floatingPromptBox.style.height = sizeLevels[level] + 'px';
      }
      if (btnFloatResize) {
        var nextLevel = (level + 1) % 3;
        var labels = ['320px', '540px', '撑满'];
        btnFloatResize.title = labels[level] + ' → ' + labels[nextLevel];
      }
    }

    // Initial size
    applySizeLevel(sizeLevel);

    if (btnFloatResize) {
      btnFloatResize.addEventListener('click', function (e) {
        e.stopPropagation();
        sizeLevel = (sizeLevel + 1) % 3;
        applySizeLevel(sizeLevel);
        localStorage.setItem('axhost-prompt-size', sizeLevel);
      });
    }
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
        renderEditorDropdown(data.data);
      }
    } catch (e) {}
  }
  loadProjectInfo();
  loadSettings();

  async function loadSettings() {
    try {
      const data = await window.apiClient.getSettings();
      if (data.code === 0 && data.data) {
        if (projectNameInput) projectNameInput.value = data.data.name || '';
        currentSettingsLink = data.data.link || null;
        renderHostProjectState();
        updateOpenOnlineButton();
      }
    } catch (e) {}
    var projectIdEl = document.getElementById('settings-header-id');
    if (projectIdEl) {
      projectIdEl.textContent = projectId || '-';
      projectIdEl.style.cursor = 'pointer';
      projectIdEl.title = '点击复制项目ID';
      projectIdEl.addEventListener('click', async function() {
        var id = projectIdEl.textContent;
        if (!id || id === '-') return;
        try {
          await navigator.clipboard.writeText(id);
          window.showToast('项目ID已复制', 'success');
        } catch (err) {
          // Fallback for older browsers
          var ta = document.createElement('textarea');
          ta.value = id;
          ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          var ok = document.execCommand('copy');
          document.body.removeChild(ta);
          window.showToast(ok ? '项目ID已复制' : '项目ID复制失败', ok ? 'success' : 'error');
        }
      });
    }
  }

  function renderHostProjectState() {
    if (!hostProjectSearch) return;
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
    if (hostProjectHint) hostProjectHint.textContent = '';
  }

  function updateOpenOnlineButton() {
    if (!btnOpenOnline) return;
    const baseUrl = localStorage.getItem('axhost-server-url');
    if (currentSettingsLink && currentSettingsLink.remoteProjectId && baseUrl) {
      btnOpenOnline.classList.remove('disabled');
      btnOpenOnline.dataset.url = baseUrl.replace(/\/+$/, '') + '/projects/' + currentSettingsLink.remoteProjectId + '/index.html';
    } else {
      btnOpenOnline.classList.add('disabled');
      delete btnOpenOnline.dataset.url;
    }
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
        div.addEventListener('click', function() {
          selectedHostProject = { id: p.object_id || p.id, name: p.name };
          currentSettingsLink = { remoteProjectId: p.object_id || p.id, remoteProjectName: p.name };
          hostProjectSearch.value = p.name || '';
          hostProjectDropdown.classList.remove('open');
          hostProjectHint.textContent = '';
          renderHostProjectState();
        });
        hostProjectDropdown.appendChild(div);
      });
    }
    hostProjectDropdown.classList.add('open');
  }

  if (btnOpenOnline) {
    btnOpenOnline.addEventListener('click', () => {
      if (btnOpenOnline.dataset.url) {
        window.open(btnOpenOnline.dataset.url, '_blank');
      }
    });
  }

  let settingsModalInstance = null;

  function buildSettingsHeader(container) {
    container.innerHTML =
      '<h4 class="axhost-modal-title" style="margin:0;">项目设置</h4>' +
      '<span id="settings-header-id" style="font-size:11px;color:var(--text-muted);background:var(--bg-body);border:1px solid var(--border);padding:2px 8px;border-radius:4px;font-family:Consolas,monospace;"></span>';
  }

  function buildSettingsModalBody(container) {
    container.innerHTML =
      // Tabs
      '<div class="settings-tabs" style="display:flex;border-bottom:1px solid var(--border);margin-bottom:16px;">' +
        '<button class="settings-tab active" data-tab="basic" style="flex:1;padding:8px 0;border:none;background:none;color:var(--text-main);font-size:13px;cursor:pointer;border-bottom:2px solid var(--accent);font-weight:600;">基本信息</button>' +
        '<button class="settings-tab" data-tab="git" style="flex:1;padding:8px 0;border:none;background:none;color:var(--text-muted);font-size:13px;cursor:pointer;border-bottom:2px solid transparent;">git 仓库</button>' +
      '</div>' +
      // Panel: basic
      '<div class="settings-tab-panel" id="tab-basic">' +
        '<label for="project-name-input">项目名称</label>' +
        '<input type="text" id="project-name-input" placeholder="Prototype">' +
        '<label>托管项目</label>' +
        '<div class="host-project-row">' +
          '<div class="host-project-select-wrap" id="host-project-wrap" style="flex:1;">' +
            '<input type="text" id="host-project-search" placeholder="搜索或选择项目..." autocomplete="off">' +
            '<div class="host-project-dropdown" id="host-project-dropdown"></div>' +
            '<div class="host-project-linked" id="host-project-linked" style="display:none;">' +
              '<span id="host-project-linked-name"></span>' +
              '<button class="text-btn" id="btn-unlink-project" title="解除关联">' +
                '<iconpark-icon icon-id="close-small" size="12" color="currentColor"></iconpark-icon>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<button class="text-btn" id="btn-create-remote-project" title="创建新项目" style="white-space:nowrap;">' +
            '<iconpark-icon icon-id="plus" size="14" color="currentColor"></iconpark-icon>' +
          '</button>' +
        '</div>' +
        '<div class="host-project-hint" id="host-project-hint"></div>' +
      '</div>' +
      // Panel: git
      '<div class="settings-tab-panel" id="tab-git" style="display:none;">' +
        '<div id="git-status-content" style="font-size:13px;color:var(--text-muted);text-align:center;">加载中...</div>' +
      '</div>';

    // === Tab switching ===
    var tabButtons = container.querySelectorAll('.settings-tab');
    var tabBasic = container.querySelector('#tab-basic');
    var tabGit = container.querySelector('#tab-git');
    tabButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tab = this.dataset.tab;
        tabButtons.forEach(function(b) {
          b.classList.remove('active');
          b.style.color = 'var(--text-muted)';
          b.style.borderBottomColor = 'transparent';
          b.style.fontWeight = '400';
        });
        this.classList.add('active');
        this.style.color = 'var(--text-main)';
        this.style.borderBottomColor = 'var(--accent)';
        this.style.fontWeight = '600';

        if (tab === 'basic') {
          tabBasic.style.display = '';
          tabGit.style.display = 'none';
          if (settingsModalInstance._btnConfirm) settingsModalInstance._btnConfirm.style.display = '';
        } else {
          tabBasic.style.display = 'none';
          tabGit.style.display = '';
          if (settingsModalInstance._btnConfirm) settingsModalInstance._btnConfirm.style.display = 'none';
          loadGitStatus();
        }
      });
    });

    async function loadGitStatus() {
      var content = container.querySelector('#git-status-content');
      if (!content) return;
      content.innerHTML = '<span style="color:var(--text-muted);">加载中...</span>';
      try {
        var res = await window.apiClient.getGitStatus();
        var data = res.data;
        if (!data || !data.initialized) {
          content.innerHTML = '<div style="text-align:center;padding:32px 0;color:var(--text-muted);">' +
            '<p style="margin:0;">未初始化 git 仓库</p>' +
            '<p style="font-size:11px;margin-top:4px;">请在终端中使用 <code style="background:var(--bg-body);padding:1px 4px;border-radius:2px;">git init</code> 初始化</p>' +
            '</div>';
          return;
        }
        var html = '';
        // Remotes
        html += '<div style="margin-bottom:16px;">';
        html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;font-weight:600;text-align:left;">远程列表</div>';
        if (!data.remotes || data.remotes.length === 0) {
          html += '<div style="color:var(--text-muted);font-size:12px;">暂无远程仓库</div>';
        } else {
          data.remotes.forEach(function(r) {
            var statusHtml = '';
            if (r.notFetched) {
              statusHtml = '<span style="color:var(--text-muted);">未获取（请 git fetch）</span>';
            } else if (r.ahead === 0 && r.behind === 0) {
              statusHtml = '<span style="color:#52c41a;">已同步</span>';
            } else {
              var parts = [];
              if (r.ahead > 0) parts.push('<span style="color:#1677ff;">领先 ' + r.ahead + ' commit</span>');
              if (r.behind > 0) parts.push('<span style="color:#fa8c16;">落后 ' + r.behind + ' commit</span>');
              statusHtml = parts.join(' / ');
            }
            html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-light, #f0f0f0);">' +
              '<span style="display:inline-block;padding:1px 6px;background:var(--bg-body);border:1px solid var(--border);border-radius:3px;font-family:Consolas,monospace;font-size:11px;color:var(--text-main);white-space:nowrap;">' + r.name + '</span>' +
              '<span style="font-size:12px;">' + statusHtml + '</span>' +
              '<span style="flex:1;text-align:right;font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + r.url.replace(/"/g, '&quot;') + '">' + r.url + '</span>' +
              '</div>';
          });
        }
        html += '</div>';

        // Local status
        html += '<div>';
        html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;font-weight:600;text-align:left;">本地状态</div>';
        var localLabel = '';
        var localColor = '';
        if (data.localStatus === 'clean') {
          localLabel = '工作区干净';
          localColor = '#52c41a';
        } else if (data.localStatus === 'uncommitted') {
          localLabel = '更改未提交';
          localColor = '#fa8c16';
        } else {
          localLabel = '未知';
          localColor = 'var(--text-muted)';
        }
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
          '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + localColor + ';"></span>' +
          '<span style="color:' + localColor + ';font-size:12px;">' + localLabel + '</span>' +
          '</div>';

        // Uncommitted items list
        if (data.localStatus === 'uncommitted' && data.uncommittedItems) {
          var items = data.uncommittedItems;
          var statusTag = { modified: ['修改', '#fa8c16'], deleted: ['删除', '#ff4d4f'], added: ['新增', '#52c41a'] };
          function renderGroup(label, list) {
            var h = '';
            h += '<div style="font-size:11px;color:var(--text-muted);margin-top:10px;margin-bottom:3px;font-weight:500;text-align:left;">' + label + '</div>';
            for (var i = 0; i < list.length; i++) {
              var it = list[i];
              var display = it.breadcrumb || it.name;
              var tag = statusTag[it.status] || ['修改', '#fa8c16'];
              h += '<div style="font-size:12px;color:var(--text-main);line-height:1.7;display:flex;align-items:baseline;gap:6px;">' +
                '<span style="display:inline-block;font-size:10px;padding:0 4px;border-radius:2px;color:#fff;background:' + tag[1] + ';line-height:1.6;white-space:nowrap;">' + tag[0] + '</span>' +
                '<span>' + display.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' +
                '</div>';
            }
            return h;
          }
          if (items.pages && items.pages.length > 0) {
            html += renderGroup('页面', items.pages);
          }
          if (items.components && items.components.length > 0) {
            html += renderGroup('组件', items.components);
          }
          if (items.rules && items.rules.length > 0) {
            html += renderGroup('规则', items.rules);
          }
        }
        html += '</div>';

        content.innerHTML = html;
      } catch (err) {
        content.innerHTML = '<div style="color:#ff4d4f;text-align:center;padding:20px 0;">加载失败: ' + err.message + '</div>';
      }
    }

    // Re-query global refs to point to modal body elements
    projectNameInput = container.querySelector('#project-name-input');
    hostProjectWrap = container.querySelector('#host-project-wrap');
    hostProjectSearch = container.querySelector('#host-project-search');
    hostProjectDropdown = container.querySelector('#host-project-dropdown');
    hostProjectLinked = container.querySelector('#host-project-linked');
    hostProjectLinkedName = container.querySelector('#host-project-linked-name');
    btnUnlinkProject = container.querySelector('#btn-unlink-project');
    btnCreateRemoteProject = container.querySelector('#btn-create-remote-project');
    hostProjectHint = container.querySelector('#host-project-hint');

    // Wire host project search
    hostProjectSearch.addEventListener('focus', async function() {
      if (hostProjectList.length === 0) hostProjectList = await fetchHostProjects();
      renderHostProjectDropdown(hostProjectList, hostProjectSearch.value.trim());
    });
    hostProjectSearch.addEventListener('input', function() {
      renderHostProjectDropdown(hostProjectList, hostProjectSearch.value.trim());
    });
    hostProjectSearch.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { hostProjectDropdown.classList.remove('open'); return; }
      if (e.key === 'Enter') {
        var items = hostProjectDropdown.querySelectorAll('.host-project-dropdown-item');
        var activeItem = hostProjectDropdown.querySelector('.host-project-dropdown-item.active');
        if (activeItem) { activeItem.click(); e.preventDefault(); }
        else if (items.length === 1) { items[0].click(); e.preventDefault(); }
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      var items = hostProjectDropdown.querySelectorAll('.host-project-dropdown-item');
      if (items.length === 0) return;
      var activeItem = hostProjectDropdown.querySelector('.host-project-dropdown-item.active');
      var idx = -1;
      if (activeItem) {
        activeItem.classList.remove('active');
        idx = Array.prototype.indexOf.call(items, activeItem);
      }
      if (e.key === 'ArrowDown') idx = (idx + 1) % items.length;
      else idx = (idx - 1 + items.length) % items.length;
      items[idx].classList.add('active');
    });

    // Wire click outside to close dropdown
    document.addEventListener('click', function(e) {
      if (!hostProjectDropdown.classList.contains('open')) return;
      if (!hostProjectWrap.contains(e.target)) {
        hostProjectDropdown.classList.remove('open');
      }
    });

    // Wire unlink
    btnUnlinkProject.addEventListener('click', function() {
      selectedHostProject = null;
      currentSettingsLink = null;
      hostProjectSearch.value = '';
      renderHostProjectState();
    });

    // Wire create remote project
    btnCreateRemoteProject.addEventListener('click', function() {
      var modal2 = new AxhostModal({
        title: '创建新项目',
        width: '360px',
        confirmText: '创建',
        body: function(container2) {
          container2.innerHTML =
            '<label for="settings-remote-name">项目名称</label>' +
            '<input type="text" id="settings-remote-name" placeholder="请输入项目名称" autocomplete="off">' +
            '<div class="remote-password-option" style="margin-top:12px;">' +
              '<label class="checkbox-label" style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-main);cursor:pointer;">' +
                '<input type="checkbox" id="settings-needs-pwd" style="width:16px;height:16px;cursor:pointer;">' +
                '<span>需要密码</span>' +
              '</label>' +
            '</div>' +
            '<div id="settings-pwd-field" style="display:none;margin-top:10px;">' +
              '<label for="settings-pwd-input">密码</label>' +
              '<div style="display:flex;gap:8px;">' +
                '<input type="text" id="settings-pwd-input" placeholder="请输入密码" maxlength="6" autocomplete="off" style="flex:1;">' +
                '<button class="axhost-modal-btn" id="settings-random-pwd" type="button" style="white-space:nowrap;">随机生成</button>' +
              '</div>' +
            '</div>' +
            '<div id="settings-create-error" style="color:#ff4d4f;font-size:12px;margin-top:8px;min-height:16px;"></div>';

          var needsPwd = container2.querySelector('#settings-needs-pwd');
          var pwdField = container2.querySelector('#settings-pwd-field');
          var pwdInput = container2.querySelector('#settings-pwd-input');
          container2.querySelector('#settings-random-pwd').addEventListener('click', function() {
            pwdInput.value = generateRandomPassword();
          });
          needsPwd.addEventListener('change', function() {
            pwdField.style.display = this.checked ? '' : 'none';
            if (!this.checked) pwdInput.value = '';
          });

          container2._errorEl = container2.querySelector('#settings-create-error');
          container2._needsPwd = needsPwd;
          container2._pwdInput = pwdInput;
          container2._nameInput = container2.querySelector('#settings-remote-name');
        },
        onConfirm: async function() {
          var body = modal2.getBody();
          var name = body._nameInput.value.trim();
          var errorEl = body._errorEl;
          if (!name) { errorEl.textContent = '请输入项目名称'; throw new Error(); }
          var baseUrl = localStorage.getItem('axhost-server-url');
          if (!baseUrl) { errorEl.textContent = 'AxHost 服务地址未设置'; throw new Error(); }
          var token = localStorage.getItem('axhost-token') || '';
          if (!token) { errorEl.textContent = '请先登录'; throw new Error(); }
          var res = await fetch('/api/axhost-proxy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serverUrl: baseUrl, path: '/api/projects', method: 'POST',
              headers: { 'Authorization': 'Bearer ' + token },
              body: {
                name: name,
                is_public: !(body._needsPwd && body._needsPwd.checked),
                view_password: (body._needsPwd && body._needsPwd.checked) ? (body._pwdInput ? body._pwdInput.value.trim() : '') : undefined
              }
            })
          });
          var data = await res.json();
          if (res.ok && (data.object_id || data.id)) {
            var projectId = data.object_id || data.id;
            selectedHostProject = { id: projectId, name: data.name || name };
            currentSettingsLink = { remoteProjectId: projectId, remoteProjectName: data.name || name };
            hostProjectSearch.value = data.name || name;
            renderHostProjectState();
            window.showToast('项目创建成功并已关联', 'success');
            try { await window.apiClient.postSettings({ link: currentSettingsLink }); } catch (e) {}
            updateOpenOnlineButton();
            hostProjectList = await fetchHostProjects();
          } else {
            errorEl.textContent = data.message || '创建失败';
            throw new Error();
          }
        }
      });
      modal2.open();
    });
  }

  if (btnSettings) {
    btnSettings.addEventListener('click', async function() {
      if (!settingsModalInstance) {
        settingsModalInstance = new AxhostModal({
          title: '',
          width: '360px',
          confirmText: '保存',
          header: buildSettingsHeader,
          body: buildSettingsModalBody,
          onConfirm: async function() {
            var name = projectNameInput ? projectNameInput.value.trim() : '';
            if (!name) return;
            var payload = { name: name };
            if (selectedHostProject) {
              payload.link = { remoteProjectId: selectedHostProject.id, remoteProjectName: selectedHostProject.name };
            } else if (!hostProjectLinked || hostProjectLinked.style.display === 'none') {
              payload.link = null;
            }
            try {
              await window.apiClient.postSettings(payload);
              if (projectNameEl) projectNameEl.textContent = name;
              currentSettingsLink = payload.link || null;
              updateOpenOnlineButton();
              if (hostProjectDropdown) hostProjectDropdown.classList.remove('open');
              // Notify parent home page to update tab name
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'axhost-project-renamed', name: name }, '*');
              }
              window.showToast('设置保存成功', 'success');
            } catch (err) {
              window.showToast('保存失败: ' + err.message, 'error');
              throw err;
            }
          }
        });
      }
      // loadSettings after modal created so DOM refs are valid
      await loadSettings();
      // Reset to basic tab on each open
      var body = settingsModalInstance.getBody();
      var tabs = body.querySelectorAll('.settings-tab');
      tabs.forEach(function(t) {
        var isBasic = t.dataset.tab === 'basic';
        t.classList.toggle('active', isBasic);
        t.style.color = isBasic ? 'var(--text-main)' : 'var(--text-muted)';
        t.style.borderBottomColor = isBasic ? 'var(--accent)' : 'transparent';
        t.style.fontWeight = isBasic ? '600' : '400';
      });
      var tabBasic = body.querySelector('#tab-basic');
      var tabGit = body.querySelector('#tab-git');
      if (tabBasic) tabBasic.style.display = '';
      if (tabGit) tabGit.style.display = 'none';
      if (settingsModalInstance._btnConfirm) settingsModalInstance._btnConfirm.style.display = '';
      settingsModalInstance.open();
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



  // create-remote-project - now created inside settings modal, see createSettingsRemoteProject()


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
    const pageRelativePath = `prototype/${tab}/${pagePath}`;
    const pageAbsolutePath = info.projectAbsolutePath
      ? `${info.projectAbsolutePath}/prototype/${tab}/${pagePath}`
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
      btnToggleDocs.classList.remove('active');
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
    if (btnToggleDocs) {
      btnToggleDocs.classList.remove('disabled');
      btnToggleDocs.classList.toggle('active', window.__axhostState.docsVisible);
    }
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
        const arrowIcon = rulesHeader.querySelector('iconpark-icon');
        if (arrowIcon) arrowIcon.setAttribute('icon-id', isCollapsed ? 'right' : 'down');
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

    // Copy path
    const copyPathItem = document.createElement('div');
    copyPathItem.className = 'context-menu-item';
    copyPathItem.textContent = '复制路径';
    copyPathItem.onclick = () => {
      removeRulesContextMenu();
      navigator.clipboard.writeText(`rules/${fileName}`);
    };
    menu.appendChild(copyPathItem);

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

  async function showDeleteRuleModal(fileName) {
    const ok = await window.showConfirm('删除确认', `是否删除规则文件 "${fileName}"？`);
    if (!ok) return;
    try {
      await window.apiClient.postDelete({ path: `rules/${fileName}` });
      if (activeRuleItem && activeRuleItem.dataset.name === fileName) {
        activeRuleItem = null;
        exitRuleMode();
      }
      await loadRulesList();
      window.showToast('删除成功', 'success');
    } catch (err) {
      window.showToast('删除失败: ' + err.message, 'error');
    }
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
        let maxSize = isVertical ? (targetId === 'panel-docs' ? 1200 : 400) : 300;
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
    return AxhostModal.confirm({ title: title || '提示', message: content || '' });
  };

  window.showPrompt = function (title, placeholder, defaultValue) {
    return AxhostModal.prompt({ title: title, placeholder: placeholder, defaultValue: defaultValue });
  };

  window.shell = { loadPage, exitRuleMode };
  window.onHostProjectLinked = function(remoteProjectId, remoteProjectName) {
    currentSettingsLink = { remoteProjectId: remoteProjectId, remoteProjectName: remoteProjectName };
    updateOpenOnlineButton();
  };
  window.onHostProjectUnlinked = function() {
    currentSettingsLink = null;
    updateOpenOnlineButton();
  };

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

  window.zoomControl.init();

  // Keyboard shortcuts
  function onShortcutKeyDown(e) {
    const key = e.key.toLowerCase();
    if (!['i', 't', 'd', 'n', ']'].includes(key)) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    e.preventDefault();
    if (key === 'i' && btnInspect && !btnInspect.classList.contains('disabled')) {
      btnInspect.click();
    } else if (key === 't' && btnTouchEmulation) {
      btnTouchEmulation.click();
    } else if (key === 'd' && btnToggleDocs) {
      btnToggleDocs.click();
    } else if (key === 'n' && btnToggleNav) {
      btnToggleNav.click();
    } else if (key === ']' && btnToggleRightBar) {
      btnToggleRightBar.click();
    }
  }

  document.addEventListener('keydown', onShortcutKeyDown);

  // Also bind to iframe document so shortcuts work when iframe has focus
  if (previewFrame) {
    previewFrame.addEventListener('load', () => {
      try {
        const dark = document.body.classList.contains('dark');
        const doc = previewFrame.contentDocument;
        if (doc) {
          if (doc.body) {
            doc.body.style.background = dark ? '#1e1e1e' : '';
          }
          previewFrame.contentWindow.postMessage({ type: 'axhost-theme', theme: dark ? 'dark' : 'light' }, '*');
          doc.removeEventListener('keydown', onShortcutKeyDown);
          doc.addEventListener('keydown', onShortcutKeyDown);
        }
      } catch (e) {}
    });
  }

  // Shortcuts modal
  const btnShortcuts = document.getElementById('btn-shortcuts');
  if (btnShortcuts) {
    btnShortcuts.addEventListener('click', () => {
      const modal = new AxhostModal({
        title: '快捷键',
        width: '480px',
        hideCancel: true,
        confirmText: '关闭',
        body: function(container) {
          container.innerHTML = `
      <div class="shortcuts-section">
        <h4>通用快捷键</h4>
        <div class="shortcuts-row"><kbd>T</kbd><span>触控模拟</span></div>
        <div class="shortcuts-row"><kbd>D</kbd><span>文档面板</span></div>
        <div class="shortcuts-row"><kbd>N</kbd><span>导航栏</span></div>
        <div class="shortcuts-row"><kbd>]</kbd><span>右侧面板</span></div>
      </div>
      <div class="shortcuts-section shell-only">
        <h4>开发模式专属</h4>
        <div class="shortcuts-row"><kbd>I</kbd><span>抓取元素</span></div>
      </div>
      <div class="shortcuts-section shell-only">
        <h4>Prompt Box 自动补全</h4>
        <div class="shortcuts-row"><kbd>↑</kbd><kbd>↓</kbd><span>切换选项</span></div>
        <div class="shortcuts-row"><kbd>Enter</kbd><span>确认选择</span></div>
        <div class="shortcuts-row"><kbd>Esc</kbd><span>关闭下拉框</span></div>
      </div>
      <div class="shortcuts-section shell-only">
        <h4>抓取元素模式</h4>
        <div class="shortcuts-row"><kbd>Esc</kbd><span>退出抓取</span></div>
      </div>
    `;
        }
      });
      modal.open();
    });
  }

  // Initialize
  window.addEventListener('DOMContentLoaded', () => {
    if (window.treeNav && window.treeNav.init) {
      window.treeNav.init();
    }
    initResizers();
    initRulesPanel();
  });
})();
