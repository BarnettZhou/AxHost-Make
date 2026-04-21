(function () {
  const iframe = document.getElementById('preview-frame');
  const btnInspect = document.getElementById('btn-inspect');
  if (!iframe || !btnInspect) return;

  let active = false;
  let popup = null;
  let highlightEl = null;
  let overlayEl = null;
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
      injectedStyle = null;
      overlayEl = null;
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
        align-items: flex-start;
        justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid ${c.border};
        gap: 8px;
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
        align-items: center;
        gap: 8px;
      }
      .inspector-popup-footer .inspector-copy-selector {
        margin-left: auto;
        background: #1677ff;
        color: #fff;
        border: none;
        padding: 5px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .inspector-popup-footer .inspector-copy-selector:hover {
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
    var url = 'https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/icons_43205_39.3d5334329926fcf46130549c922bd1c4.js';
    if (window.__axhostIconParkES5) {
      url = 'https://lf1-cdn-tos.bytegoofy.com/obj/iconpark/icons_43205_39.3d5334329926fcf46130549c922bd1c4.es5.js';
    }
    var script = doc.createElement('script');
    script.src = url;
    script.defer = true;
    script.setAttribute('data-iconpark', 'true');
    doc.head.appendChild(script);
  }

  function createOverlay(doc) {
    if (overlayEl && overlayEl.ownerDocument === doc) return;
    removeOverlay();
    overlayEl = doc.createElement('div');
    overlayEl.className = 'inspector-overlay';
    doc.body.appendChild(overlayEl);
  }

  function removeOverlay() {
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
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
    removeOverlay();
    hidePopup();
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
    const doc = getDoc();
    if (!doc || !overlayEl) return;
    const rect = el.getBoundingClientRect();
    const scrollTop = doc.documentElement.scrollTop || doc.body.scrollTop || 0;
    const scrollLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft || 0;
    overlayEl.style.left = (rect.left + scrollLeft) + 'px';
    overlayEl.style.top = (rect.top + scrollTop) + 'px';
    overlayEl.style.width = rect.width + 'px';
    overlayEl.style.height = rect.height + 'px';
    overlayEl.style.display = 'block';
  }

  function removeHighlight() {
    highlightEl = null;
    if (overlayEl) {
      overlayEl.style.display = 'none';
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

    popup.innerHTML = `
      <div class="inspector-popup-header">
        <div class="inspector-header-left">
          <span class="inspector-tag">&lt;${tagName}&gt;</span>
          <span class="inspector-text">${escapeHtml(displayText) || '(无文本内容)'}</span>
        </div>
        <button class="inspector-popup-close">&times;</button>
      </div>
      <div class="inspector-popup-body">
        <div class="inspector-row"><label>ID</label><span>${escapeHtml(elId)}</span></div>
        <div class="inspector-row"><label>Class</label><span>${escapeHtml(elClass)}</span></div>
        <div class="inspector-row"><label>尺寸</label><span>${escapeHtml(dims)}</span></div>
        <div class="inspector-row"><label>字号</label><span>${escapeHtml(fontSize)}</span></div>
      </div>
      <div class="inspector-popup-footer">
        <button class="inspector-popup-parent text-btn" title="选中父元素" ${hasParent ? '' : 'disabled'}>
          <iconpark-icon icon-id="up" size="14" color="currentColor"></iconpark-icon>
        </button>
        <button class="inspector-copy-selector">复制选择器</button>
      </div>
    `;

    doc.body.appendChild(popup);

    // Position
    if (opts && opts.left != null && opts.top != null) {
      popup.style.left = opts.left;
      popup.style.top = opts.top;
    } else {
      const scrollTop = doc.documentElement.scrollTop || doc.body.scrollTop || 0;
      const scrollLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft || 0;
      const viewportHeight = doc.documentElement.clientHeight;
      const viewportWidth = doc.documentElement.clientWidth;
      const popupWidth = popup.offsetWidth || 220;

      let top = rect.bottom + scrollTop + 4;
      if (rect.bottom + 180 > viewportHeight) {
        top = rect.top + scrollTop - 180 - 4;
      }

      let left = rect.left + scrollLeft;
      if (left + popupWidth > viewportWidth) {
        left = viewportWidth - popupWidth - 4;
        if (left < 4) left = 4;
      }

      popup.style.left = left + 'px';
      popup.style.top = top + 'px';
    }

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
    const btnParent = popup.querySelector('.inspector-popup-parent');
    if (btnParent && hasParent) {
      btnParent.addEventListener('click', (e) => {
        e.stopPropagation();
        const parent = targetEl.parentElement;
        if (parent) {
          const savedLeft = popup.style.left;
          const savedTop = popup.style.top;
          highlightElement(parent);
          showPopup(parent, { left: savedLeft, top: savedTop });
        }
      });
    }
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
