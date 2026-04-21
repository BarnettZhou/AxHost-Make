(function () {
  const basePath = window.__axhostBasePath || './';

  const sidebar = document.getElementById('panel-nav');
  const preview = document.getElementById('preview-frame');
  const docsPanel = document.getElementById('panel-docs');
  const docsResizer = document.getElementById('docs-resizer');
  const btnDocs = document.getElementById('btn-toggle-docs');
  const btnToggleNav = document.getElementById('btn-toggle-nav');
  const docTabs = document.getElementById('doc-tabs-scroll');
  const docContent = document.getElementById('doc-content');
  const treeRoot = document.getElementById('tree-root');
  const projectNameEl = document.getElementById('project-name');
  let activePath = null;
  let activeType = 'pages';
  let currentDocs = [];
  let activeDocIndex = 0;
  let expandedPaths = new Set();
  let loadToken = 0;

  if (docsResizer && docsPanel && docsPanel.classList.contains('hidden')) {
    docsResizer.classList.add('hidden');
  }

  btnDocs.addEventListener('click', () => {
    docsPanel.classList.toggle('hidden');
    if (docsResizer) docsResizer.classList.toggle('hidden');
  });
  if (btnToggleNav) {
    btnToggleNav.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
    });
  }

  const map = window.__axhostSitemap || { name: 'Prototype', pages: [], components: [] };
  if (projectNameEl) projectNameEl.textContent = map.name || 'Prototype';

  function renderMarkdown(mdText) {
    if (!window.marked) return '<p>marked.js not loaded</p>';
    return window.marked.parse(mdText || '', { headerIds: false, mangle: false });
  }

  async function loadDocs(type, pagePath) {
    const token = ++loadToken;
    activeDocIndex = 0;
    const base = basePath + type + '/' + pagePath + '/docs/';

    const list = (window.__axhostSitemap || {})[type === 'components' ? 'components' : 'pages'] || [];
    function findNode(nodes, targetPath) {
      for (const n of nodes) {
        if ((n.type === 'page' || n.type === 'component') && n.path === targetPath) return n;
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
        const res = await fetch(base + docName);
        if (res.ok) {
          const text = await res.text();
          docs.push({ name: docName, path: base + docName, content: text });
        }
      } catch (e) {}
    }
    if (token !== loadToken) return;
    currentDocs = docs;
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
  }

  function renderDocContent() {
    if (currentDocs.length === 0) {
      docContent.innerHTML = '<p style="color:var(--text-muted)">该页面暂无文档。</p>';
      return;
    }
    const html = renderMarkdown(currentDocs[activeDocIndex].content);
    docContent.innerHTML = html;
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
    if (nodes.length === 0) {
      treeRoot.innerHTML = '<div class="empty">No ' + activeType + ' found.</div>';
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
    arrow.textContent = isExpandable ? (expandedPaths.has(node.path) ? '▼' : '▶') : '';

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
      const iconEl = label.querySelector('iconpark-icon');
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
          const prefix = type === 'components' ? 'components' : 'pages';
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
      if (n.type === 'page' || n.type === 'component') return n;
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

  function expandAncestors(nodePath) {
    const parts = nodePath.split('/');
    let prefix = '';
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'sub-pages') continue;
      prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
      if (i < parts.length - 1) {
        expandedPaths.add(prefix);
      }
    }
  }

  function getNodeTypeForTab(node) {
    return node.type === 'component' ? 'component' : 'page';
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

  initResizers();

  const hashId = location.hash ? location.hash.slice(1) : '';
  const allNodes = [...(map.pages || []), ...(map.components || [])];
  const hashNode = hashId ? findNodeById(allNodes, hashId) : null;
  const target = hashNode || findFirst(map.pages) || findFirst(map.components);
  if (target) {
    activePath = target.path;
    if (hashNode) {
      activeType = getNodeTypeForTab(target) === 'component' ? 'components' : 'pages';
    }
    renderTabs();
    expandAncestors(target.path);
    renderTree();
    const prefix = activeType === 'components' ? 'components' : 'pages';
    preview.src = basePath + prefix + '/' + target.path + '/index.html';
    loadDocs(activeType, target.path);
  } else {
    renderTabs();
    renderTree();
  }

  window.addEventListener('hashchange', () => {
    const id = location.hash ? location.hash.slice(1) : '';
    if (!id) return;
    const allNodes = [...(map.pages || []), ...(map.components || [])];
    const node = findNodeById(allNodes, id);
    if (!node) return;
    const type = getNodeTypeForTab(node);
    const tab = type === 'component' ? 'components' : 'pages';
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
})();
