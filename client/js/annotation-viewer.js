/**
 * Annotation Viewer — highlights annotated elements in the iframe and shows a sidebar panel.
 *
 * State levels:
 *   0 — off
 *   1 — highlights only
 *   2 — highlights + annotation list panel
 */
(function () {
  const iframe = document.getElementById('preview-frame');
  const btnToggle = document.getElementById('btn-toggle-annotations');
  const panel = document.getElementById('panel-annotations');
  const panelResizer = document.getElementById('annotations-resizer');
  const annotationsList = document.getElementById('annotations-list');
  const btnClose = document.getElementById('btn-annotations-close');
  if (!iframe || !btnToggle) return;

  var level = 0;          // 0=off, 1=highlights, 2=highlights+panel
  var annotations = [];   // [{ selector, content }]
  var highlights = [];    // [{ el, overlay }]
  var activeIdx = -1;     // index of currently selected annotation
  var popupEl = null;

  // ---- Helpers ----

  function getDoc() {
    try { return iframe.contentDocument; } catch (e) { return null; }
  }

  function getAnnotationsPath() {
    var state = window.__axhostState;
    if (state && state.currentPage && state.currentPage.pageRelativePath) {
      return state.currentPage.pageRelativePath + '/annotations.json';
    }
    // Preview mode: build from hash and prototype base path
    var hash = window.location.hash && window.location.hash.slice(1);
    if (hash && /^[a-f0-9]{8}$/.test(hash)) {
      var base = (window.__axhostBasePath || '/prototype/').replace(/\/$/, '');
      return base.replace(/^\//, '') + '/pages/' + hash + '/annotations.json';
    }
    return null;
  }

  function getAnnotationsUrl(path) {
    if (window.apiClient) {
      return '/api/file?path=' + encodeURIComponent(path) + '&project=' + encodeURIComponent(window.__axhostProjectId || '');
    }
    // Preview mode: direct file URL
    return '/' + path;
  }

  // ---- Load annotations ----

  async function loadAnnotations() {
    var path = getAnnotationsPath();
    if (!path) { annotations = []; return; }
    try {
      var url = getAnnotationsUrl(path);
      var res = await fetch(url);
      if (!res.ok) { annotations = []; return; }
      var text = await res.text();
      annotations = JSON.parse(text);
    } catch (e) {
      annotations = [];
    }
  }

  // ---- Inject highlight CSS into iframe ----

  function injectStyles(doc) {
    if (!doc || !doc.head) return;
    if (doc.getElementById('annotation-viewer-style')) return;
    var style = doc.createElement('style');
    style.id = 'annotation-viewer-style';
    style.textContent =
      '.annotation-highlight{position:absolute;z-index:999990;pointer-events:auto;background:rgba(22,119,255,0.15);border:1px solid rgba(22,119,255,0.8);border-radius:2px;cursor:pointer;transition:background 0.1s,border-color 0.1s}' +
      '.annotation-highlight.active{background:rgba(230,126,34,0.25);border:2px solid #e67e22;z-index:999991}' +
      '.annotation-popup{position:absolute;z-index:999992;background:#fff;border:1px solid #e0e0e0;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.2);width:240px;min-height:180px;max-height:360px;overflow-y:auto;font-size:13px;color:#333;padding:10px 12px;line-height:1.5}';
    doc.head.appendChild(style);
  }

  // ---- Highlight elements ----

  function clearHighlights() {
    highlights.forEach(function (h) { if (h.overlay.parentNode) h.overlay.parentNode.removeChild(h.overlay); });
    highlights = [];
    activeIdx = -1;
    hidePopup();
  }

  function buildHighlights() {
    clearHighlights();
    var doc = getDoc();
    if (!doc) return;
    injectStyles(doc);

    annotations.forEach(function (ann, idx) {
      var el;
      try {
        el = doc.querySelector(ann.selector);
      } catch (e) { el = null; }
      if (!el) return;
      // Avoid duplicates for same element
      if (highlights.some(function (h) { return h.el === el; })) return;

      var overlay = doc.createElement('div');
      overlay.className = 'annotation-highlight';
      overlay.setAttribute('data-annotation-idx', idx);
      positionOverlay(overlay, el);

      overlay.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        selectAnnotation(idx);
      });

      doc.body.appendChild(overlay);
      highlights.push({ el: el, overlay: overlay, idx: idx });
    });
  }

  function positionOverlay(overlay, el) {
    var rect = el.getBoundingClientRect();
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }

  function repositionHighlights() {
    highlights.forEach(function (h) {
      positionOverlay(h.overlay, h.el);
      h.overlay.classList.toggle('active', h.idx === activeIdx);
    });
  }

  function selectAnnotation(idx) {
    try {
      if (idx === activeIdx) return; // already selected
      activeIdx = idx;
      updateActiveHighlight();
      showPopup(idx);
      updateCardActive();
      // Scroll to element
      var h = highlights.find(function (h) { return h.idx === idx; });
      if (h && h.el) {
        try { h.el.scrollIntoView({ behavior: 'auto', block: 'center' }); } catch (e) {}
      }
    } catch (e) {
      activeIdx = -1;
    }
  }

  function updateActiveHighlight() {
    highlights.forEach(function (h) {
      h.overlay.classList.toggle('active', h.idx === activeIdx);
    });
    // Also re-order z-index: active one on top
    if (activeIdx >= 0) {
      var activeH = highlights.find(function (h) { return h.idx === activeIdx; });
      if (activeH) {
        activeH.overlay.style.zIndex = '999991';
        highlights.forEach(function (h) {
          if (h.idx !== activeIdx) h.overlay.style.zIndex = '999990';
        });
      }
    }
  }

  // ---- Popup ----

  function showPopup(idx) {
    hidePopup();
    var ann = annotations[idx];
    if (!ann) return;
    var h = highlights.find(function (h) { return h.idx === idx; });
    if (!h) return;

    var doc = getDoc();
    if (!doc) return;

    popupEl = doc.createElement('div');
    popupEl.className = 'annotation-popup';
    popupEl.innerHTML = '<div class="annotation-popup-content">' + renderMarkdown(ann.content) + '</div>';
    doc.body.appendChild(popupEl);

    positionPopup(popupEl, h.el);
  }

  function renderMarkdown(text) {
    if (window.mdRenderer && typeof window.mdRenderer.renderMarkdown === 'function') {
      return window.mdRenderer.renderMarkdown(text);
    }
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
  }

  function positionPopup(popup, el) {
    var rect = el.getBoundingClientRect();
    var doc = getDoc();
    if (!doc) return;
    var vw = doc.documentElement.clientWidth;
    var vh = doc.documentElement.clientHeight;
    var pw = 240;
    var ph = Math.min(popup.offsetHeight || 200, 360);
    var gap = 4;

    // Horizontal: prefer aligning with element left, clamp to viewport
    var left = rect.left;
    if (left + pw > vw) { left = vw - pw - gap; }
    if (left < gap) { left = gap; }

    // Vertical: prefer below element. If not enough space, flip above
    var top = rect.bottom + gap;
    if (top + ph > vh) {
      top = rect.top - ph - gap;
    }
    if (top < gap) { top = gap; }

    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  function hidePopup() {
    if (popupEl && popupEl.parentNode) {
      popupEl.parentNode.removeChild(popupEl);
    }
    popupEl = null;
  }

  // ---- Sidebar panel ----

  function renderPanel() {
    if (!annotationsList) return;
    annotationsList.innerHTML = '';

    if (annotations.length === 0) {
      annotationsList.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:12px;text-align:center;">当前页面暂无标注</div>';
      return;
    }

    annotations.forEach(function (ann, idx) {
      var card = document.createElement('div');
      card.className = 'annotation-card';
      card.setAttribute('data-idx', idx);
      if (idx === activeIdx) card.style.borderColor = '#e67e22';

      var bodyText = ann.content || '';
      var needsExpand = bodyText.split('\n').length > 3 || bodyText.length > 200;

      card.innerHTML =
        '<div class="annotation-card-title">' + escapeHtml(ann.selector) + '</div>' +
        '<div class="annotation-card-body">' + escapeHtml(bodyText) + '</div>' +
        (needsExpand ? '<button class="annotation-card-expand visible">展开</button>' : '');

      annotationsList.appendChild(card);
    });
  }

  // Event delegation: clicks on card titles and expand buttons
  if (annotationsList) {
    annotationsList.addEventListener('click', function (e) {
      var card = e.target.closest('.annotation-card');
      if (!card) return;
      var idx = parseInt(card.getAttribute('data-idx'), 10);
      if (isNaN(idx)) return;

      // Expand button
      if (e.target.closest('.annotation-card-expand')) {
        var bodyEl = card.querySelector('.annotation-card-body');
        var expandBtn = card.querySelector('.annotation-card-expand');
        if (bodyEl && expandBtn) {
          var expanded = bodyEl.classList.toggle('expanded');
          expandBtn.textContent = expanded ? '收起' : '展开';
        }
        return;
      }

      // Card title click → select annotation (includes highlight, popup, scroll)
      selectAnnotation(idx);
    });
  }

  function updateCardActive() {
    if (!annotationsList) return;
    var cards = annotationsList.querySelectorAll('.annotation-card');
    cards.forEach(function (card) {
      var idx = parseInt(card.getAttribute('data-idx'), 10);
      card.style.borderColor = idx === activeIdx ? '#e67e22' : '';
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- State management ----

  function setLevel(newLevel) {
    level = newLevel;
    btnToggle.classList.toggle('active', level > 0);

    if (level >= 1) {
      loadAnnotations().then(function () {
        // Ensure iframe is ready before building highlights
        function build() {
          buildHighlights();
          if (level >= 2) {
            panel.classList.remove('hidden');
            if (panelResizer) panelResizer.classList.remove('hidden');
            renderPanel();
          }
        }
        if (getDoc() && getDoc().readyState === 'complete') {
          build();
        } else {
          // Wait for iframe to finish loading
          iframe.addEventListener('load', function onLoad() {
            iframe.removeEventListener('load', onLoad);
            build();
          });
        }
      });
    } else {
      clearHighlights();
      panel.classList.add('hidden');
      if (panelResizer) panelResizer.classList.add('hidden');
    }

    // Disable inspector in annotation mode
    var btnInspect = document.getElementById('btn-inspect');
    if (btnInspect) {
      if (level > 0) {
        // Deactivate inspector if currently active
        if (btnInspect.classList.contains('active')) btnInspect.click();
        btnInspect.disabled = true;
      } else {
        btnInspect.disabled = false;
      }
    }
  }

  // ---- Button events ----

  btnToggle.addEventListener('click', function () {
    setLevel((level + 1) % 3);
  });

  // Hover dropdown
  var dropdownEl = null;
  btnToggle.addEventListener('mouseenter', function () {
    if (dropdownEl) return;
    var rect = btnToggle.getBoundingClientRect();
    dropdownEl = document.createElement('div');
    dropdownEl.className = 'editor-dropdown open';
    dropdownEl.style.cssText = 'position:fixed;z-index:100;top:' + (rect.bottom + 4) + 'px;left:' + (rect.left - 20) + 'px;min-width:110px;display:block;';
    var items = [
      { label: '元素', level: 1 },
      { label: '元素+列表', level: 2 },
      { label: '关闭', level: 0 }
    ];
    items.forEach(function (item) {
      var row = document.createElement('div');
      row.style.cssText = 'padding:6px 12px;cursor:pointer;font-size:13px;';
      if (item.level === level) row.style.background = 'var(--bg-hover)';
      row.textContent = item.label;
      row.addEventListener('click', function () { setLevel(item.level); removeDropdown(); });
      row.addEventListener('mouseenter', function () { row.style.background = 'var(--bg-hover)'; });
      row.addEventListener('mouseleave', function () { if (item.level !== level) row.style.background = ''; });
      dropdownEl.appendChild(row);
    });
    document.body.appendChild(dropdownEl);
    dropdownEl.addEventListener('mouseleave', function () { removeDropdown(); });
  });

  btnToggle.addEventListener('mouseleave', function (e) {
    if (dropdownEl && dropdownEl.contains(e.relatedTarget)) return;
    setTimeout(function () {
      if (dropdownEl && !dropdownEl.matches(':hover')) removeDropdown();
    }, 200);
  });

  function removeDropdown() {
    if (dropdownEl && dropdownEl.parentNode) {
      dropdownEl.parentNode.removeChild(dropdownEl);
    }
    dropdownEl = null;
  }

  document.addEventListener('click', function (e) {
    if (dropdownEl && !dropdownEl.contains(e.target) && e.target !== btnToggle) {
      removeDropdown();
    }
  });

  // ---- Panel close button ----

  if (btnClose) {
    btnClose.addEventListener('click', function () {
      setLevel(level === 2 ? 1 : 0);
    });
  }

  // ---- Iframe load / scroll / resize → refresh ----

  var scrollRepositionTimer;
  function onIframeChange() {
    if (level === 0) return;
    clearTimeout(scrollRepositionTimer);
    scrollRepositionTimer = setTimeout(function () {
      repositionHighlights();
      if (activeIdx >= 0 && popupEl) {
        var h = highlights.find(function (h) { return h.idx === activeIdx; });
        if (h) positionPopup(popupEl, h.el);
      }
    }, 50);
  }

  // Preview mode: refresh on hash change
  window.addEventListener('hashchange', function () {
    if (level > 0) {
      clearHighlights();
      loadAnnotations().then(function () {
        setTimeout(function () {
          buildHighlights();
          if (level >= 2) renderPanel();
        }, 200);
      });
    }
  });

  iframe.addEventListener('load', function () {
    var doc = getDoc();
    if (doc) {
      doc.addEventListener('scroll', onIframeChange, true);
    }
    window.addEventListener('resize', onIframeChange);

    if (level > 0) {
      clearHighlights();
      loadAnnotations().then(function () {
        // Small delay to ensure iframe DOM is settled
        setTimeout(function () {
          buildHighlights();
          if (level >= 2) renderPanel();
        }, 100);
      });
    }
  });

  // ---- Expose ----

  window.__annotationViewer = {
    setLevel: setLevel,
    getLevel: function () { return level; },
    refresh: function () {
      if (level > 0) {
        loadAnnotations().then(function () {
          buildHighlights();
          if (level >= 2) renderPanel();
        });
      }
    }
  };
})();
