(function () {
  const treeRoot = document.getElementById('tree-root');
  let currentTab = 'pages';
  let expandedPaths = new Set();
  let selectedPath = null;
  let treeData = [];
  let hasAutoLoaded = false;
  let draggedItem = null;
  let draggedParentUl = null;

  function isAncestor(ancestorLi, descendantLi) {
    let el = descendantLi.parentElement;
    while (el) {
      if (el === ancestorLi) return true;
      el = el.parentElement;
    }
    return false;
  }

  function findFirstPage(nodes) {
    for (const n of nodes) {
      if (n.type === 'page' || n.type === 'component') return n;
      if (n.children) {
        const f = findFirstPage(n.children);
        if (f) return f;
      }
    }
    return null;
  }

  function findNodeById(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const f = findNodeById(n.children, id);
        if (f) return f;
      }
    }
    return null;
  }

  function expandAncestors(nodePath) {
    const parts = nodePath.split('/');
    let prefix = '';
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'sub-pages') continue;
      prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
      if (i < parts.length - 1) {
        expandedPaths.add(prefix);
      }
    }
  }

  function getNodeTypeForTab(node) {
    return node.type === 'component' ? 'component' : 'page';
  }

  async function initTreeNav() {
    renderTabs();
    await loadTree(currentTab);
    treeRoot.addEventListener('contextmenu', (e) => {
      const label = e.target.closest('.tree-label');
      if (!label) {
        e.preventDefault();
        showRootContextMenu(e);
      }
    });

    // 拖拽排序 / 移动
    treeRoot.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggedItem) return;
      const targetLi = e.target.closest('.tree-item');
      if (!targetLi || targetLi === draggedItem) return;

      document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('drop-before', 'drop-after', 'drop-into'));

      const targetType = targetLi.dataset.type;
      const isContainer = targetType === 'dir' || targetType === 'page' || targetType === 'component';
      const canMoveInto = isContainer && !isAncestor(draggedItem, targetLi);

      const rect = targetLi.getBoundingClientRect();
      const midTop = rect.top + rect.height * 0.3;
      const midBottom = rect.bottom - rect.height * 0.3;

      if (canMoveInto && e.clientY > midTop && e.clientY < midBottom) {
        targetLi.classList.add('drop-into');
      } else {
        targetLi.classList.add(e.clientY > rect.top + rect.height / 2 ? 'drop-after' : 'drop-before');
      }
    });

    treeRoot.addEventListener('dragleave', () => {
      document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('drop-before', 'drop-after', 'drop-into'));
    });

    treeRoot.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (!draggedItem || !draggedParentUl) return;

      const targetLi = e.target.closest('.tree-item');
      if (!targetLi || targetLi === draggedItem) return;

      try {
        const sourcePath = draggedItem.dataset.path;
        const targetPath = targetLi.dataset.path;
        if (targetLi.classList.contains('drop-into')) {
          await window.apiClient.postMove({ type: currentTab, sourcePath, targetPath });
          expandedPaths.add(targetPath);
          window.showToast('移动成功', 'success');
        } else {
          const position = targetLi.classList.contains('drop-after') ? 'after' : 'before';
          await window.apiClient.postMove({ type: currentTab, sourcePath, targetPath, position });
          window.showToast('排序已保存', 'success');
        }
        await loadTree(currentTab);
      } catch (err) {
        console.error('Tree drag/drop error:', err);
        window.showToast((err && err.message) || '操作失败', 'error');
      } finally {
        document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('drop-before', 'drop-after', 'drop-into'));
      }
    });
  }

  function renderTabs() {
    const tabs = document.querySelectorAll('.nav-tabs button');
    tabs.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === currentTab);
      btn.onclick = () => {
        currentTab = btn.dataset.tab;
        renderTabs();
        loadTree(currentTab);
      };
    });
  }

  async function loadTree(type) {
    try {
      const res = await window.apiClient.getScan(type);
      if (res.code !== 0) return;
      treeData = res.data || [];
      treeRoot.innerHTML = '';
      const ul = document.createElement('ul');
      ul.className = 'tree-list';
      for (const node of treeData) {
        ul.appendChild(buildNode(node, type));
      }
      treeRoot.appendChild(ul);
      if (!hasAutoLoaded && !selectedPath) {
        const hashId = location.hash ? location.hash.slice(1) : '';
        let hashNode = hashId ? findNodeById(treeData, hashId) : null;
        if (hashId && !hashNode && currentTab === 'pages') {
          await loadTree('components');
          hashNode = findNodeById(treeData, hashId);
          if (hashNode) {
            currentTab = 'components';
            renderTabs();
          }
        } else if (hashId && !hashNode && currentTab === 'components') {
          await loadTree('pages');
          hashNode = findNodeById(treeData, hashId);
          if (hashNode) {
            currentTab = 'pages';
            renderTabs();
          }
        }
        const target = hashNode || findFirstPage(treeData);
        if (target) {
          hasAutoLoaded = true;
          if (hashNode) {
            expandAncestors(hashNode.path);
            treeRoot.innerHTML = '';
            const ul2 = document.createElement('ul');
            ul2.className = 'tree-list';
            for (const node of treeData) {
              ul2.appendChild(buildNode(node, currentTab));
            }
            treeRoot.appendChild(ul2);
          }
          selectedPath = target.path;
          if (window.shell && window.shell.loadPage) {
            window.shell.loadPage(getNodeTypeForTab(target), target.path);
          }
        }
      }
    } catch (err) {
      console.error('Load tree error:', err);
      treeRoot.innerHTML = '<div style="padding:12px;color:#999">Failed to load tree</div>';
    }
  }

  function buildNode(node, type, level = 0) {
    const li = document.createElement('li');
    li.className = 'tree-item';
    li.dataset.path = node.path;
    li.dataset.type = node.type;

    const label = document.createElement('div');
    label.className = 'tree-label';
    label.style.paddingLeft = (level * 16 + 8) + 'px';
    if (selectedPath === node.path) {
      label.classList.add('active');
    }

    const hasChildren = node.children && node.children.length > 0;
    const isExpandable = node.type === 'dir' || hasChildren;

    const arrow = document.createElement('span');
    arrow.className = 'tree-arrow';
    if (isExpandable) {
      arrow.textContent = expandedPaths.has(node.path) ? '▼' : '▶';
    } else {
      arrow.textContent = '';
    }

    function createTreeIcon(iconId) {
      const el = document.createElement('iconpark-icon');
      el.setAttribute('size', '12');
      el.setAttribute('color', 'currentColor');
      el.setAttribute('stroke', 'currentColor');
      el.setAttribute('fill', 'currentColor');
      el.setAttribute('icon-id', iconId);
      return el;
    }

    let icon = null;
    if (node.type === 'dir') {
      icon = createTreeIcon(expandedPaths.has(node.path) ? 'folder-open' : 'folder-close');
    } else if (node.type === 'page') {
      icon = createTreeIcon('page');
    } else if (node.type === 'component') {
      icon = createTreeIcon('figma-component');
    }

    const text = document.createElement('span');
    text.textContent = node.name;

    label.appendChild(arrow);
    if (icon) label.appendChild(icon);
    label.appendChild(text);
    li.appendChild(label);

    li.draggable = true;
    li.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      draggedItem = li;
      draggedParentUl = li.parentElement;
      e.dataTransfer.effectAllowed = 'move';
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      draggedItem = null;
      draggedParentUl = null;
      document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('drop-before', 'drop-after', 'drop-into'));
    });

    if (isExpandable) {
      if (expandedPaths.has(node.path)) {
        const childrenUl = document.createElement('ul');
        childrenUl.className = 'tree-list';
        for (const child of (node.children || [])) {
          childrenUl.appendChild(buildNode(child, type, level + 1));
        }
        li.appendChild(childrenUl);
      }

      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        if (expandedPaths.has(node.path)) {
          expandedPaths.delete(node.path);
        } else {
          expandedPaths.add(node.path);
        }
        loadTree(currentTab);
      });
    }

    if (node.type === 'dir') {
      label.addEventListener('click', () => {
        if (expandedPaths.has(node.path)) {
          expandedPaths.delete(node.path);
        } else {
          expandedPaths.add(node.path);
        }
        loadTree(currentTab);
      });

      const iconEl = label.querySelector('iconpark-icon');
      if (iconEl) {
        iconEl.setAttribute('icon-id', expandedPaths.has(node.path) ? 'folder-open' : 'folder-close');
        iconEl.setAttribute('color', 'currentColor');
        iconEl.setAttribute('stroke', 'currentColor');
        iconEl.setAttribute('fill', 'currentColor');
      }

      label.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showDirContextMenu(e, node, type);
      });
    } else {
      label.addEventListener('click', () => {
        selectedPath = node.path;
        if (node.id) location.hash = '#' + node.id;
        loadTree(currentTab);
        if (window.shell && window.shell.loadPage) {
          window.shell.loadPage(type === 'components' ? 'component' : 'page', node.path);
        }
      });

      label.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showPageContextMenu(e, node, type);
      });
    }

    return li;
  }

  function getSiblings(parentPath) {
    if (!parentPath) return treeData;
    const parts = parentPath.split('/');
    let nodes = treeData;
    for (const part of parts) {
      if (part === 'sub-pages') continue;
      const dir = nodes.find(n => n.name === part && (n.type === 'dir' || n.type === 'page' || n.type === 'component'));
      if (!dir) return [];
      nodes = dir.children || [];
    }
    return nodes;
  }

  function hasSiblingName(parentPath, name) {
    const siblings = getSiblings(parentPath);
    return siblings.some(n => n.name === name);
  }

  function showRootContextMenu(e) {
    const items = [
      { label: currentTab === 'components' ? '新建组件' : '新建页面', action: 'create_page' },
      { label: '新建目录', action: 'create_folder' }
    ];
    renderMenu(e, items, (action) => {
      if (action === 'create_page') {
        const kind = currentTab === 'components' ? 'component' : 'page';
        handleCreate('', kind);
      } else if (action === 'create_folder') {
        handleCreate('', 'folder');
      }
    });
  }

  function showDirContextMenu(e, node, type) {
    const items = [
      { label: type === 'components' ? '新建组件' : '新建页面', action: 'create_page' },
      { label: '新建目录', action: 'create_folder' },
      { label: '复制路径', action: 'copy_path' },
      { label: '重命名', action: 'rename' },
      { label: '删除', action: 'delete' }
    ];
    renderMenu(e, items, (action) => {
      if (action === 'create_page') {
        const kind = type === 'components' ? 'component' : 'page';
        handleCreate(node.path, kind);
      } else if (action === 'create_folder') {
        handleCreate(node.path, 'folder');
      } else if (action === 'copy_path') {
        navigator.clipboard.writeText(node.path);
      } else if (action === 'rename') {
        handleRename(node.path, type, true);
      } else if (action === 'delete') {
        handleDelete(node.path, type, true);
      }
    });
  }

  function showPageContextMenu(e, node, type) {
    const items = [
      { label: type === 'components' ? '新建组件' : '新建页面', action: 'create_page' },
      { label: '新建子目录', action: 'create_subfolder' },
      { label: '复制路径', action: 'copy_path' },
      { label: '新标签页打开', action: 'open_new' },
      { label: '重命名', action: 'rename' },
      { label: '删除', action: 'delete' }
    ];
    renderMenu(e, items, (action) => {
      if (action === 'create_page') {
        const kind = type === 'components' ? 'component' : 'page';
        handleCreate(node.path + '/sub-pages', kind);
      } else if (action === 'create_subfolder') {
        handleCreate(node.path + '/sub-pages', 'folder');
      } else if (action === 'copy_path') {
        navigator.clipboard.writeText(`/prototype/${type}/${node.path}/index.html`);
      } else if (action === 'open_new') {
        window.open(`/prototype/${type}/${node.path}/index.html`, '_blank');
      } else if (action === 'rename') {
        handleRename(node.path, type, false);
      } else if (action === 'delete') {
        const hasChildren = node.children && node.children.length > 0;
        handleDelete(node.path, type, hasChildren);
      }
    });
  }

  function renderMenu(event, items, onSelect) {
    removeExistingMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'context-menu-item';
      div.textContent = item.label;
      div.onclick = () => {
        onSelect(item.action);
        removeExistingMenu();
      };
      menu.appendChild(div);
    });
    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', removeExistingMenu, { once: true });
    }, 0);
  }

  function removeExistingMenu() {
    document.querySelectorAll('.context-menu').forEach(el => el.remove());
  }

  async function handleCreate(parentPath, kind) {
    const labelMap = { page: '页面', component: '组件', folder: '目录' };
    const name = await window.showPrompt(`请输入${labelMap[kind]}名称`);
    if (!name) return;
    if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(name)) {
      window.showToast('名称包含非法字符', 'error');
      return;
    }
    if (hasSiblingName(parentPath, name)) {
      window.showToast(`同级下已存在名为 "${name}" 的目录或页面`, 'error');
      return;
    }
    try {
      const parent = `prototype/${currentTab}${parentPath ? '/' + parentPath : ''}`;
      await window.apiClient.postCreate({ parentPath: parent, name, kind });
      if (parentPath) {
        const expandPath = parentPath.endsWith('/sub-pages') ? parentPath.replace(/\/sub-pages$/, '') : parentPath;
        expandedPaths.add(expandPath);
      }
      await loadTree(currentTab);
      window.showToast(kind === 'folder' ? '目录创建成功' : (kind === 'component' ? '组件创建成功' : '页面创建成功'), 'success');
    } catch (err) {
      console.error('Create error:', err);
      window.showToast('创建失败: ' + err.message, 'error');
    }
  }

  async function handleRename(nodePath, type, isDir) {
    const oldName = nodePath.split('/').pop();
    const newName = await window.showPrompt('请输入新名称', '', oldName);
    if (!newName || newName === oldName) return;
    if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(newName)) {
      window.showToast('名称包含非法字符', 'error');
      return;
    }
    const parentPath = nodePath.includes('/') ? nodePath.substring(0, nodePath.lastIndexOf('/')) : '';
    if (hasSiblingName(parentPath, newName)) {
      window.showToast(`同级下已存在名为 "${newName}" 的目录或页面`, 'error');
      return;
    }
    try {
      const oldAbs = `prototype/${currentTab}/${nodePath}`;
      await window.apiClient.postRename({ oldPath: oldAbs, newName });
      await loadTree(currentTab);
      window.showToast('重命名成功', 'success');
      if (!isDir && selectedPath === nodePath) {
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        selectedPath = newPath;
        if (window.shell && window.shell.loadPage) {
          window.shell.loadPage(type === 'components' ? 'component' : 'page', newPath);
        }
      }
    } catch (err) {
      console.error('Rename error:', err);
      window.showToast('重命名失败: ' + err.message, 'error');
    }
  }

  async function handleDelete(nodePath, type, hasChildren) {
    const name = nodePath.split('/').pop();
    const msg = hasChildren
      ? `是否删除 "${name}" 及其下的所有页面/组件？`
      : `是否删除${type === 'components' ? '组件' : '页面'} "${name}"？`;
    const ok = await window.showConfirm('删除确认', msg);
    if (!ok) return;
    try {
      const target = `prototype/${currentTab}/${nodePath}`;
      await window.apiClient.postDelete({ path: target });
      if (selectedPath === nodePath) {
        selectedPath = null;
        const previewFrame = document.getElementById('preview-frame');
        if (previewFrame) previewFrame.src = 'about:blank';
        if (window.docPanel && window.docPanel.load) {
          window.docPanel.load(type, '');
        }
      }
      await loadTree(currentTab);
      window.showToast('删除成功', 'success');
    } catch (err) {
      console.error('Delete error:', err);
      window.showToast('删除失败: ' + err.message, 'error');
    }
  }

  window.addEventListener('hashchange', () => {
    const hashId = location.hash ? location.hash.slice(1) : '';
    if (!hashId) return;
    const node = findNodeById(treeData, hashId);
    if (!node) return;
    const type = getNodeTypeForTab(node);
    const tab = type === 'component' ? 'components' : 'pages';
    if (currentTab !== tab) {
      currentTab = tab;
      renderTabs();
    }
    selectedPath = node.path;
    expandAncestors(node.path);
    loadTree(currentTab);
    if (window.shell && window.shell.loadPage) {
      window.shell.loadPage(type, node.path);
    }
  });

  window.treeNav = { init: initTreeNav, refresh: () => loadTree(currentTab) };
})();
