(function () {
  const docTabs = document.getElementById('doc-tabs');
  const docContent = document.getElementById('doc-content');
  const btnEdit = document.getElementById('btn-doc-edit');
  const btnSave = document.getElementById('btn-doc-save');

  let currentDocs = [];
  let activeDocIndex = 0;
  let isEditMode = false;
  let currentType = null;
  let currentPath = null;

  async function load(type, pagePath) {
    currentType = type;
    currentPath = pagePath;
    isEditMode = false;
    activeDocIndex = 0;
    currentDocs = [];

    const base = `prototype/${type}s/${pagePath}`;
    try {
      const readme = await window.apiClient.getFile(`${base}/docs/readme.md`);
      currentDocs.push({ name: 'readme.md', path: `${base}/docs/readme.md`, content: readme });
    } catch (e) {}

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
      tab.onclick = () => {
        if (isEditMode && !confirm('切换文档将丢失未保存的修改，是否继续？')) return;
        activeDocIndex = idx;
        isEditMode = false;
        renderTabs();
        renderContent();
      };
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
      } catch (err) {
        alert('保存失败: ' + err.message);
      }
    });
  }

  window.docPanel = { load };
})();
