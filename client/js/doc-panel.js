(function () {
  const docTabs = document.getElementById('doc-tabs-scroll');
  const docContent = document.getElementById('doc-content');
  const btnEdit = document.getElementById('btn-doc-edit');
  const btnSave = document.getElementById('btn-doc-save');
  const btnAdd = document.getElementById('btn-doc-add');

  let currentDocs = [];
  let activeDocIndex = 0;
  let isEditMode = false;
  let currentType = null;
  let currentPath = null;
  let loadToken = 0;

  async function load(type, pagePath) {
    const token = ++loadToken;
    currentType = type;
    currentPath = pagePath;
    isEditMode = false;
    activeDocIndex = 0;

    const base = `prototype/${type}s/${pagePath}`;
    const docs = [];
    try {
      const res = await window.apiClient.getDocs(`${base}/docs`);
      const names = (res.code === 0 ? res.data : []).sort();
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
    renderTabs();
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
        renderContent();
      };
      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showDocContextMenu(e, doc, idx);
      });
      docTabs.appendChild(tab);
    });
  }

  function renderContent() {
    if (currentDocs.length === 0) {
      docContent.innerHTML = '<p style="color:#858585">该页面暂无文档。</p>';
      return;
    }
    if (isEditMode) {
      const textarea = document.createElement('textarea');
      textarea.className = 'doc-editor';
      textarea.value = currentDocs[activeDocIndex].content;
      docContent.innerHTML = '';
      docContent.appendChild(textarea);
    } else {
      const html = window.mdRenderer.renderMarkdown(currentDocs[activeDocIndex].content);
      docContent.innerHTML = html;
    }
  }

  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      if (currentDocs.length === 0) return;
      isEditMode = !isEditMode;
      renderContent();
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      if (!isEditMode || currentDocs.length === 0) return;
      const textarea = document.querySelector('.doc-editor');
      if (!textarea) return;
      const content = textarea.value;
      const doc = currentDocs[activeDocIndex];
      try {
        await window.apiClient.postFile(doc.path, content);
        doc.content = content;
        isEditMode = false;
        renderContent();
        window.showToast('保存成功', 'success');
      } catch (err) {
        window.showToast('保存失败: ' + err.message, 'error');
      }
    });
  }

  /* ========== Modals ========== */
  function createModal(id, title) {
    const modal = document.createElement('div');
    modal.className = 'add-doc-modal';
    modal.id = id;
    modal.innerHTML = `
      <div class="add-doc-modal-overlay"></div>
      <div class="add-doc-modal-content">
        <h4>${title}</h4>
        <input type="text" class="doc-modal-input" placeholder="输入文档名称，不需要 .md 后缀">
        <div class="add-doc-modal-actions">
          <button class="doc-modal-cancel">取消</button>
          <button class="doc-modal-confirm primary">确认</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  const addModal = createModal('add-doc-modal', '新建文档');
  const renameModal = createModal('rename-doc-modal', '重命名文档');

  let currentRenameIndex = -1;

  function openModal(modalEl, value = '') {
    const input = modalEl.querySelector('.doc-modal-input');
    input.value = value;
    modalEl.classList.add('open');
    setTimeout(() => input.focus(), 0);
  }

  function closeModal(modalEl) {
    modalEl.classList.remove('open');
  }

  addModal.querySelector('.add-doc-modal-overlay').addEventListener('click', () => closeModal(addModal));
  addModal.querySelector('.doc-modal-cancel').addEventListener('click', () => closeModal(addModal));
  renameModal.querySelector('.add-doc-modal-overlay').addEventListener('click', () => closeModal(renameModal));
  renameModal.querySelector('.doc-modal-cancel').addEventListener('click', () => closeModal(renameModal));

  function buildDocContent(title) {
    const now = new Date().toLocaleString('zh-CN', { hour12: false });
    return `# ${title}\n\n---\n创建时间：${now}\n---\n\n## 需求说明\n\n这里填写需求说明\n`;
  }

  addModal.querySelector('.doc-modal-confirm').addEventListener('click', async () => {
    const rawName = addModal.querySelector('.doc-modal-input').value.trim();
    if (!rawName) {
      window.showToast('请输入文档名称', 'error');
      return;
    }
    if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(rawName)) {
      window.showToast('名称包含非法字符', 'error');
      return;
    }
    const name = rawName + '.md';
    const base = `prototype/${currentType}s/${currentPath}`;
    const docPath = `${base}/docs/${name}`;

    if (currentDocs.some(d => d.name === name)) {
      window.showToast(`文档 "${name}" 已存在`, 'error');
      return;
    }

    try {
      const content = buildDocContent(rawName);
      await window.apiClient.postFile(docPath, content);
      currentDocs.push({ name, path: docPath, content });
      currentDocs.sort((a, b) => a.name.localeCompare(b.name));
      activeDocIndex = currentDocs.findIndex(d => d.name === name);
      isEditMode = false;
      renderTabs();
      renderContent();
      closeModal(addModal);
      window.showToast('文档创建成功', 'success');
    } catch (err) {
      window.showToast('创建失败: ' + err.message, 'error');
    }
  });

  addModal.querySelector('.doc-modal-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addModal.querySelector('.doc-modal-confirm').click();
    else if (e.key === 'Escape') closeModal(addModal);
  });

  renameModal.querySelector('.doc-modal-confirm').addEventListener('click', async () => {
    const rawName = renameModal.querySelector('.doc-modal-input').value.trim();
    if (!rawName) {
      window.showToast('请输入文档名称', 'error');
      return;
    }
    if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(rawName)) {
      window.showToast('名称包含非法字符', 'error');
      return;
    }
    const newName = rawName + '.md';
    const doc = currentDocs[currentRenameIndex];
    if (newName === doc.name) {
      closeModal(renameModal);
      return;
    }
    if (currentDocs.some((d, i) => i !== currentRenameIndex && d.name === newName)) {
      window.showToast(`文档 "${newName}" 已存在`, 'error');
      return;
    }

    try {
      const oldPath = doc.path;
      const newPath = oldPath.replace(/\/[^/]+$/, '/' + newName);
      await window.apiClient.postRename({ oldPath, newName });
      doc.name = newName;
      doc.path = newPath;
      currentDocs.sort((a, b) => a.name.localeCompare(b.name));
      activeDocIndex = currentDocs.findIndex(d => d.name === newName);
      isEditMode = false;
      renderTabs();
      renderContent();
      closeModal(renameModal);
      window.showToast('重命名成功', 'success');
    } catch (err) {
      window.showToast('重命名失败: ' + err.message, 'error');
    }
  });

  renameModal.querySelector('.doc-modal-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') renameModal.querySelector('.doc-modal-confirm').click();
    else if (e.key === 'Escape') closeModal(renameModal);
  });

  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      if (!currentType || !currentPath) {
        window.showToast('请先选择一个页面', 'error');
        return;
      }
      openModal(addModal, '');
    });
  }

  /* ========== Context Menu ========== */
  function showDocContextMenu(event, doc, idx) {
    removeDocContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.id = 'doc-tab-context-menu';

    const renameItem = document.createElement('div');
    renameItem.className = 'context-menu-item';
    renameItem.textContent = '重命名';
    renameItem.onclick = () => {
      currentRenameIndex = idx;
      openModal(renameModal, doc.name.replace(/\.md$/, ''));
      removeDocContextMenu();
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

  function removeDocContextMenu() {
    const menu = document.getElementById('doc-tab-context-menu');
    if (menu) menu.remove();
  }

  window.docPanel = { load };
})();
