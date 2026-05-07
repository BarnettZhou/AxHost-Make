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
    btnDocs.classList.toggle('active', !docsPanel.classList.contains('hidden'));
  });
  if (btnToggleNav) {
    btnToggleNav.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
    });
  }

  const map = window.__axhostSitemap || { name: 'Prototype', pages: [], components: [], flowcharts: [] };
  if (projectNameEl) projectNameEl.textContent = map.name || 'Prototype';
  document.title = map.name || 'Prototype';

  function renderMarkdown(mdText) {
    if (!window.marked) return '<p>marked.js not loaded</p>';
    return window.marked.parse(mdText || '', { headerIds: false, mangle: false });
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
      if (node.type === 'dir') {
        expandedPaths.add(node.path);
      }
      if (node.children && node.children.length) {
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

  const hashId = location.hash ? location.hash.slice(1) : '';
  const allNodes = [...(map.pages || []), ...(map.components || []), ...(map.flowcharts || [])];
  const hashNode = hashId ? findNodeById(allNodes, hashId) : null;
  const target = hashNode || findFirst(map.pages) || findFirst(map.components) || findFirst(map.flowcharts);
  if (target) {
    activePath = target.path;
    if (hashNode) {
      activeType = getNodeTypeForTab(target) === 'component' ? 'components' : getNodeTypeForTab(target) === 'flowchart' ? 'flowcharts' : 'pages';
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

  // Touch emulation — drag to scroll like mobile finger touch
  const btnTouchEmulation = document.getElementById('btn-touch-emulation');
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
    const doc = preview.contentDocument;
    const win = preview.contentWindow;
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
    const doc = preview.contentDocument;
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
    preview.addEventListener('load', () => {
      if (touchEmulationActive) attachTouchEmulation();
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
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
  });
})();
