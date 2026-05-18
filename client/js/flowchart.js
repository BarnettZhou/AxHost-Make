(function () {
  const basePath = window.__axhostFlowchartBase || '.';

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="toolbar" id="toolbar">
      <span class="toolbar-title">Flowchart</span>
      <div class="toolbar-actions">
        <button id="edit-btn" class="toolbar-btn primary" title="编辑">编辑</button>
        <button id="refresh-btn" class="toolbar-btn" title="刷新">刷新</button>
      </div>
    </div>
    <div class="main" id="main">
      <div class="editor-pane" id="editor-pane">
        <div class="pane-label">Mermaid 源码</div>
        <textarea id="editor" spellcheck="false" readonly></textarea>
      </div>
      <div class="preview-pane" id="preview-pane">
        <div class="pane-label">预览</div>
        <div id="preview">
          <div class="preview-floatbar" id="preview-floatbar">
            <button id="btn-thumbnail" class="active" title="缩略图"><iconpark-icon icon-id="thumbnail" size="12" color="currentColor"></iconpark-icon></button>
            <button id="btn-zoom-in" title="放大"><iconpark-icon icon-id="plus" size="12" color="currentColor"></iconpark-icon></button>
            <button id="btn-zoom-out" title="缩小"><iconpark-icon icon-id="minus" size="12" color="currentColor"></iconpark-icon></button>
            <button id="btn-pan" title="抓手"><iconpark-icon icon-id="palm" size="12" color="currentColor"></iconpark-icon></button>
          </div>
          <div class="preview-thumbnail" id="preview-thumbnail">
            <div class="thumbnail-content" id="thumbnail-content"></div>
            <div class="thumbnail-viewport" id="thumbnail-viewport"></div>
          </div>
          <div id="preview-content"></div>
        </div>
      </div>
    </div>
  `;

  mermaid.initialize({ startOnLoad: false, theme: 'default' });

  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const previewContent = document.getElementById('preview-content');
  const editBtn = document.getElementById('edit-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const toolbar = document.getElementById('toolbar');
  const editorPane = document.getElementById('editor-pane');
  const previewPane = document.getElementById('preview-pane');
  const previewLabel = previewPane.querySelector('.pane-label');
  const btnThumbnail = document.getElementById('btn-thumbnail');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnPan = document.getElementById('btn-pan');
  const thumbnail = document.getElementById('preview-thumbnail');
  const thumbnailContent = document.getElementById('thumbnail-content');
  const thumbnailViewport = document.getElementById('thumbnail-viewport');

  let isEditing = false;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let panning = true;
  let isDragging = false;
  let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };
  let thumbnailVisible = true;

  function isPreviewMode() {
    try {
      if (window.parent !== window) {
        return window.parent.document.body.classList.contains('preview-mode');
      }
    } catch (e) {}
    return true;
  }

  const previewMode = isPreviewMode();

  if (previewMode) {
    toolbar.style.display = 'none';
    editorPane.style.display = 'none';
    previewPane.style.flex = '1';
    previewPane.style.border = 'none';
    if (previewLabel) previewLabel.style.display = 'none';
  }

  btnPan.classList.add('active');
  preview.style.cursor = 'grab';

  async function render(source) {
    previewContent.innerHTML = '';
    const text = (source || '').trim();
    if (!text) {
      previewContent.innerHTML = '<div class="info-msg">Mermaid 源码为空</div>';
      centerContent();
      renderThumbnail();
      return;
    }
    const id = 'm-' + Math.random().toString(36).slice(2, 10);
    try {
      const { svg } = await mermaid.render(id, text);
      previewContent.innerHTML = svg;
      const svgEl = previewContent.querySelector('svg');
      if (svgEl) svgEl.style.maxWidth = '100%';
    } catch (err) {
      previewContent.innerHTML = '<div class="error-msg">' + err.message.replace(/</g, '&lt;') + '</div>';
    }
    centerContent();
    renderThumbnail();
  }

  function applyTransform() {
    previewContent.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + zoom + ')';
    previewContent.style.transformOrigin = 'center center';
    updateThumbnailViewport();
  }

  function centerContent() {
    panX = 0;
    panY = 0;
    applyTransform();
  }

  function getSvgOriginalSize(svg) {
    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.split(/\s+/).map(Number);
      if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
        return { ew: parts[2], eh: parts[3] };
      }
    }
    return { ew: previewContent.scrollWidth, eh: previewContent.scrollHeight };
  }

  function getThumbInfo() {
    const svg = previewContent.querySelector('svg');
    if (!svg) return null;
    const { ew, eh } = getSvgOriginalSize(svg);
    if (!ew || !eh) return null;
    const panelW = 150;
    const panelH = 100;
    const s = Math.min(panelW / ew, panelH / eh);
    const w = ew * s;
    const h = eh * s;
    return { ew, eh, w, h, s, panelW, panelH };
  }

  function renderThumbnail() {
    thumbnailContent.innerHTML = '';
    const svg = previewContent.querySelector('svg');
    if (!svg) {
      thumbnailViewport.style.display = 'none';
      return;
    }
    thumbnailViewport.style.display = '';
    const clone = svg.cloneNode(true);
    clone.removeAttribute('style');
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.style.maxWidth = '100%';
    clone.style.maxHeight = '100%';
    clone.style.width = 'auto';
    clone.style.height = 'auto';
    clone.style.display = 'block';
    thumbnailContent.appendChild(clone);
    updateThumbnailViewport();
  }

  function updateThumbnailViewport() {
    const info = getThumbInfo();
    if (!info) return;
    const { ew, eh, w, h, s, panelW, panelH } = info;
    const cw = preview.clientWidth;
    const ch = preview.clientHeight;

    const svgLeft = (panelW - w) / 2;
    const svgTop = (panelH - h) / 2;

    const offsetX = ew / 2 - cw / (2 * zoom) - panX / zoom;
    const offsetY = eh / 2 - ch / (2 * zoom) - panY / zoom;

    let vx = svgLeft + offsetX * s;
    let vy = svgTop + offsetY * s;
    let vw = (cw / zoom) * s;
    let vh = (ch / zoom) * s;

    if (vx + vw > panelW) vw = panelW - vx;
    if (vy + vh > panelH) vh = panelH - vy;
    if (vx < 0) { vw += vx; vx = 0; }
    if (vy < 0) { vh += vy; vy = 0; }
    vw = Math.max(0, vw);
    vh = Math.max(0, vh);

    thumbnailViewport.style.left = vx + 'px';
    thumbnailViewport.style.top = vy + 'px';
    thumbnailViewport.style.width = vw + 'px';
    thumbnailViewport.style.height = vh + 'px';
  }

  thumbnail.addEventListener('click', (e) => {
    if (!thumbnailVisible) return;
    const rect = thumbnail.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const info = getThumbInfo();
    if (!info) return;
    const { ew, eh, w, h, s, panelW, panelH } = info;

    const svgLeft = (panelW - w) / 2;
    const svgTop = (panelH - h) / 2;

    const relX = clickX - svgLeft;
    const relY = clickY - svgTop;

    const px = relX / s;
    const py = relY / s;

    panX = (ew / 2 - px) * zoom;
    panY = (eh / 2 - py) * zoom;
    applyTransform();
  });

  btnThumbnail.addEventListener('click', () => {
    thumbnailVisible = !thumbnailVisible;
    btnThumbnail.classList.toggle('active', thumbnailVisible);
    thumbnail.style.display = thumbnailVisible ? '' : 'none';
  });

  btnZoomIn.addEventListener('click', () => {
    zoom = Math.min(3, zoom + 0.2);
    applyTransform();
  });

  btnZoomOut.addEventListener('click', () => {
    zoom = Math.max(0.3, zoom - 0.2);
    applyTransform();
  });

  btnPan.addEventListener('click', () => {
    panning = !panning;
    btnPan.classList.toggle('active', panning);
    preview.style.cursor = panning ? 'grab' : '';
  });

  preview.addEventListener('mousedown', (e) => {
    if (!panning) return;
    if (e.target.closest('.preview-floatbar')) return;
    if (e.target.closest('.preview-thumbnail')) return;
    e.preventDefault();
    isDragging = true;
    preview.style.cursor = 'grabbing';
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      panX: panX,
      panY: panY
    };
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = dragStart.panX + (e.clientX - dragStart.x);
    panY = dragStart.panY + (e.clientY - dragStart.y);
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    if (panning) preview.style.cursor = 'grab';
  });

  preview.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoom = Math.max(0.3, Math.min(3, zoom + delta));
    applyTransform();
  }, { passive: false });

  function getApiBase() {
    const m = location.pathname.match(/^\/projects\/([^/]+)\//);
    return m ? '?project=' + m[1] : '';
  }

  function getFilePath() {
    return location.pathname.replace(/^\//, '').replace(/index\.html$/, 'diagram.mmd');
  }

  async function loadSource() {
    try {
      const res = await fetch(basePath + '/diagram.mmd');
      if (res.ok) {
        const source = await res.text();
        editor.value = source;
        render(source);
        return;
      }
    } catch (e) {}
    editor.value = 'graph TD\n    A[开始] --> B[结束]';
    render(editor.value);
  }

  function setEditing(editing) {
    isEditing = editing;
    if (editing) {
      editor.removeAttribute('readonly');
      editor.focus();
      editBtn.textContent = '保存';
      editBtn.classList.add('primary');
    } else {
      editor.setAttribute('readonly', 'true');
      editBtn.textContent = '编辑';
      editBtn.classList.remove('primary');
    }
  }

  let renderTimer;
  editor.addEventListener('input', () => {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => render(editor.value), 300);
  });

  editBtn.addEventListener('click', async () => {
    if (!isEditing) {
      setEditing(true);
      return;
    }

    editBtn.disabled = true;
    const originalText = editBtn.textContent;
    editBtn.textContent = '保存中...';
    try {
      const res = await fetch('/api/file' + getApiBase(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: getFilePath(), content: editor.value })
      });
      if (res.ok) {
        editBtn.textContent = '已保存';
        setTimeout(() => {
          setEditing(false);
          editBtn.disabled = false;
        }, 800);
      } else {
        throw new Error('Save failed');
      }
    } catch (err) {
      editBtn.textContent = '保存失败';
      setTimeout(() => {
        editBtn.textContent = originalText;
        editBtn.disabled = false;
      }, 1500);
    }
  });

  refreshBtn.addEventListener('click', () => {
    loadSource();
  });

  loadSource();
})();
