(function () {
  const iframe = document.getElementById('preview-frame');
  const btnInspect = document.getElementById('btn-inspect');
  if (!iframe || !btnInspect) return;

  let active = false;
  let popup = null;
  let highlightEl = null;
  let savedOutline = null;
  let savedOutlineOffset = null;

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
      attachListeners();
      setInspectCursor(true);
    }
  });

  function getDoc() {
    try { return iframe.contentDocument; } catch (e) { return null; }
  }

  function attachListeners() {
    const doc = getDoc();
    if (!doc) return;
    doc.addEventListener('mouseover', onMouseOver, true);
    doc.addEventListener('mouseout', onMouseOut, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('mousedown', onMouseDown, true);
  }

  function detachListeners() {
    const doc = getDoc();
    if (!doc) return;
    doc.removeEventListener('mouseover', onMouseOver, true);
    doc.removeEventListener('mouseout', onMouseOut, true);
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('mousedown', onMouseDown, true);
    removeHighlight();
  }

  function setInspectCursor(enable) {
    const doc = getDoc();
    if (!doc || !doc.documentElement) return;
    doc.documentElement.style.cursor = enable ? 'crosshair' : '';
  }

  function onMouseOver(e) {
    if (!active) return;
    e.stopPropagation();
    highlightElement(e.target);
  }

  function onMouseOut(e) {
    if (!active) return;
    e.stopPropagation();
    removeHighlight();
  }

  function onMouseDown(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function onClick(e) {
    if (!active) return;
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
    popup.style.left = (rect.left + scrollLeft) + 'px';
    popup.style.top = (rect.bottom + scrollTop + 4) + 'px';

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
