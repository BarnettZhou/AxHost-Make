(function () {
  const docTabs = document.getElementById('doc-tabs-scroll');
  const docContent = document.getElementById('doc-content');
  const btnDocAction = document.getElementById('btn-doc-action');
  const btnDocPreview = document.getElementById('btn-doc-preview');
  let isPreviewMode = true;
  const btnAdd = document.getElementById('btn-doc-add');
  const btnSort = document.getElementById('btn-doc-sort');
  const btnScrollLeft = document.getElementById('btn-doc-scroll-left');
  const btnScrollRight = document.getElementById('btn-doc-scroll-right');

  let currentDocs = [];
  let activeDocIndex = 0;
  let isEditMode = false;
  let currentType = null;
  let currentPath = null;
  let loadToken = 0;

  async function load(type, pagePath, targetDoc) {
    const token = ++loadToken;
    currentType = type;
    currentPath = pagePath;
    isEditMode = false;
    activeDocIndex = 0;

    const base = `prototype/${type}s/${pagePath}`;
    const docs = [];
    try {
      const res = await window.apiClient.getDocs(`${base}/docs`);
      const names = res.code === 0 ? res.data : [];
      for (const name of names) {
        try {
          const content = await window.apiClient.getFile(`${base}/docs/${name}`);
          docs.push({ name, path: `${base}/docs/${name}`, content });
        } catch (e) {}
      }
    } catch (e) {
      try {
        const readme = await window.apiClient.getFile(`${base}/docs/readme.md`);
        docs.push({ name: 'readme.md', path: `${base}/docs/readme.md`, content: readme });
      } catch (e) {}
    }

    if (token !== loadToken) return;
    currentDocs = docs;
    isPreviewMode = true;

    // Handle target doc or pending doc from cross-page navigation
    const pendingDoc = targetDoc || window.__axhostPendingDoc;
    if (pendingDoc && currentDocs.length > 0) {
      const idx = currentDocs.findIndex(d => d.name === pendingDoc);
      if (idx >= 0) activeDocIndex = idx;
      window.__axhostPendingDoc = null;
    }

    renderTabs();
    updateActionButtons();
    renderContent();
  }

  function renderTabs() {
    docTabs.innerHTML = '';
    if (currentDocs.length === 0) {
      docTabs.innerHTML = '<span style="color:#858585;font-size:12px;padding:4px 0;">暂无文档</span>';
      return;
    }
    currentDocs.forEach((doc, idx) => {
      const tab = document.createElement('div');
      tab.className = 'doc-tab' + (idx === activeDocIndex ? ' active' : '');
      tab.textContent = doc.name;
      tab.onclick = async () => {
        if (isEditMode) {
          const ok = await window.showConfirm('切换确认', '切换文档将丢失未保存的修改，是否继续？');
          if (!ok) return;
        }
        activeDocIndex = idx;
        isEditMode = false;
        renderTabs();
        updateActionButtons();
        renderContent();
      };
      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showDocContextMenu(e, doc, idx);
      });
      docTabs.appendChild(tab);
    });
    updateScrollButtons();
  }

  function updateScrollButtons() {
    if (!docTabs) return;
    const atStart = docTabs.scrollLeft <= 1;
    const atEnd = docTabs.scrollLeft + docTabs.clientWidth >= docTabs.scrollWidth - 1;
    btnScrollLeft.classList.toggle('hidden', atStart);
    btnScrollRight.classList.toggle('hidden', atEnd);
  }

  function setupTabsScroll() {
    if (!docTabs) return;

    // Shift + wheel → horizontal scroll
    docTabs.addEventListener('wheel', (e) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      docTabs.scrollLeft += e.deltaY;
      updateScrollButtons();
    }, { passive: false });

    // Native scroll → update button state
    docTabs.addEventListener('scroll', updateScrollButtons);

    // Scroll buttons
    btnScrollLeft.addEventListener('click', () => {
      docTabs.scrollBy({ left: -200, behavior: 'smooth' });
    });
    btnScrollRight.addEventListener('click', () => {
      docTabs.scrollBy({ left: 200, behavior: 'smooth' });
    });
  }

  function bindImagePaste(textarea) {
    textarea.addEventListener('paste', async function(e) {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') === -1) continue;
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        try {
          const reader = new FileReader();
          const dataUrl = await new Promise(function(resolve, reject) {
            reader.onload = function() { resolve(reader.result); };
            reader.onerror = function() { reject(new Error('读取图片失败')); };
            reader.readAsDataURL(blob);
          });
          var result = await window.apiClient.postUploadImage({
            name: blob.name || 'image.png',
            data: dataUrl
          });
          if (result.code !== 0) {
            window.showToast('图片上传失败', 'error');
            return;
          }
          var filename = result.filename;
          var mdImage = '![image]($' + filename + ')';
          var start = textarea.selectionStart;
          var end = textarea.selectionEnd;
          var text = textarea.value;
          textarea.value = text.substring(0, start) + mdImage + text.substring(end);
          var newPos = start + mdImage.length;
          textarea.setSelectionRange(newPos, newPos);
          textarea.focus();
          // Trigger input event for live preview update
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          window.showToast('图片已上传', 'success');
        } catch (err) {
          console.error('Image paste error:', err);
          window.showToast('图片上传失败: ' + (err.message || '未知错误'), 'error');
        }
        break;
      }
    });
  }

  function renderContent() {
    if (currentDocs.length === 0) {
      docContent.innerHTML = '<p style="color:#858585">该页面暂无文档。</p>';
      return;
    }
    if (isEditMode) {
      docContent.innerHTML = '';
      if (isPreviewMode) {
        docContent.classList.add('split');
        const editorWrap = document.createElement('div');
        editorWrap.className = 'doc-editor-wrap';
        const textarea = document.createElement('textarea');
        textarea.className = 'doc-editor';
        textarea.value = currentDocs[activeDocIndex].content;
        editorWrap.appendChild(textarea);
        docContent.appendChild(editorWrap);

        const previewWrap = document.createElement('div');
        previewWrap.className = 'doc-preview doc-content';
        previewWrap.innerHTML = window.mdRenderer.renderMarkdown(currentDocs[activeDocIndex].content);
        docContent.appendChild(previewWrap);

        textarea.addEventListener('input', () => {
          previewWrap.innerHTML = window.mdRenderer.renderMarkdown(textarea.value);
        });
        bindDocLinkAutocomplete(textarea);
        bindImagePaste(textarea);
      } else {
        docContent.classList.remove('split');
        const textarea = document.createElement('textarea');
        textarea.className = 'doc-editor';
        textarea.value = currentDocs[activeDocIndex].content;
        docContent.appendChild(textarea);
        bindDocLinkAutocomplete(textarea);
        bindImagePaste(textarea);
      }
    } else {
      docContent.classList.remove('split');
      const html = window.mdRenderer.renderMarkdown(currentDocs[activeDocIndex].content);
      docContent.innerHTML = `<div class="doc-view">${html}</div>`;
      const view = docContent.querySelector('.doc-view');
      if (view) attachDocLinkHandler(view);
    }
  }

  function updateActionButtons() {
    if (btnDocAction) btnDocAction.textContent = isEditMode ? '保存' : '编辑';
    if (btnDocPreview) btnDocPreview.classList.toggle('hidden', !isEditMode);
    if (btnDocPreview) btnDocPreview.classList.toggle('active', isEditMode && isPreviewMode);
  }

  if (btnDocAction) {
    btnDocAction.addEventListener('click', async () => {
      if (currentDocs.length === 0) return;
      if (isEditMode) {
        const textarea = docContent.querySelector('.doc-editor');
        if (!textarea) return;
        const content = textarea.value;
        const doc = currentDocs[activeDocIndex];
        try {
          await window.apiClient.postFile(doc.path, content);
          doc.content = content;
          isEditMode = false;
          updateActionButtons();
          renderContent();
          window.showToast('保存成功', 'success');
        } catch (err) {
          window.showToast('保存失败: ' + err.message, 'error');
        }
      } else {
        isEditMode = true;
        updateActionButtons();
        renderContent();
      }
    });
  }

  if (btnDocPreview) {
    btnDocPreview.addEventListener('click', () => {
      isPreviewMode = !isPreviewMode;
      const textarea = docContent.querySelector('.doc-editor');
      let currentContent = '';
      let selectionStart = 0;
      let selectionEnd = 0;
      if (textarea) {
        currentContent = textarea.value;
        selectionStart = textarea.selectionStart;
        selectionEnd = textarea.selectionEnd;
      }
      updateActionButtons();
      renderContent();
      const newTextarea = docContent.querySelector('.doc-editor');
      if (newTextarea && currentContent) {
        newTextarea.value = currentContent;
        newTextarea.focus();
        newTextarea.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  }

  /* ========== Modals ========== */
  let currentRenameIndex = -1;

  function buildDocContent(title) {
    var now = new Date().toLocaleString('zh-CN', { hour12: false });
    return '# ' + title + '\n\n---\n创建时间：' + now + '\n---\n\n## 需求说明\n\n这里填写需求说明\n';
  }

  function checkDocName(value) {
    if (!/^[a-zA-Z0-9_\-一-龥]+$/.test(value)) return '名称包含非法字符';
    return null;
  }

  if (btnAdd) {
    btnAdd.addEventListener('click', async function() {
      if (!currentType || !currentPath) {
        window.showToast('请先选择一个页面', 'error');
        return;
      }
      var rawName = await AxhostModal.prompt({
        title: '新建文档',
        placeholder: '输入文档名称，不需要 .md 后缀',
        validator: checkDocName
      });
      if (!rawName) return;
      var name = rawName + '.md';
      var base = 'prototype/' + currentType + 's/' + currentPath;
      var docPath = base + '/docs/' + name;
      if (currentDocs.some(function(d) { return d.name === name; })) {
        window.showToast('文档 "' + name + '" 已存在', 'error');
        return;
      }
      try {
        var content = buildDocContent(rawName);
        await window.apiClient.postFile(docPath, content);
        currentDocs.push({ name: name, path: docPath, content: content });
        activeDocIndex = currentDocs.length - 1;
        isEditMode = false;
        renderTabs();
        renderContent();
        window.showToast('文档创建成功', 'success');
      } catch (err) {
        window.showToast('创建失败: ' + err.message, 'error');
      }
    });
  }

  /* ========== Sort Modal ========== */
  var sortDocs = [];
  var draggedIndex = null;

  function renderSortList(sortListEl, docs) {
    sortListEl.innerHTML = '';
    docs.forEach(function(doc, idx) {
      var item = document.createElement('div');
      item.className = 'doc-sort-item';
      item.draggable = true;
      item.dataset.index = idx;
      item.innerHTML = '<iconpark-icon icon-id="hamburger-button" size="14" color="currentColor"></iconpark-icon><span>' + doc.name + '</span>';

      item.addEventListener('dragstart', function(e) {
        draggedIndex = idx;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', function() {
        draggedIndex = null;
        item.classList.remove('dragging');
        sortListEl.querySelectorAll('.doc-sort-item').forEach(function(el) {
          el.classList.remove('drop-before', 'drop-after');
        });
      });

      sortListEl.appendChild(item);
    });
  }

  function setupSortDragDrop(sortListEl) {
    sortListEl.addEventListener('dragover', function(e) {
      e.preventDefault();
      if (draggedIndex === null) return;
      var target = e.target.closest('.doc-sort-item');
      if (!target) return;

      var targetIdx = parseInt(target.dataset.index, 10);
      if (targetIdx === draggedIndex) return;

      sortListEl.querySelectorAll('.doc-sort-item').forEach(function(el) {
        el.classList.remove('drop-before', 'drop-after');
      });

      var rect = target.getBoundingClientRect();
      var midY = rect.top + rect.height / 2;
      target.classList.add(e.clientY < midY ? 'drop-before' : 'drop-after');
    });

    sortListEl.addEventListener('drop', function(e) {
      e.preventDefault();
      if (draggedIndex === null) return;
      var target = e.target.closest('.doc-sort-item');
      if (!target) return;

      var targetIdx = parseInt(target.dataset.index, 10);
      if (targetIdx === draggedIndex) return;

      var rect = target.getBoundingClientRect();
      var midY = rect.top + rect.height / 2;
      var toIdx = targetIdx;
      if (e.clientY > midY) toIdx++;
      if (draggedIndex < toIdx) toIdx--;

      var moved = sortDocs.splice(draggedIndex, 1)[0];
      sortDocs.splice(toIdx, 0, moved);
      renderSortList(sortListEl, sortDocs);
    });
  }

  function openSortModal() {
    if (!currentType || !currentPath) {
      window.showToast('请先选择一个页面', 'error');
      return;
    }
    if (currentDocs.length === 0) {
      window.showToast('暂无文档可排序', 'error');
      return;
    }
    sortDocs = currentDocs.map(function(d) { return { name: d.name }; });

    var modal = new AxhostModal({
      title: '排序文档',
      width: '320px',
      body: function(container) {
        container.innerHTML = '<div class="doc-sort-list" id="doc-sort-list"></div>';
        var sortListEl = container.querySelector('#doc-sort-list');
        renderSortList(sortListEl, sortDocs);
        setupSortDragDrop(sortListEl);
      },
      onConfirm: function() {
        var base = 'prototype/' + currentType + 's/' + currentPath + '/docs';
        var order = sortDocs.map(function(d) { return d.name; });
        return window.apiClient.postDocsReorder({ path: base, order: order }).then(function() {
          return load(currentType, currentPath);
        }).then(function() {
          window.showToast('排序已保存', 'success');
        }).catch(function(err) {
          window.showToast('保存失败: ' + err.message, 'error');
          throw err;
        });
      }
    });
    modal.open();
  }

  if (btnSort) {
    btnSort.addEventListener('click', openSortModal);
  }

  /* ========== Context Menu ========== */
  function showDocContextMenu(event, doc, idx) {
    removeDocContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.id = 'doc-tab-context-menu';

    // Edit submenu
    const editItem = document.createElement('div');
    editItem.className = 'context-menu-item';
    editItem.textContent = '编辑';
    const subMenu = document.createElement('div');
    subMenu.className = 'context-menu-submenu';
    ['vscode', 'cursor', 'trae'].forEach(editor => {
      const sub = document.createElement('div');
      sub.className = 'context-menu-item';
      const nameMap = { vscode: 'VS Code', cursor: 'Cursor', trae: 'Trae' };
      sub.textContent = `使用 ${nameMap[editor]} 打开`;
      sub.onclick = () => {
        removeDocContextMenu();
        openDocInEditor(editor, doc.path);
      };
      subMenu.appendChild(sub);
    });
    editItem.appendChild(subMenu);
    menu.appendChild(editItem);

    const renameItem = document.createElement('div');
    renameItem.className = 'context-menu-item';
    renameItem.textContent = '重命名';
    renameItem.onclick = async function() {
      currentRenameIndex = idx;
      removeDocContextMenu();
      var curDoc = currentDocs[idx];
      var curName = curDoc.name.replace(/\.md$/, '');
      var newRawName = await AxhostModal.prompt({
        title: '重命名文档',
        placeholder: '输入文档名称',
        defaultValue: curName,
        validator: checkDocName
      });
      if (!newRawName) return;
      var newName = newRawName + '.md';
      if (newName === curDoc.name) return;
      if (currentDocs.some(function(d, i) { return i !== idx && d.name === newName; })) {
        window.showToast('文档 "' + newName + '" 已存在', 'error');
        return;
      }
      try {
        var oldPath = curDoc.path;
        var newPath = oldPath.replace(/\/[^/]+$/, '/' + newName);
        await window.apiClient.postRename({ oldPath: oldPath, newName: newName });
        curDoc.name = newName;
        curDoc.path = newPath;
        activeDocIndex = currentDocs.findIndex(function(d) { return d.name === newName; });
        isEditMode = false;
        renderTabs();
        renderContent();
        window.showToast('重命名成功', 'success');
      } catch (err) {
        window.showToast('重命名失败: ' + err.message, 'error');
      }
    };

    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item';
    deleteItem.textContent = '删除';
    deleteItem.onclick = async () => {
      removeDocContextMenu();
      const ok = await window.showConfirm('删除确认', `是否删除文档 "${doc.name}"？`);
      if (!ok) return;
      try {
        await window.apiClient.postDelete({ path: doc.path });
        currentDocs.splice(idx, 1);
        if (currentDocs.length === 0) {
          activeDocIndex = 0;
        } else if (activeDocIndex >= currentDocs.length) {
          activeDocIndex = currentDocs.length - 1;
        } else if (idx < activeDocIndex) {
          activeDocIndex--;
        }
        isEditMode = false;
        renderTabs();
        updateActionButtons();
        renderContent();
      } catch (err) {
        alert('删除失败: ' + err.message);
      }
    };

    menu.appendChild(renameItem);
    menu.appendChild(deleteItem);
    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', removeDocContextMenu, { once: true });
    }, 0);
  }

  async function openDocInEditor(editor, filePath) {
    try {
      const res = await window.apiClient.postOpenEditor({ editor, filePath });
      if (res.code === 0) {
        const nameMap = { vscode: 'VS Code', cursor: 'Cursor', trae: 'Trae' };
        window.showToast(`已在 ${nameMap[editor]} 中打开`, 'success');
      } else {
        window.showToast(res.message || '打开失败', 'error');
      }
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  }

  function removeDocContextMenu() {
    const menu = document.getElementById('doc-tab-context-menu');
    if (menu) menu.remove();
  }

  /* ========== Doc Link Click Handler ========== */
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
          isEditMode = false;
          renderTabs();
          updateActionButtons();
          renderContent();
        }
        return;
      }
      if (mode === 'cross-page') {
        const type = link.dataset.docType;
        const path = link.dataset.docPath;
        if (!type || !path) return;
        if (type === currentType && path === currentPath) {
          const idx = currentDocs.findIndex(d => d.name === docName);
          if (idx >= 0) {
            activeDocIndex = idx;
            isEditMode = false;
            renderTabs();
            updateActionButtons();
            renderContent();
          }
          return;
        }
        const shell = window.shell || (window.parent && window.parent.shell);
        if (shell && shell.loadPage) {
          window.__axhostPendingDoc = docName;
          shell.loadPage(type, path);
        }
      }
    });
  }

  /* ========== Doc Link Autocomplete (Edit Mode) ========== */
  var acDropdown = null;
  var acState = null;
  var acCache = {};
  var isComposing = false;

  function findTrigger(text, cursorPos) {
    var before = text.substring(0, cursorPos);
    var stage2 = before.match(/\]\(([@#])([^/]+)\/([^/\s]*)$/);
    if (stage2) {
      var slashPos = before.lastIndexOf('/') + 1;
      return {
        stage: 2,
        char: stage2[1],
        path: stage2[2],
        keyword: stage2[3],
        startPos: slashPos
      };
    }
    var stage1 = before.match(/\]\(([@#])([^/\s]*)$/);
    if (stage1) {
      return {
        stage: 1,
        char: stage1[1],
        keyword: stage1[2],
        startPos: stage1.index + 2
      };
    }
    return null;
  }

  async function loadDocNames(type, path) {
    var tab = type === 'page' ? 'pages' : 'components';
    var base = 'prototype/' + tab + '/' + path;
    try {
      var res = await window.apiClient.getDocs(base + '/docs');
      if (res.code === 0) return res.data || [];
    } catch (e) {}
    return ['readme.md'];
  }

  async function updateDropdown(textarea) {
    if (isComposing) return;
    var pos = textarea.selectionStart;
    var text = textarea.value;
    var trigger = findTrigger(text, pos);
    if (!trigger) {
      window.acCore.hideDropdown(acDropdown);
      acState = null;
      return;
    }

    if (!acState) acCache = {};

    var items = [];
    if (trigger.stage === 1) {
      var type = trigger.char === '@' ? 'pages' : 'components';
      items = await window.acCore.loadScanData(type, acCache);
    } else {
      var type2 = trigger.char === '@' ? 'page' : 'component';
      var names = await loadDocNames(type2, trigger.path);
      items = names.map(function (name) { return { name: name, breadcrumb: '' }; });
    }

    var filtered = window.acCore.filterItems(items, trigger.keyword);

    if (filtered.length === 0) {
      window.acCore.hideDropdown(acDropdown);
      acState = null;
      return;
    }

    acDropdown = window.acCore.ensureDropdown('doc-link-autocomplete', 'prompt-autocomplete');

    window.acCore.buildDropdownItems(filtered, window.acCore.escapeHtml, function (item) {
      selectItem(item, textarea);
    }, acDropdown);

    window.acCore.positionDropdown(acDropdown, textarea, trigger.startPos);

    acState = { trigger: trigger, items: filtered, selectedIndex: 0 };
  }

  function selectItem(item, textarea) {
    if (!acState) return;
    var trigger = acState.trigger;
    var text = textarea.value;
    var cursorPos = textarea.selectionStart;
    var replacement = '';
    if (trigger.stage === 1) {
      replacement = trigger.char + item.path + '/';
    } else {
      replacement = item.name;
    }
    var newText = text.substring(0, trigger.startPos) + replacement + text.substring(cursorPos);
    textarea.value = newText;
    var newPos = trigger.startPos + replacement.length;
    textarea.setSelectionRange(newPos, newPos);
    window.acCore.hideDropdown(acDropdown);
    acState = null;
    textarea.focus();
    if (trigger.stage === 1) {
      setTimeout(function () { updateDropdown(textarea); }, 0);
    }
  }

  function handleKeyDown(e, textarea) {
    if (!acState) return;
    window.acCore.handleKeyNav(e, acState, acDropdown, function (item) {
      selectItem(item, textarea);
    });
  }

  function bindDocLinkAutocomplete(textarea) {
    textarea.addEventListener('input', function () { updateDropdown(textarea); });
    textarea.addEventListener('compositionstart', function () { isComposing = true; });
    textarea.addEventListener('compositionend', function () { isComposing = false; updateDropdown(textarea); });
    textarea.addEventListener('keydown', function (e) { handleKeyDown(e, textarea); });
  }

  document.addEventListener('click', function (e) {
    if (acState && acDropdown && !acDropdown.contains(e.target) && !e.target.classList.contains('doc-editor')) {
      window.acCore.hideDropdown(acDropdown);
      acState = null;
    }
  });


  setupTabsScroll();
  window.docPanel = { load, isEditing: () => isEditMode };
})();
