(function () {
  const iframe = document.getElementById('preview-frame');
  const btnInspect = document.getElementById('btn-inspect');
  if (!iframe || !btnInspect) return;

  let active = false;
  let popup = null;
  let highlightEl = null;
  let savedOutline = null;
  let savedOutlineOffset = null;
  let injectedStyle = null;

  btnInspect.addEventListener('click', () => {
    active = !active;
    btnInspect.classList.toggle('active', active);
    if (active) {
      attachListeners();
      setInspectCursor(true);
    } else {
      detachListeners();
      hidePopup();
      setInspectCursor(false);
    }
  });

  // Re-attach when iframe loads new page
  iframe.addEventListener('load', () => {
    if (active) {
      injectedStyle = null; // will be re-injected by attachListeners
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
      .inspector-popup {
        position: absolute;
        z-index: 999999;
        background: ${c.bgPanel};
        border: 1px solid ${c.border};
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        min-width: 220px;
        max-width: 320px;
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
        padding: 10px 12px;
        border-bottom: 1px solid ${c.border};
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
        padding: 0 2px;
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
      .inspector-popup-footer {
        padding: 8px 12px;
        border-top: 1px solid ${c.border};
        display: flex;
        justify-content: flex-end;
      }
      .inspector-popup-footer button {
        background: ${c.accent};
        color: #fff;
        border: none;
        padding: 5px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .inspector-popup-footer button:hover {
        opacity: 0.9;
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

  function attachListeners() {
    const doc = getDoc();
    if (!doc) return;
    injectStyles(doc);
    doc.addEventListener('mouseover', onMouseOver, true);
    doc.addEventListener('mouseout', onMouseOut, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('mousedown', onMouseDown, true);
  }

  function detachListeners() {
    const doc = getDoc();
    if (doc) {
      doc.removeEventListener('mouseover', onMouseOver, true);
      doc.removeEventListener('mouseout', onMouseOut, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('mousedown', onMouseDown, true);
    }
    removeHighlight();
    removeStyles();
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
    highlightElement(e.target);
  }

  function onMouseOut(e) {
    if (!active) return;
    if (isInspectorElement(e.target)) return;
    e.stopPropagation();
    removeHighlight();
  }

  function onMouseDown(e) {
    if (!active) return;
    if (isInspectorElement(e.target)) return;
    e.stopPropagation();
  }

  function onClick(e) {
    if (!active) return;
    if (isInspectorElement(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    showPopup(e.target);
  }

  function highlightElement(el) {
    removeHighlight();
    highlightEl = el;
    savedOutline = el.style.getPropertyValue('outline');
    savedOutlineOffset = el.style.getPropertyValue('outline-offset');
    el.style.setProperty('outline', '2px solid #1677ff', 'important');
    el.style.setProperty('outline-offset', '2px', 'important');
  }

  function removeHighlight() {
    if (highlightEl) {
      highlightEl.style.setProperty('outline', savedOutline || '', '');
      highlightEl.style.setProperty('outline-offset', savedOutlineOffset || '', '');
      highlightEl = null;
      savedOutline = null;
      savedOutlineOffset = null;
    }
  }

  function showPopup(targetEl) {
    const doc = getDoc();
    if (!doc) return;
    hidePopup();

    popup = doc.createElement('div');
    popup.className = 'inspector-popup';

    const tagName = targetEl.tagName.toLowerCase();
    const elId = targetEl.id || '';
    const elClass = targetEl.className || '';

    popup.innerHTML = `
      <div class="inspector-popup-header">
        <span class="inspector-tag">&lt;${tagName}&gt;</span>
        <button class="inspector-popup-close">&times;</button>
      </div>
      <div class="inspector-popup-body">
        <div class="inspector-row"><label>ID</label><span>${escapeHtml(elId)}</span></div>
        <div class="inspector-row"><label>Class</label><span>${escapeHtml(elClass)}</span></div>
      </div>
      <div class="inspector-popup-footer">
        <button class="inspector-copy-selector">复制选择器</button>
      </div>
    `;

    // Position
    const rect = targetEl.getBoundingClientRect();
    const scrollTop = doc.documentElement.scrollTop || doc.body.scrollTop || 0;
    const scrollLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft || 0;
    const viewportHeight = doc.documentElement.clientHeight;

    let top = rect.bottom + scrollTop + 4;
    // 预估 popup 高度约 150px，下方空间不足时向上弹出
    if (rect.bottom + 150 > viewportHeight) {
      top = rect.top + scrollTop - 150 - 4;
    }
    popup.style.left = (rect.left + scrollLeft) + 'px';
    popup.style.top = top + 'px';

    doc.body.appendChild(popup);

    // Events
    popup.querySelector('.inspector-popup-close').addEventListener('click', (e) => {
      e.stopPropagation();
      hidePopup();
    });
    popup.querySelector('.inspector-copy-selector').addEventListener('click', (e) => {
      e.stopPropagation();
      const selector = generateSelector(targetEl);
      copyToClipboard(selector);
    });
  }

  function hidePopup() {
    if (popup && popup.parentNode) {
      popup.parentNode.removeChild(popup);
      popup = null;
    }
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
})();
