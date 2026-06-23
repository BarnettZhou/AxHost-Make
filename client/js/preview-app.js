(function () {
  const basePath = window.__axhostBasePath || './';
  const map = window.__axhostSitemap || { name: 'Prototype', pages: [], components: [], flowcharts: [] };
  let activePath = null;
  let activeType = 'pages';
  let currentDocs = [];
  let activeDocIndex = 0;
  let loadToken = 0;

  const sidebar = document.getElementById('panel-nav');
  const preview = document.getElementById('preview-frame');
  const docsPanel = document.getElementById('panel-docs');
  const docsResizer = document.getElementById('docs-resizer');
  const btnDocs = document.getElementById('btn-toggle-docs');
  const btnToggleNav = document.getElementById('btn-toggle-nav');
  const btnRefreshPreview = document.getElementById('btn-refresh-preview');
  const docTabs = document.getElementById('doc-tabs-scroll');
  const docContent = document.getElementById('doc-content');
  const btnScrollLeft = document.getElementById('btn-doc-scroll-left');
  const btnScrollRight = document.getElementById('btn-doc-scroll-right');
  const treeRoot = document.getElementById('tree-root');
  const projectNameEl = document.getElementById('project-name');
  let expandedPaths = new Set();

  if (projectNameEl) projectNameEl.textContent = map.name || 'Prototype';
  document.title = map.name || 'Prototype';

  if (docsResizer && docsPanel && docsPanel.classList.contains('hidden')) {
    docsResizer.classList.add('hidden');
  }

  setupTabsScroll();

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

  btnDocs.addEventListener('click', () => {
    var hide = docsPanel.classList.contains('hidden') ? false : true;
    if (hide) freezePanelChildren(docsPanel);
    docsPanel.classList.toggle('hidden');
    if (docsResizer) docsResizer.classList.toggle('hidden');
    btnDocs.classList.toggle('active', !docsPanel.classList.contains('hidden'));
    if (window.__annotationViewer && window.__annotationViewer.setHighlightsVisible) {
      window.__annotationViewer.setHighlightsVisible(false);
    }
    setTimeout(function () {
      if (window.__annotationViewer && window.__annotationViewer.setHighlightsVisible) {
        window.__annotationViewer.setHighlightsVisible(true);
      }
      if (window.__annotationViewer && window.__annotationViewer.repositionHighlights) {
        window.__annotationViewer.repositionHighlights();
      }
    }, 300);
  });
  if (btnToggleNav) {
    btnToggleNav.addEventListener('click', () => {
      var hide = sidebar.classList.contains('hidden') ? false : true;
      if (hide) freezePanelChildren(sidebar);
      sidebar.classList.toggle('hidden');
      if (window.__annotationViewer && window.__annotationViewer.setHighlightsVisible) {
        window.__annotationViewer.setHighlightsVisible(false);
      }
      setTimeout(function () {
        if (window.__annotationViewer && window.__annotationViewer.setHighlightsVisible) {
          window.__annotationViewer.setHighlightsVisible(true);
        }
        if (window.__annotationViewer && window.__annotationViewer.repositionHighlights) {
          window.__annotationViewer.repositionHighlights();
        }
      }, 300);
    });
  }
  if (btnRefreshPreview) {
    btnRefreshPreview.addEventListener('click', () => {
      const doc = preview.contentDocument;
      if (doc && doc.location) {
        doc.location.reload();
      } else {
        preview.src = preview.src;
      }
    });
  }

  async function loadDocs(type, pagePath) {
    const token = ++loadToken;
    activeDocIndex = 0;
    const base = basePath + type + '/' + pagePath + '/docs/';

    const list = (window.__axhostSitemap || {})[type] || [];
    function findNode(nodes, targetPath) {
      for (const n of nodes) {
        if ((n.type === 'page' || n.type === 'component' || n.type === 'flowchart') && n.path === targetPath) return n;
        if (n.children) {
          const found = findNode(n.children, targetPath);
          if (found) return found;
        }
      }
      return null;
    }
    const node = findNode(list, pagePath);
    const docNames = (node && node.docs && node.docs.length > 0) ? node.docs : ['readme.md'];

    const docs = [];
    for (const docName of docNames) {
      try {
        const encodedName = encodeURIComponent(docName);
        const res = await fetch(base + encodedName);
        if (res.ok) {
          const text = await res.text();
          docs.push({ name: docName, path: base + docName, content: text });
        }
      } catch (e) {}
    }
    if (token !== loadToken) return;
    currentDocs = docs;

    // Handle pending doc from cross-page navigation
    if (window.__axhostPendingDoc && currentDocs.length > 0) {
      const idx = currentDocs.findIndex(d => d.name === window.__axhostPendingDoc);
      if (idx >= 0) activeDocIndex = idx;
      window.__axhostPendingDoc = null;
    }

    renderDocTabs();
    renderDocContent();
  }

  function renderDocTabs() {
    docTabs.innerHTML = '';
    if (currentDocs.length === 0) {
      docTabs.innerHTML = '<span style="color:var(--text-muted);font-size:12px;padding:4px 0;">暂无文档</span>';
      return;
    }
    currentDocs.forEach((doc, idx) => {
      const tab = document.createElement('div');
      tab.className = 'doc-tab' + (idx === activeDocIndex ? ' active' : '');
      tab.textContent = doc.name;
      tab.onclick = () => {
        activeDocIndex = idx;
        renderDocTabs();
        renderDocContent();
      };
      docTabs.appendChild(tab);
    });
    updateScrollButtons();
  }

  function updateScrollButtons() {
    if (!docTabs || !btnScrollLeft || !btnScrollRight) return;
    var atStart = docTabs.scrollLeft <= 1;
    var atEnd = docTabs.scrollLeft + docTabs.clientWidth >= docTabs.scrollWidth - 1;
    btnScrollLeft.classList.toggle('hidden', atStart);
    btnScrollRight.classList.toggle('hidden', atEnd);
  }

  function setupTabsScroll() {
    if (!docTabs) return;
    docTabs.addEventListener('wheel', function(e) {
      if (!e.shiftKey) return;
      e.preventDefault();
      docTabs.scrollLeft += e.deltaY;
      updateScrollButtons();
    }, { passive: false });
    docTabs.addEventListener('scroll', updateScrollButtons);
    btnScrollLeft.addEventListener('click', function() {
      docTabs.scrollBy({ left: -200, behavior: 'smooth' });
    });
    btnScrollRight.addEventListener('click', function() {
      docTabs.scrollBy({ left: 200, behavior: 'smooth' });
    });
  }

  function renderDocContent() {
    if (currentDocs.length === 0) {
      docContent.innerHTML = '<p style="color:var(--text-muted)">该页面暂无文档。</p>';
      return;
    }
    const html = window.mdRenderer.renderMarkdown(currentDocs[activeDocIndex].content);
    docContent.innerHTML = `<div class="doc-view">${html}</div>`;
    const view = docContent.querySelector('.doc-view');
    if (view) attachDocLinkHandler(view);
  }

  function renderTabs() {
    const tabs = document.querySelectorAll('.nav-tabs button');
    tabs.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === activeType);
      btn.onclick = () => {
        activeType = btn.dataset.tab;
        renderTabs();
        renderTree();
      };
    });
  }

  function renderTree() {
    const nodes = map[activeType] || [];
    treeRoot.innerHTML = '';
    if (activeType === 'wiki') {
      return;
    }
    if (nodes.length === 0) {
      const typeMap = { pages: '页面', components: '组件', flowcharts: '流程图' };
      const label = typeMap[activeType] || activeType;
      treeRoot.innerHTML = '<div class="empty"><iconpark-icon icon-id="inbox" size="32" color="#bbb"></iconpark-icon><span>暂无' + label + '</span></div>';
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'tree-list';
    for (const node of nodes) {
      ul.appendChild(buildNode(node, activeType, 0));
    }
    treeRoot.appendChild(ul);
  }

  function buildNode(node, type, level = 0) {
    const li = document.createElement('li');
    li.className = 'tree-item';
    const label = document.createElement('div');
    label.className = 'tree-label';
    label.style.paddingLeft = (level * 16 + 8) + 'px';
    if (activePath === node.path) label.classList.add('active');

    const hasChildren = node.children && node.children.length > 0;
    const isExpandable = node.type === 'dir' || hasChildren;

    const arrow = document.createElement('span');
    arrow.className = 'tree-arrow';
    if (isExpandable) {
      const arrowIcon = document.createElement('iconpark-icon');
      arrowIcon.setAttribute('icon-id', expandedPaths.has(node.path) ? 'down' : 'right');
      arrowIcon.setAttribute('size', '12');
      arrowIcon.setAttribute('color', 'currentColor');
      arrowIcon.setAttribute('stroke', 'currentColor');
      arrowIcon.setAttribute('fill', 'currentColor');
      arrow.appendChild(arrowIcon);
    }

    let icon = null;
    if (node.type === 'dir') {
      icon = document.createElement('iconpark-icon');
      icon.setAttribute('size', '12');
      icon.setAttribute('color', 'currentColor');
      icon.setAttribute('icon-id', expandedPaths.has(node.path) ? 'folder-open' : 'folder-close');
    } else if (node.type === 'page') {
      icon = document.createElement('iconpark-icon');
      icon.setAttribute('size', '12');
      icon.setAttribute('color', 'currentColor');
      icon.setAttribute('icon-id', 'page');
    } else if (node.type === 'component') {
      icon = document.createElement('iconpark-icon');
      icon.setAttribute('size', '12');
      icon.setAttribute('color', 'currentColor');
      icon.setAttribute('icon-id', 'figma-component');
    } else if (node.type === 'flowchart') {
      icon = document.createElement('iconpark-icon');
      icon.setAttribute('size', '12');
      icon.setAttribute('color', 'currentColor');
      icon.setAttribute('icon-id', 'split-turn-down-right');
    }

    const text = document.createElement('span');
    text.textContent = node.name;

    label.appendChild(arrow);
    if (icon) label.appendChild(icon);
    label.appendChild(text);
    li.appendChild(label);

    if (isExpandable) {
      if (expandedPaths.has(node.path)) {
        const childrenUl = document.createElement('ul');
        childrenUl.className = 'tree-list';
        for (const child of (node.children || [])) {
          childrenUl.appendChild(buildNode(child, type, level + 1));
        }
        li.appendChild(childrenUl);
      }

      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        if (expandedPaths.has(node.path)) {
          expandedPaths.delete(node.path);
        } else {
          expandedPaths.add(node.path);
        }
        renderTree();
      });
    }

    if (node.type === 'dir') {
      label.addEventListener('click', () => {
        if (expandedPaths.has(node.path)) {
          expandedPaths.delete(node.path);
        } else {
          expandedPaths.add(node.path);
        }
        renderTree();
      });
      const iconEl = label.querySelector(':scope > iconpark-icon');
      if (iconEl) {
        iconEl.setAttribute('icon-id', expandedPaths.has(node.path) ? 'folder-open' : 'folder-close');
      }
    } else {
      label.addEventListener('click', () => {
        activePath = node.path;
        const expectedHash = '#' + node.id;
        if (location.hash !== expectedHash) {
          location.hash = expectedHash;
        } else {
          // hash 未变化（如点击当前已选中页面），直接触发加载
          const prefix = type;
          preview.src = basePath + prefix + '/' + node.path + '/index.html';
          loadDocs(type, node.path);
        }
        renderTree();
      });
    }
    return li;
  }

  function findFirst(nodes) {
    for (const n of nodes) {
      if (n.type === 'page' || n.type === 'component' || n.type === 'flowchart') return n;
      if (n.children) {
        const f = findFirst(n.children);
        if (f) return f;
      }
    }
    return null;
  }

  function findNodeById(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const f = findNodeById(n.children, id);
        if (f) return f;
      }
    }
    return null;
  }

  function findNodeByPath(nodes, targetPath) {
    for (const n of nodes) {
      if ((n.type === 'page' || n.type === 'component' || n.type === 'flowchart') && n.path === targetPath) return n;
      if (n.children) {
        const f = findNodeByPath(n.children, targetPath);
        if (f) return f;
      }
    }
    return null;
  }

  function expandAncestors(nodePath) {
    const parts = nodePath.split('/');
    let prefix = '';
    for (let i = 0; i < parts.length; i++) {
      prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
      if (i < parts.length - 1) {
        expandedPaths.add(prefix);
      }
    }
  }

  function expandAll(nodes) {
    for (const node of nodes) {
      if (node.children && node.children.length) {
        expandedPaths.add(node.path);
        expandAll(node.children);
      }
    }
  }

  function getNodeTypeForTab(node) {
    if (node.type === 'component') return 'component';
    if (node.type === 'flowchart') return 'flowchart';
    return 'page';
  }

  function initResizers() {
    let overlay = null;
    document.querySelectorAll('.resizer').forEach(resizer => {
      const target = document.getElementById(resizer.dataset.target);
      if (!target) return;
      const invert = resizer.dataset.invert === 'true';
      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.body.style.userSelect = 'none';
        target.classList.add('resizing');
        overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:transparent;cursor:col-resize;';
        document.body.appendChild(overlay);
        const startX = e.clientX;
        const startWidth = target.offsetWidth;
        const maxWidth = resizer.dataset.target === 'panel-docs' ? window.innerWidth * 0.5 : 400;
        function onMove(ev) {
          const delta = invert ? startX - ev.clientX : ev.clientX - startX;
          target.style.width = Math.max(180, Math.min(maxWidth, startWidth + delta)) + 'px';
          if (window.__annotationViewer && window.__annotationViewer.setHighlightsVisible) {
            window.__annotationViewer.setHighlightsVisible(false);
          }
        }
        function onUp() {
          document.body.style.userSelect = '';
          target.classList.remove('resizing');
          if (overlay) { overlay.remove(); overlay = null; }
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          if (window.__annotationViewer && window.__annotationViewer.setHighlightsVisible) {
            window.__annotationViewer.setHighlightsVisible(true);
          }
          if (window.__annotationViewer && window.__annotationViewer.repositionHighlights) {
            window.__annotationViewer.repositionHighlights();
          }
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  initResizers();

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'axhost-navigate') {
      const { path, tab } = e.data;
      const allNodes = [...(map.pages || []), ...(map.components || []), ...(map.flowcharts || [])];
      const node = findNodeById(allNodes, path);
      if (!node) return;
      const type = getNodeTypeForTab(node);
      const targetTab = type === 'component' ? 'components' : type === 'flowchart' ? 'flowcharts' : 'pages';
      if (activeType !== targetTab) {
        activeType = targetTab;
        renderTabs();
      }
      activePath = node.path;
      expandAncestors(node.path);
      renderTree();
      preview.src = basePath + targetTab + '/' + node.path + '/index.html';
      loadDocs(targetTab, node.path);
    }
  });

  function attachDocLinkHandler(container) {
    container.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-doc-link]');
      if (!link) return;
      e.preventDefault();
      const mode = link.dataset.docLink;
      const docName = link.dataset.docName;
      if (!docName) return;
      if (mode === 'same-page') {
        const idx = currentDocs.findIndex(d => d.name === docName);
        if (idx >= 0) {
          activeDocIndex = idx;
          renderDocTabs();
          renderDocContent();
        }
        return;
      }
      if (mode === 'cross-page') {
        const type = link.dataset.docType;
        const path = link.dataset.docPath;
        if (!type || !path) return;
        const tab = type === 'component' ? 'components' : type === 'flowchart' ? 'flowcharts' : 'pages';
        if (tab === activeType && path === activePath) {
          const idx = currentDocs.findIndex(d => d.name === docName);
          if (idx >= 0) {
            activeDocIndex = idx;
            renderDocTabs();
            renderDocContent();
          }
          return;
        }
        const allNodes = [...(map.pages || []), ...(map.components || []), ...(map.flowcharts || [])];
        const node = findNodeByPath(allNodes, path);
        if (node) {
          window.__axhostPendingDoc = docName;
          location.hash = '#' + node.id;
        }
      }
    });
  }

  const hashId = location.hash ? location.hash.slice(1) : '';
  const allNodes = [...(map.pages || []), ...(map.components || []), ...(map.flowcharts || [])];
  const hashNode = hashId ? findNodeById(allNodes, hashId) : null;
  const target = hashNode || findFirst(map.pages) || findFirst(map.components) || findFirst(map.flowcharts);
  if (target) {
    activePath = target.path;
    if (hashNode) {
      activeType = getNodeTypeForTab(target) === 'component' ? 'components' : getNodeTypeForTab(target) === 'flowchart' ? 'flowcharts' : 'pages';
    } else {
      activeType = getNodeTypeForTab(target) === 'component' ? 'components' : getNodeTypeForTab(target) === 'flowchart' ? 'flowcharts' : 'pages';
      history.replaceState(null, '', '#' + target.id);
    }
    renderTabs();
    expandAncestors(target.path);
    expandAll(map.pages || []);
    expandAll(map.components || []);
    expandAll(map.flowcharts || []);
    renderTree();
    const prefix = activeType;
    preview.src = basePath + prefix + '/' + target.path + '/index.html';
    loadDocs(activeType, target.path);
  } else {
    renderTabs();
    expandAll(map.pages || []);
    expandAll(map.components || []);
    expandAll(map.flowcharts || []);
    renderTree();
  }

  window.addEventListener('hashchange', () => {
    const id = location.hash ? location.hash.slice(1) : '';
    if (!id) return;
    const allNodes = [...(map.pages || []), ...(map.components || []), ...(map.flowcharts || [])];
    const node = findNodeById(allNodes, id);
    if (!node) return;
    const type = getNodeTypeForTab(node);
    const tab = type === 'component' ? 'components' : type === 'flowchart' ? 'flowcharts' : 'pages';
    if (activeType !== tab) {
      activeType = tab;
      renderTabs();
    }
    activePath = node.path;
    expandAncestors(node.path);
    renderTree();
    preview.src = basePath + tab + '/' + node.path + '/index.html';
    loadDocs(tab, node.path);
  });

  window.zoomControl.init();

  // Touch emulation — drag to scroll like mobile finger touch
  // Touch emulation — drag to scroll like mobile finger touch
  const btnTouchEmulation = document.getElementById('btn-touch-emulation');
  const touchEmu = window.touchEmulation.init(preview);
  let touchEmulationActive = false;

  if (btnTouchEmulation) {
    btnTouchEmulation.addEventListener('click', () => {
      touchEmulationActive = !touchEmulationActive;
      btnTouchEmulation.classList.toggle('active', touchEmulationActive);
      touchEmu.setActive(touchEmulationActive);
      touchEmu.sync();
    });
    preview.addEventListener('load', () => {
      if (touchEmulationActive) touchEmu.attach();
    });
  }

  // Keyboard shortcuts
  function onShortcutKeyDown(e) {
    const key = e.key.toLowerCase();
    if (!['t', 'd', 'n'].includes(key)) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    e.preventDefault();
    if (key === 't' && btnTouchEmulation) {
      btnTouchEmulation.click();
    } else if (key === 'd' && btnDocs) {
      btnDocs.click();
    } else if (key === 'n' && btnToggleNav) {
      btnToggleNav.click();
    }
  }

  document.addEventListener('keydown', onShortcutKeyDown);

  // Also bind to iframe document so shortcuts work when iframe has focus
  preview.addEventListener('load', () => {
    try {
      const dark = document.body.classList.contains('dark');
      const doc = preview.contentDocument;
      if (doc) {
        if (doc.body) {
          doc.body.style.background = dark ? '#1e1e1e' : '';
        }
        preview.contentWindow.postMessage({ type: 'axhost-theme', theme: dark ? 'dark' : 'light' }, '*');
        doc.removeEventListener('keydown', onShortcutKeyDown);
        doc.addEventListener('keydown', onShortcutKeyDown);
      }
    } catch (e) {}
  });

  // Shortcuts modal
  const btnShortcuts = document.getElementById('btn-shortcuts');
  const shortcutsModal = document.getElementById('shortcuts-modal');
  const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');
  const shortcutsBody = document.getElementById('shortcuts-body');
  if (btnShortcuts && shortcutsModal && shortcutsBody) {
    shortcutsBody.innerHTML = `
      <div class="shortcuts-section">
        <h4>通用快捷键</h4>
        <div class="shortcuts-row"><kbd>T</kbd><span>触控模拟</span></div>
        <div class="shortcuts-row"><kbd>D</kbd><span>文档面板</span></div>
        <div class="shortcuts-row"><kbd>N</kbd><span>导航栏</span></div>
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
    // Hide shell-only shortcuts in preview mode
    shortcutsBody.querySelectorAll('.shell-only').forEach(el => el.style.display = 'none');
    btnShortcuts.addEventListener('click', () => {
      shortcutsModal.classList.add('active');
    });
    if (btnCloseShortcuts) {
      btnCloseShortcuts.addEventListener('click', () => {
        shortcutsModal.classList.remove('active');
      });
    }
    shortcutsModal.addEventListener('click', (e) => {
      if (e.target === shortcutsModal) shortcutsModal.classList.remove('active');
    });
  }
})();
