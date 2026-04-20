(function () {
  const modal = document.getElementById('export-modal');
  if (!modal) return;

  const btnExport = document.getElementById('btn-export');
  const btnClose = document.getElementById('export-modal-close');
  const btnCancel = document.getElementById('export-cancel');
  const btnConfirm = document.getElementById('export-confirm');
  const btnSelectDir = document.getElementById('export-select-dir');
  const dirInput = document.getElementById('export-dir-input');
  const projectNameInput = document.getElementById('export-project-name');
  const targetDirInput = document.getElementById('export-target-dir');
  const treeContainer = document.getElementById('export-tree');
  const selectAllCheckbox = document.getElementById('export-select-all');
  const tabButtons = modal.querySelectorAll('.export-tabs button');

  let currentTab = 'pages';
  let treeData = { pages: [], components: [] };
  let expandedPaths = new Set();
  let checkedPaths = new Set(); // 仅在非全选模式下使用
  let selectAll = true;
  let defaultDir = '';

  // Open / Close
  function open() {
    loadDefaultInfo();
    loadTree(currentTab);
    modal.classList.add('open');
  }
  function close() {
    modal.classList.remove('open');
  }

  btnExport.addEventListener('click', open);
  btnClose.addEventListener('click', close);
  btnCancel.addEventListener('click', close);
  modal.querySelector('.export-modal-overlay').addEventListener('click', close);

  // Load default project name and dir
  async function loadDefaultInfo() {
    // Project name
    try {
      const res = await window.apiClient.getSettings();
      if (res.code === 0) {
        projectNameInput.value = res.data.name || '';
      }
    } catch (e) {}

    // Default export dir
    try {
      const res = await fetch('/api/export/default-dir');
      const data = await res.json();
      if (data.code === 0) {
        defaultDir = data.data.path || '';
        targetDirInput.value = defaultDir;
      }
    } catch (e) {}
  }

  // Directory selection via file picker
  btnSelectDir.addEventListener('click', () => {
    dirInput.click();
  });
  dirInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const first = e.target.files[0];
      const dirName = first.webkitRelativePath ? first.webkitRelativePath.split('/')[0] : '';
      if (dirName) {
        targetDirInput.value = defaultDir
          ? defaultDir.replace(/\\/g, '/').replace(/\/[^/]*$/, '') + '/' + dirName
          : dirName;
      }
    }
    dirInput.value = '';
  });

  // Tabs
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      tabButtons.forEach(b => b.classList.toggle('active', b === btn));
      loadTree(currentTab);
    });
  });

  // Select all toggle
  selectAllCheckbox.addEventListener('change', () => {
    selectAll = selectAllCheckbox.checked;
    treeContainer.classList.toggle('all-selected', selectAll);
    renderTree(currentTab);
  });

  // Load tree data
  async function loadTree(type) {
    if (treeData[type] && treeData[type].length > 0) {
      if (selectAll) {
        collectAllPaths(treeData[type], type === 'pages' ? 'page' : 'component', checkedPaths);
      }
      renderTree(type);
      return;
    }
    try {
      const res = await window.apiClient.getScan(type);
      if (res.code === 0) {
        treeData[type] = res.data || [];
        if (selectAll) {
          collectAllPaths(treeData[type], type === 'pages' ? 'page' : 'component', checkedPaths);
        }
        renderTree(type);
      }
    } catch (err) {
      treeContainer.innerHTML = '<div style="padding:12px;color:#999">加载失败</div>';
    }
  }

  function renderTree(type) {
    const nodes = treeData[type] || [];
    treeContainer.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'export-tree-list';
    for (const node of nodes) {
      ul.appendChild(buildNode(node, type, 0));
    }
    treeContainer.appendChild(ul);
  }

  function buildNode(node, type, level) {
    const li = document.createElement('li');
    li.className = 'export-tree-item';

    const label = document.createElement('div');
    label.className = 'export-tree-label';
    label.style.paddingLeft = (level * 16 + 4) + 'px';

    const hasChildren = node.children && node.children.length > 0;
    const isExpandable = node.type === 'dir' || hasChildren;

    const arrow = document.createElement('span');
    arrow.className = 'export-tree-arrow';
    if (isExpandable) {
      arrow.textContent = expandedPaths.has(node.path) ? '▼' : '▶';
    } else {
      arrow.textContent = '';
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'export-tree-checkbox';
    checkbox.dataset.path = node.path;
    checkbox.dataset.type = node.type;

    checkbox.disabled = selectAll;
    checkbox.checked = checkedPaths.has(node.path);
    if (!selectAll) {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          checkedPaths.add(node.path);
        } else {
          checkedPaths.delete(node.path);
        }
      });
    }

    const name = document.createElement('span');
    name.className = 'export-tree-name';
    name.textContent = node.name;

    label.appendChild(arrow);
    if (node.type !== 'dir') {
      label.appendChild(checkbox);
    } else {
      // dir: spacer to align with checkbox
      const spacer = document.createElement('span');
      spacer.style.width = '14px';
      spacer.style.flexShrink = '0';
      label.appendChild(spacer);
    }
    label.appendChild(name);
    li.appendChild(label);

    if (isExpandable && expandedPaths.has(node.path)) {
      const childrenUl = document.createElement('ul');
      childrenUl.className = 'export-tree-children';
      for (const child of (node.children || [])) {
        childrenUl.appendChild(buildNode(child, type, level + 1));
      }
      li.appendChild(childrenUl);
    }

    if (isExpandable) {
      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleExpand(node.path);
      });
      label.addEventListener('click', (e) => {
        if (e.target.classList.contains('export-tree-checkbox')) return;
        toggleExpand(node.path);
      });
    }

    return li;
  }

  function toggleExpand(path) {
    if (expandedPaths.has(path)) {
      expandedPaths.delete(path);
    } else {
      expandedPaths.add(path);
    }
    renderTree(currentTab);
  }

  // Confirm export
  btnConfirm.addEventListener('click', async () => {
    const projectName = projectNameInput.value.trim();
    const targetDir = targetDirInput.value.trim();

    if (!projectName) {
      window.showToast('请输入项目名称', 'error');
      return;
    }
    if (!targetDir) {
      window.showToast('请输入保存目录', 'error');
      return;
    }

    const selectedPages = [];
    const selectedComponents = [];

    if (selectAll) {
      // 全选：导出所有 page/component
      collectAllPaths(treeData.pages, 'page', selectedPages);
      collectAllPaths(treeData.components, 'component', selectedComponents);
    } else {
      // 手动选择
      for (const path of checkedPaths) {
        const inPages = findNodeByPath(treeData.pages, path);
        const inComponents = findNodeByPath(treeData.components, path);
        if (inPages && inPages.type === 'page') selectedPages.push(path);
        if (inComponents && inComponents.type === 'component') selectedComponents.push(path);
      }
    }

    if (selectedPages.length === 0 && selectedComponents.length === 0) {
      window.showToast('请至少选择一个页面或组件', 'error');
      return;
    }

    try {
      btnConfirm.disabled = true;
      btnConfirm.textContent = '导出中...';
      const res = await window.apiClient.postExport({
        projectName,
        targetDir,
        selectedPages,
        selectedComponents
      });
      if (res.code === 0) {
        window.showToast('导出成功: ' + res.data.exportPath, 'success');
        close();
      } else {
        window.showToast('导出失败: ' + (res.message || '未知错误'), 'error');
      }
    } catch (err) {
      window.showToast('导出失败: ' + err.message, 'error');
    } finally {
      btnConfirm.disabled = false;
      btnConfirm.textContent = '导出';
    }
  });

  function collectAllPaths(nodes, targetType, result) {
    for (const node of nodes) {
      if (node.type === targetType) {
        if (result instanceof Set) {
          result.add(node.path);
        } else {
          result.push(node.path);
        }
      }
      if (node.children) {
        collectAllPaths(node.children, targetType, result);
      }
    }
  }

  function findNodeByPath(nodes, targetPath) {
    for (const node of nodes) {
      if (node.path === targetPath) return node;
      if (node.children) {
        const found = findNodeByPath(node.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  }
})();
