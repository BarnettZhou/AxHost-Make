(function () {
  const iframe = document.getElementById('preview-frame');
  const btnInspect = document.getElementById('btn-inspect');
  if (!iframe || !btnInspect) return;

  let active = false;
  let popup = null;
  let highlightEl = null;
  let overlayEl = null;
  let hoverOverlayEl = null;
  let injectedStyle = null;
  let locked = false;
  let currentTab = 'selector';        // 'selector' | 'annotation'
  let annotationDirty = false;
  let savedAnnotationContent = '';
  let currentSelector = '';

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      active = false;
      btnInspect.classList.remove('active');
      detachListeners();
      setInspectCursor(false);
      document.removeEventListener('keydown', onKeyDown);
    }
  }

  btnInspect.addEventListener('click', () => {
    active = !active;
    btnInspect.classList.toggle('active', active);
    if (active) {
      attachListeners();
      setInspectCursor(true);
      document.addEventListener('keydown', onKeyDown);
    } else {
      detachListeners();
      setInspectCursor(false);
      document.removeEventListener('keydown', onKeyDown);
    }
  });

  // Re-attach when iframe loads new page
  iframe.addEventListener('load', () => {
    if (active) {
      injectedStyle = null;
      overlayEl = null;
      hoverOverlayEl = null;
      attachListeners();
      setInspectCursor(true);
    }
  });

  function getDoc() {
    try { return iframe.contentDocument; } catch (e) { return null; }
  }

  function getThemeColors() {
    const s = getComputedStyle(document.body);
    return {
      bgPanel: s.getPropertyValue('--bg-panel').trim() || '#ffffff',
      border: s.getPropertyValue('--border').trim() || '#e0e0e0',
      textMain: s.getPropertyValue('--text-main').trim() || '#333333',
      textMuted: s.getPropertyValue('--text-muted').trim() || '#666666',
      accent: s.getPropertyValue('--accent').trim() || '#007acc'
    };
  }

  function buildPopupCSS() {
    const c = getThemeColors();
    return `
      .inspector-overlay {
        position: absolute;
        z-index: 999998;
        pointer-events: none;
        background: rgba(22, 119, 255, 0.15);
        border: 1px solid rgba(22, 119, 255, 0.8);
        border-radius: 2px;
        transition: all 0.05s ease;
        display: none;
      }
      .inspector-overlay.locked {
        background: rgba(22, 119, 255, 0.25);
        border: 2px solid #1677ff;
        box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.2);
      }
      .inspector-popup {
        position: absolute;
        z-index: 999999;
        background: ${c.bgPanel};
        border: 1px solid ${c.border};
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        width: 240px;
        font-size: 13px;
        color: ${c.textMain};
        user-select: text;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        line-height: 1.4;
      }
      .inspector-popup-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0;
        border-bottom: 1px solid ${c.border};
        gap: 0;
      }
      .inspector-popup-tabs {
        display: flex;
        align-items: center;
        gap: 0;
        padding: 0 12px;
      }
      .inspector-popup-tabs button {
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: ${c.textMuted};
        cursor: pointer;
        padding: 10px 12px;
        font-size: 13px;
        transition: color 0.15s, border-color 0.15s;
      }
      .inspector-popup-tabs button:hover {
        color: ${c.textMain};
      }
      .inspector-popup-tabs button.active {
        color: ${c.accent};
        border-bottom-color: ${c.accent};
      }
      .inspector-header-left {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .inspector-text {
        color: ${c.textMuted};
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .inspector-tag {
        font-family: Consolas, monospace;
        font-size: 14px;
        color: ${c.accent};
        font-weight: 500;
      }
      .inspector-popup-close {
        background: transparent;
        border: none;
        color: ${c.textMuted};
        font-size: 18px;
        cursor: pointer;
        line-height: 1;
        padding: 10px 12px;
        margin: 0;
      }
      .inspector-popup-close:hover {
        color: ${c.textMain};
      }
      .inspector-popup-body {
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      /* Annotation tab */
      .inspector-annotation-body {
        display: none;
        padding: 0;
      }
      .inspector-annotation-body.active {
        display: flex;
        flex-direction: column;
      }
      .inspector-annotation-body textarea {
        width: 100%;
        min-height: 120px;
        background: transparent;
        color: ${c.textMain};
        border: none;
        padding: 0;
        resize: vertical;
        outline: none;
        font-family: inherit;
        font-size: 13px;
        line-height: 1.5;
      }
      .inspector-annotation-body textarea::placeholder {
        color: ${c.textMuted};
        opacity: 0.6;
      }
      .inspector-selector-body { display: block; }
      .inspector-selector-body.hidden { display: none; }
      .inspector-selector-footer { display: flex; }
      .inspector-selector-footer.hidden { display: none; }
      .inspector-annotation-footer {
        display: none;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-top: 1px solid ${c.border};
      }
      .inspector-annotation-footer.active {
        display: flex;
      }
      .annotation-dirty-hint {
        color: #e67e22;
        font-size: 12px;
        display: none;
      }
      .annotation-dirty-hint.visible {
        display: inline;
      }
      .annotation-saved-hint {
        color: #27ae60;
        font-size: 12px;
        display: none;
      }
      .annotation-saved-hint.visible {
        display: inline;
      }
      .annotation-save-btn {
        margin-left: auto;
        background: #1677ff;
        color: #fff;
        border: none;
        padding: 5px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .annotation-save-btn:hover {
        opacity: 0.9;
      }
      .inspector-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .inspector-row label {
        color: ${c.textMuted};
        font-size: 12px;
        width: 42px;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .inspector-row span {
        flex: 1;
        word-break: break-all;
        font-family: Consolas, monospace;
        font-size: 12px;
        color: ${c.textMain};
        min-height: 16px;
      }
      .inspector-selector-footer {
        padding: 8px 12px;
        border-top: 1px solid ${c.border};
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .inspector-copy-selector {
        margin-left: auto;
        background: #1677ff;
        color: #fff;
        border: none;
        padding: 5px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .inspector-copy-selector:hover {
        opacity: 0.9;
      }

      .inspector-popup-footer .text-btn {
        background: transparent;
        border: none;
        color: ${c.textMuted};
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        line-height: 1;
      }
      .inspector-popup-footer .text-btn:hover:not(:disabled) {
        color: ${c.textMain};
        background: rgba(0,0,0,0.05);
      }
      .inspector-popup-footer .text-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    `;
  }

  function injectStyles(doc) {
    if (!doc || !doc.head) return;
    if (injectedStyle && injectedStyle.ownerDocument === doc) return;
    removeStyles();
    injectedStyle = doc.createElement('style');
    injectedStyle.textContent = buildPopupCSS();
    doc.head.appendChild(injectedStyle);
  }

  function removeStyles() {
    if (injectedStyle && injectedStyle.parentNode) {
      injectedStyle.parentNode.removeChild(injectedStyle);
    }
    injectedStyle = null;
  }

  function injectIconPark(doc) {
    if (!doc || !doc.head) return;
    if (doc.querySelector('script[data-iconpark]')) return;
    var script = doc.createElement('script');
    script.src = '/client/js/icon-loader-shell.js';
    script.defer = true;
    doc.head.appendChild(script);
  }

  function createOverlay(doc) {
    if (overlayEl && overlayEl.ownerDocument === doc && hoverOverlayEl && hoverOverlayEl.ownerDocument === doc) return;
    removeOverlay();
    overlayEl = doc.createElement('div');
    overlayEl.className = 'inspector-overlay';
    doc.body.appendChild(overlayEl);
    hoverOverlayEl = doc.createElement('div');
    hoverOverlayEl.className = 'inspector-overlay';
    doc.body.appendChild(hoverOverlayEl);
  }

  function removeOverlay() {
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
    if (hoverOverlayEl && hoverOverlayEl.parentNode) {
      hoverOverlayEl.parentNode.removeChild(hoverOverlayEl);
    }
    hoverOverlayEl = null;
  }

  function attachListeners() {
    const doc = getDoc();
    if (!doc) return;
    injectStyles(doc);
    injectIconPark(doc);
    createOverlay(doc);
    doc.addEventListener('mouseover', onMouseOver, true);
    doc.addEventListener('mouseout', onMouseOut, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('mousedown', onMouseDown, true);
    doc.addEventListener('keydown', onKeyDown);

    // Intercept iframe navigation when annotation is dirty
    var iframeWindow = doc.defaultView;
    if (iframeWindow) {
      iframeWindow.addEventListener('beforeunload', onBeforeUnload);
    }
  }

  function onBeforeUnload(e) {
    if (annotationDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  }

  function detachListeners() {
    const doc = getDoc();
    if (doc) {
      doc.removeEventListener('mouseover', onMouseOver, true);
      doc.removeEventListener('mouseout', onMouseOut, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('mousedown', onMouseDown, true);
      doc.removeEventListener('keydown', onKeyDown);
      var iframeWindow = doc.defaultView;
      if (iframeWindow) {
        iframeWindow.removeEventListener('beforeunload', onBeforeUnload);
      }
    }
    clearInspectState();
    removeOverlay();
    removeStyles();
    document.removeEventListener('keydown', onKeyDown);
  }

  function setInspectCursor(enable) {
    const doc = getDoc();
    if (!doc || !doc.documentElement) return;
    doc.documentElement.style.cursor = enable ? 'crosshair' : '';
  }

  function isInspectorElement(el) {
    return el.closest && el.closest('.inspector-popup');
  }

  function onMouseOver(e) {
    if (!active) return;
    if (isInspectorElement(e.target)) return;
    e.stopPropagation();
    if (locked) {
      highlightElement(e.target, true);
    } else {
      highlightElement(e.target);
    }
  }

  function onMouseOut(e) {
    if (!active) return;
    if (isInspectorElement(e.target)) return;
    e.stopPropagation();
    if (locked && highlightEl) {
      highlightElement(highlightEl);
    } else {
      removeHighlight();
    }
  }

  function onMouseDown(e) {
    if (!active) return;
    if (isInspectorElement(e.target)) return;
    e.stopPropagation();
  }

  async function onClick(e) {
    if (!active) return;
    if (isInspectorElement(e.target)) return;
    if (annotationDirty) {
      var ok = await AxhostModal.confirm({ title: '提示', message: '当前有标注未保存，确认离开？' });
      if (!ok) return;
    }
    e.preventDefault();
    e.stopPropagation();
    locked = true;
    highlightElement(e.target);
    showPopup(e.target);
  }

  function highlightElement(el, isTemp) {
    const doc = getDoc();
    if (!doc) return;
    const targetOverlay = isTemp ? hoverOverlayEl : overlayEl;
    if (!targetOverlay) return;
    if (!isTemp) {
      highlightEl = el;
      if (hoverOverlayEl) {
        hoverOverlayEl.classList.remove('locked');
        hoverOverlayEl.style.display = 'none';
      }
    }
    const rect = el.getBoundingClientRect();
    targetOverlay.style.left = rect.left + 'px';
    targetOverlay.style.top = rect.top + 'px';
    targetOverlay.style.width = rect.width + 'px';
    targetOverlay.style.height = rect.height + 'px';
    targetOverlay.classList.toggle('locked', true);
    targetOverlay.style.display = 'block';
  }

  function removeHighlight() {
    highlightEl = null;
    if (overlayEl) {
      overlayEl.classList.remove('locked');
      overlayEl.style.display = 'none';
    }
    if (hoverOverlayEl) {
      hoverOverlayEl.classList.remove('locked');
      hoverOverlayEl.style.display = 'none';
    }
  }

  function showPopup(targetEl, opts) {
    const doc = getDoc();
    if (!doc) return;
    hidePopup();

    popup = doc.createElement('div');
    popup.className = 'inspector-popup';

    const tagName = targetEl.tagName.toLowerCase();
    const elId = targetEl.id || '';
    const elClass = targetEl.className || '';
    const text = (targetEl.textContent || '').trim().replace(/\s+/g, ' ');
    const displayText = text.length > 50 ? text.slice(0, 50) + '…' : text;
    const rect = targetEl.getBoundingClientRect();
    const computed = getComputedStyle(targetEl);
    const fontSize = computed.fontSize || '-';
    const dims = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    const hasParent = !!targetEl.parentElement && targetEl.parentElement !== doc.body;

    currentSelector = generateSelector(targetEl);
    currentTab = 'selector';
    annotationDirty = false;
    savedAnnotationContent = '';

    popup.innerHTML = `
      <div class="inspector-popup-header">
        <div class="inspector-popup-tabs">
          <button data-tab="selector" class="active">选择器</button>
          <button data-tab="annotation">元素标注</button>
        </div>
        <button class="inspector-popup-close">&times;</button>
      </div>
      <div class="inspector-popup-body">
        <div class="inspector-selector-body">
          <div class="inspector-row"><label>标签</label><span>&lt;${tagName}&gt;</span></div>
          <div class="inspector-row"><label>ID</label><span>${escapeHtml(elId)}</span></div>
          <div class="inspector-row"><label>Class</label><span>${escapeHtml(elClass)}</span></div>
          <div class="inspector-row"><label>尺寸</label><span>${escapeHtml(dims)}</span></div>
          <div class="inspector-row"><label>字号</label><span>${escapeHtml(fontSize)}</span></div>
        </div>
        <div class="inspector-annotation-body">
          <textarea placeholder="输入 Markdown 标注..."></textarea>
        </div>
      </div>
      <div class="inspector-popup-footer">
        <div class="inspector-selector-footer">
          <button class="inspector-popup-parent text-btn" title="选中父元素" ${hasParent ? '' : 'disabled'}>
            <iconpark-icon icon-id="up" size="14" color="currentColor"></iconpark-icon>
          </button>
          <button class="inspector-copy-image text-btn" title="复制为图片">
            <iconpark-icon icon-id="down-picture" size="14" color="currentColor"></iconpark-icon>
          </button>
          <button class="inspector-copy-selector">复制选择器</button>
        </div>
        <div class="inspector-annotation-footer">
          <span class="annotation-dirty-hint">内容未保存</span>
          <span class="annotation-saved-hint">已保存</span>
          <button class="annotation-save-btn">保存</button>
        </div>
      </div>
    `;

    doc.body.appendChild(popup);

    // Position
    if (opts && opts.left != null && opts.top != null) {
      popup.style.left = opts.left;
      popup.style.top = opts.top;
    } else {
      const viewportHeight = doc.documentElement.clientHeight;
      const viewportWidth = doc.documentElement.clientWidth;
      const popupWidth = popup.offsetWidth || 220;
      const popupHeight = popup.offsetHeight || 180;

      let top = rect.bottom + 4;
      if (top + popupHeight > viewportHeight) {
        top = rect.top - popupHeight - 4;
      }
      if (top < 4) {
        top = 4;
      }

      let left = rect.left;
      if (left + popupWidth > viewportWidth) {
        left = viewportWidth - popupWidth - 4;
        if (left < 4) left = 4;
      }
      if (left < 4) left = 4;

      popup.style.left = left + 'px';
      popup.style.top = top + 'px';
    }

    // Tab switching
    var tabButtons = popup.querySelectorAll('.inspector-popup-tabs button');
    var selectorBody = popup.querySelector('.inspector-selector-body');
    var annotationBody = popup.querySelector('.inspector-annotation-body');
    var selectorFooter = popup.querySelector('.inspector-selector-footer');
    var annotationFooter = popup.querySelector('.inspector-annotation-footer');
    var annotationTextarea = popup.querySelector('.inspector-annotation-body textarea');
    var dirtyHint = popup.querySelector('.annotation-dirty-hint');
    var savedHint = popup.querySelector('.annotation-saved-hint');
    var saveBtn = popup.querySelector('.annotation-save-btn');
    var savedTimer = null;

    function switchTab(tab) {
      if (tab === currentTab) return;
      currentTab = tab;
      tabButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
      });
      var isSelector = tab === 'selector';
      selectorBody.classList.toggle('hidden', !isSelector);
      annotationBody.classList.toggle('active', !isSelector);
      selectorFooter.classList.toggle('hidden', !isSelector);
      annotationFooter.classList.toggle('active', !isSelector);

      if (tab === 'annotation') {
        loadAnnotation();
      }
    }

    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.stopPropagation();
        var tab = btn.getAttribute('data-tab');
        if (tab === currentTab) return;
        if (annotationDirty) {
          var ok = await AxhostModal.confirm({ title: '提示', message: '当前有标注未保存，确认离开？' });
          if (!ok) return;
        }
        switchTab(tab);
      });
    });

    // Annotation: load existing content
    function getCommentsPath() {
      var state = window.__axhostState;
      if (!state || !state.currentPage || !state.currentPage.pageRelativePath) return null;
      return state.currentPage.pageRelativePath + '/annotations.json';
    }

    async function loadAnnotation() {
      var path = getCommentsPath();
      if (!path) return;
      try {
        var url = `/api/file?path=${encodeURIComponent(path)}&project=${encodeURIComponent(window.__axhostProjectId || '')}`;
        var res = await fetch(url);
        if (!res.ok) {
          if (res.status === 404) {
            try { await window.apiClient.postFile(path, '[]'); } catch (e) {}
            throw { code: 404 };
          }
          throw new Error('Failed to load');
        }
        var text = await res.text();
        var data = JSON.parse(text);
        var item = data.find(function (d) { return d.selector === currentSelector; });
        var content = item ? item.content : '';
        annotationTextarea.value = content;
        savedAnnotationContent = content;
        annotationDirty = false;
        dirtyHint.classList.remove('visible');
      } catch (e) {
        // File doesn't exist or is invalid — start fresh
        annotationTextarea.value = '';
        savedAnnotationContent = '';
        annotationDirty = false;
        dirtyHint.classList.remove('visible');
      }
    }

    // Track dirty state
    annotationTextarea.addEventListener('input', function () {
      var dirty = annotationTextarea.value !== savedAnnotationContent;
      annotationDirty = dirty;
      dirtyHint.classList.toggle('visible', dirty);
    });

    // Save annotation
    saveBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      var path = getCommentsPath();
      if (!path) return;
      try {
        // Load existing comments
        var existing = [];
        try {
          var url = `/api/file?path=${encodeURIComponent(path)}&project=${encodeURIComponent(window.__axhostProjectId || '')}`;
          var res = await fetch(url);
          if (res.ok) {
            var text = await res.text();
            existing = JSON.parse(text);
          }
        } catch (e) {}
        // Upsert
        var idx = existing.findIndex(function (d) { return d.selector === currentSelector; });
        var item = { selector: currentSelector, content: annotationTextarea.value };
        if (idx >= 0) {
          existing[idx] = item;
        } else {
          existing.push(item);
        }
        // Save
        await window.apiClient.postFile(path, JSON.stringify(existing, null, 2));
        savedAnnotationContent = annotationTextarea.value;
        annotationDirty = false;
        dirtyHint.classList.remove('visible');
        // Show saved confirmation
        savedHint.classList.add('visible');
        if (savedTimer) clearTimeout(savedTimer);
        savedTimer = setTimeout(function () {
          savedHint.classList.remove('visible');
        }, 3000);
      } catch (err) {
        alert('保存失败: ' + (err.message || err));
      }
    });

    // Events
    popup.querySelector('.inspector-popup-close').addEventListener('click', (e) => {
      e.stopPropagation();
      tryClosePopup();
    });
    popup.querySelector('.inspector-copy-selector').addEventListener('click', (e) => {
      e.stopPropagation();
      const selector = generateSelector(targetEl);
      copyToClipboard(selector);
    });
    const btnCopyImage = popup.querySelector('.inspector-copy-image');
    if (btnCopyImage) {
      btnCopyImage.addEventListener('click', (e) => {
        e.stopPropagation();
        copyElementAsImage(targetEl);
      });
    }
    const btnParent = popup.querySelector('.inspector-popup-parent');
    if (btnParent && hasParent) {
      btnParent.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (annotationDirty) {
          var ok = await AxhostModal.confirm({ title: '提示', message: '当前有标注未保存，确认离开？' });
          if (!ok) return;
        }
        const parent = targetEl.parentElement;
        if (parent) {
          const savedLeft = popup.style.left;
          const savedTop = popup.style.top;
          locked = true;
          highlightElement(parent);
          showPopup(parent, { left: savedLeft, top: savedTop });
        }
      });
    }
  }

  async function tryClosePopup() {
    if (annotationDirty) {
      var ok = await AxhostModal.confirm({ title: '提示', message: '当前有标注未保存，确认离开？' });
      if (!ok) return false;
    }
    clearInspectState();
    return true;
  }

  function hidePopup() {
    if (popup && popup.parentNode) {
      popup.parentNode.removeChild(popup);
      popup = null;
    }
  }

  function clearInspectState() {
    hidePopup();
    removeHighlight();
    locked = false;
  }

  function generateSelector(el) {
    if (el.id) return '#' + el.id;
    let selector = el.tagName.toLowerCase();
    if (el.className) {
      const classes = el.className.toString().trim().split(/\s+/).filter(c => c);
      if (classes.length) selector += '.' + classes.join('.');
    }
    const parent = el.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
      if (sameTagSiblings.length > 1) {
        const index = Array.from(parent.children).indexOf(el) + 1;
        selector += `:nth-child(${index})`;
      }
    }
    return selector;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      if (window.showToast) window.showToast('选择器已复制', 'success');
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (window.showToast) window.showToast(ok ? '选择器已复制' : '复制失败', ok ? 'success' : 'error');
    }
  }

  async function copyElementAsImage(el) {
    if (typeof htmlToImage === 'undefined') {
      if (window.showToast) window.showToast('图片库未加载', 'error');
      return;
    }

    // 查找有效背景色（向上追溯祖先）
    let bg = getComputedStyle(el).backgroundColor;
    let target = el;
    while ((!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') && target.parentElement) {
      target = target.parentElement;
      bg = getComputedStyle(target).backgroundColor;
    }

    // 保存并临时隐藏滚动条、应用背景色
    const originalBg = el.style.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      el.style.backgroundColor = bg;
    }

    // 递归隐藏所有后代元素的滚动条
    const scrollEls = [];
    const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      const s = getComputedStyle(node);
      if (s.overflow === 'auto' || s.overflow === 'scroll' ||
          s.overflowX === 'auto' || s.overflowX === 'scroll' ||
          s.overflowY === 'auto' || s.overflowY === 'scroll') {
        scrollEls.push({
          el: node,
          overflow: node.style.overflow,
          overflowX: node.style.overflowX,
          overflowY: node.style.overflowY
        });
        node.style.overflow = 'hidden';
        node.style.overflowX = 'hidden';
        node.style.overflowY = 'hidden';
      }
    }

    try {
      const blob = await htmlToImage.toBlob(el, {
        backgroundColor: (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') ? bg : '#ffffff'
      });
      if (!blob) {
        if (window.showToast) window.showToast('生成图片失败', 'error');
        return;
      }
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        if (window.showToast) window.showToast('图片已复制到剪贴板', 'success');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'element.png';
        a.click();
        URL.revokeObjectURL(url);
        if (window.showToast) window.showToast('浏览器不支持剪贴板图片，已触发下载', 'warning');
      }
    } catch (err) {
      if (window.showToast) window.showToast('复制失败: ' + (err.message || ''), 'error');
    } finally {
      scrollEls.forEach(({ el: node, overflow, overflowX, overflowY }) => {
        node.style.overflow = overflow;
        node.style.overflowX = overflowX;
        node.style.overflowY = overflowY;
      });
      el.style.backgroundColor = originalBg;
    }
  }
})();
