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
  const btnSettings = document.getElementById('btn-settings');
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsDrawer = document.getElementById('settings-drawer');
  const settingsClose = document.getElementById('settings-close');
  const projectNameInput = document.getElementById('project-name-input');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const previewFrame = document.getElementById('preview-frame');
  const projectNameEl = document.querySelector('#shell-header .title');

  // Header controls
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
      } catch (err) {
        alert('保存失败: ' + err.message);
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
    const url = `/prototype/${type}s/${pagePath}/index.html`;
    previewFrame.src = url;
    window.__axhostState.currentPage = { type, path: pagePath };
    if (window.docPanel && window.docPanel.load) {
      window.docPanel.load(type, pagePath);
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
        const maxSize = isVertical ? (targetId === 'panel-docs' ? window.innerWidth * 0.5 : 400) : 300;
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

  window.shell = { loadPage };

  // Initialize
  window.addEventListener('DOMContentLoaded', () => {
    if (window.treeNav && window.treeNav.init) {
      window.treeNav.init();
    }
    initResizers();
  });
})();
