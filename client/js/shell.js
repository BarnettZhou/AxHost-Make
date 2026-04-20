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
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsDrawer = document.getElementById('settings-drawer');
  const settingsClose = document.getElementById('settings-close');
  const projectNameInput = document.getElementById('project-name-input');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const previewFrame = document.getElementById('preview-frame');
  const projectNameEl = document.querySelector('#shell-header .title');

  // Header controls
  const projectId = window.__axhostProjectId || '';
  const prototypeBase = projectId ? `/project/${projectId}/prototype` : '/prototype';

  if (btnPreview) {
    btnPreview.addEventListener('click', () => {
      window.open(`${prototypeBase}/index.html`, '_blank');
    });
  }

  btnToggleNav.addEventListener('click', () => {
    window.__axhostState.navVisible = !window.__axhostState.navVisible;
    panelNav.classList.toggle('hidden', !window.__axhostState.navVisible);
  });

  btnToggleDocs.addEventListener('click', () => {
    window.__axhostState.docsVisible = !window.__axhostState.docsVisible;
    panelDocs.classList.toggle('hidden', !window.__axhostState.docsVisible);
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

  if (btnSettings && settingsDrawer) {
    btnSettings.addEventListener('click', () => {
      settingsDrawer.classList.add('open');
      settingsOverlay.classList.add('open');
    });
    settingsClose.addEventListener('click', closeSettings);
    settingsOverlay.addEventListener('click', closeSettings);
  }

  function closeSettings() {
    settingsDrawer.classList.remove('open');
    settingsOverlay.classList.remove('open');
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      const name = projectNameInput.value.trim();
      if (!name) return;
      try {
        await window.apiClient.postSettings({ name });
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
        overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:transparent;cursor:' + (isVertical ? 'col-resize' : 'row-resize') + ';';
        document.body.appendChild(overlay);
        const startPos = isVertical ? e.clientX : e.clientY;
        const startSize = isVertical ? target.offsetWidth : target.offsetHeight;
        const minSize = isVertical ? 180 : 80;
        const maxSize = isVertical ? (targetId === 'panel-docs' ? window.innerWidth * 0.5 : 400) : (targetId === 'prompt-box' ? 600 : 300);
        function onMove(ev) {
          const currentPos = isVertical ? ev.clientX : ev.clientY;
          let delta = invert ? startPos - currentPos : currentPos - startPos;
          let newSize = Math.max(minSize, Math.min(maxSize, startSize + delta));
          target.style[isVertical ? 'width' : 'height'] = newSize + 'px';
        }
        function onUp() {
          document.body.style.userSelect = '';
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

  window.shell = { loadPage };

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
  });
})();
