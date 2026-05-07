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
      if (n.type === 'page' || n.type === 'component' || n.type === 'flowchart' || n.type === 'spec') return n;
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
      prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
      if (i < parts.length - 1) {
        expandedPaths.add(prefix);
      }
    }
  }

  function getNodeTypeForTab(node) {
    if (node.type === 'component') return 'component';
    if (node.type === 'flowchart') return 'flowchart';
    if (node.type === 'spec') return 'spec';
    return 'page';
  }

  function syncTreeFromIframe() {
    const iframe = document.getElementById('preview-frame');
    if (!iframe) return;
    try {
      const url = iframe.contentWindow.location.href;
      const match = url.match(/\/(pages|components|flowcharts)\/([a-f0-9]{8})(?:\/|$)/);
      if (!match) return;
      const tab = match[1];
      const nodePath = match[2];
      if (tab !== currentTab) {
        currentTab = tab;
        renderTabs();
      }
      selectedPath = nodePath;
      expandAncestors(nodePath);
      loadTree(currentTab);
    } catch (e) {}
  }

  async function initTreeNav() {
    renderTabs();
    await loadTree(currentTab);
    const previewFrame = document.getElementById('preview-frame');
    if (previewFrame) {
      previewFrame.addEventListener('load', () => {
        setTimeout(syncTreeFromIframe, 0);
      });
    }
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
      const isContainer = targetType === 'dir' || targetType === 'page' || targetType === 'component' || targetType === 'flowchart';
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

  const tabLoaded = new Set();

  function expandAll(nodes) {
    for (const node of nodes) {
      if (node.type === 'dir') {
        expandedPaths.add(node.path);
      }
      if (node.children && node.children.length) {
        expandAll(node.children);
      }
    }
  }

  async function loadTree(type) {
    if (type === 'wiki') {
      treeData = [];
      treeRoot.innerHTML = '';
      return;
    }
    try {
      const res = await window.apiClient.getScan(type);
      if (res.code !== 0) return;
      treeData = res.data || [];
      if (!tabLoaded.has(type)) {
        expandAll(treeData);
        tabLoaded.add(type);
      }
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
    } else if (node.type === 'flowchart') {
      icon = createTreeIcon('split-turn-down-right');
    } else if (node.type === 'spec') {
      icon = createTreeIcon('doc-detail');
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
      label.addEventListener('click', async () => {
        if (window.docPanel && window.docPanel.isEditing && window.docPanel.isEditing()) {
          const ok = await window.showConfirm('切换确认', '切换页面后将丢失已编辑的文档，确认继续？');
          if (!ok) return;
        }
        selectedPath = node.path;
        if (node.id) location.hash = '#' + node.id;
        loadTree(currentTab);
        if (window.shell && window.shell.loadPage) {
          window.shell.loadPage(type === 'components' ? 'component' : type === 'flowcharts' ? 'flowchart' : 'page', node.path);
        }
        // clear active rule item highlight
        document.querySelectorAll('.rules-item.active').forEach(el => el.classList.remove('active'));
      });

      label.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showPageContextMenu(e, node, type);
      });
    }

    return li;
  }

  // 新架构下 path 由 hash 组成，需用 id 匹配而非 name
  function getSiblings(parentPath) {
    if (!parentPath) return treeData;
    const parts = parentPath.split('/');
    let nodes = treeData;
    for (const part of parts) {
      const dir = nodes.find(n => n.id === part && (n.type === 'dir' || n.type === 'page' || n.type === 'component' || n.type === 'flowchart'));
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
    if (currentTab === 'wiki') return;
    const pageLabel = currentTab === 'components' ? '新建组件' : currentTab === 'flowcharts' ? '新建流程图' : '新建页面';
    const items = [
      { label: pageLabel, action: 'create_page' },
      { label: '新建目录', action: 'create_folder' }
    ];
    renderMenu(e, items, (action) => {
      if (action === 'create_page') {
        const kind = currentTab === 'components' ? 'component' : currentTab === 'flowcharts' ? 'flowchart' : 'page';
        handleCreate('', kind);
      } else if (action === 'create_folder') {
        handleCreate('', 'folder');
      }
    });
  }

  function showDirContextMenu(e, node, type) {
    if (currentTab === 'wiki') return;
    const pageLabel = type === 'components' ? '新建组件' : type === 'flowcharts' ? '新建流程图' : '新建页面';
    const items = [
      { label: pageLabel, action: 'create_page' },
      { label: '新建目录', action: 'create_folder' },
      { divider: true },
      { label: '复制路径', action: 'copy_path' },
      { label: '重命名', action: 'rename' },
      { divider: true },
      { label: '删除', action: 'delete', danger: true }
    ];
    renderMenu(e, items, (action) => {
      if (action === 'create_page') {
        const kind = type === 'components' ? 'component' : type === 'flowcharts' ? 'flowchart' : 'page';
        handleCreate(node.path, kind);
      } else if (action === 'create_folder') {
        handleCreate(node.path, 'folder');
      } else if (action === 'copy_path') {
        navigator.clipboard.writeText(`prototype/${type}/${node.path}`);
      } else if (action === 'rename') {
        handleRename(node.path, type, true);
      } else if (action === 'delete') {
        handleDelete(node.path, type, true);
      }
    });
  }

  function showPageContextMenu(e, node, type) {
    if (currentTab === 'wiki') return;
    const pageLabel = type === 'components' ? '新建组件' : type === 'flowcharts' ? '新建流程图' : '新建页面';
    const copyLabel = type === 'components' ? '复制组件' : type === 'flowcharts' ? '复制流程图' : '复制页面';
    const deleteLabel = type === 'components' ? '删除组件' : type === 'flowcharts' ? '删除流程图' : '删除页面';
    const propLabel = type === 'components' ? '组件属性' : type === 'flowcharts' ? '流程图属性' : '页面属性';
    const items = [
      { label: pageLabel, action: 'create_page' },
      { label: '新建子目录', action: 'create_subfolder' },
      { label: copyLabel, action: 'copy_page' },
      { divider: true },
      { label: '复制路径', action: 'copy_path' },
      { label: '重命名', action: 'rename' },
      { label: propLabel, action: 'properties' },
      { divider: true },
      { label: deleteLabel, action: 'delete', danger: true }
    ];
    renderMenu(e, items, (action) => {
      if (action === 'create_page') {
        const kind = type === 'components' ? 'component' : type === 'flowcharts' ? 'flowchart' : 'page';
        handleCreate(node.path, kind);
      } else if (action === 'create_subfolder') {
        handleCreate(node.path, 'folder');
      } else if (action === 'copy_page') {
        handleCopy(node.path, type);
      } else if (action === 'copy_path') {
        navigator.clipboard.writeText(`prototype/${type}/${node.path}`);
      } else if (action === 'rename') {
        handleRename(node.path, type, false);
      } else if (action === 'properties') {
        showNodeProperties(node, type);
      } else if (action === 'delete') {
        const hasChildren = node.children && node.children.length > 0;
        handleDelete(node.path, type, hasChildren);
      }
    });
  }

  function showNodeProperties(node, type) {
    let modal = document.getElementById('axhost-node-properties-modal');
    const isPage = type === 'pages';
    const labelMap = { default: '默认页面', mobile: '手机页面', 'mini-program': '小程序' };
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'axhost-node-properties-modal';
      modal.className = 'add-doc-modal';
      modal.innerHTML = `
        <div class="add-doc-modal-overlay"></div>
        <div class="add-doc-modal-content" style="width:360px;">
          <h4 id="prop-modal-title">属性</h4>
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">名称</label>
            <div id="prop-modal-name" style="font-size:14px;color:var(--text-main);padding:8px 10px;background:var(--bg-body);border-radius:4px;border:1px solid var(--border-color);"></div>
          </div>
          <div id="prop-modal-type-wrap" style="margin-bottom:12px;display:none;">
            <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">页面类型</label>
            <div style="position:relative;">
              <button id="prop-modal-type-trigger" style="width:100%;text-align:left;padding:6px 10px;font-size:14px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-body);color:var(--text-main);cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                <span id="prop-modal-type-label">默认页面</span>
                <iconpark-icon icon-id="down" size="12" color="var(--text-muted)"></iconpark-icon>
              </button>
              <div id="prop-modal-type-dropdown" class="editor-dropdown" style="width:100%;top:calc(100% + 4px);left:0;" data-selected-value="default">
                <div class="editor-dropdown-item" data-value="default">默认页面</div>
                <div class="editor-dropdown-item" data-value="mobile">手机页面</div>
                <div class="editor-dropdown-item" data-value="mini-program">小程序</div>
              </div>
            </div>
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">项目内位置</label>
            <div id="prop-modal-path" style="font-size:13px;color:var(--text-main);padding:8px 10px;background:var(--bg-body);border-radius:4px;border:1px solid var(--border-color);font-family:monospace;word-break:break-all;"></div>
          </div>
          <div class="add-doc-modal-actions">
            <button class="prop-modal-save primary" style="display:none;">保存</button>
            <button class="prop-modal-close">关闭</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('.prop-modal-close').addEventListener('click', () => {
        modal.classList.remove('open');
      });
      modal.querySelector('.add-doc-modal-overlay').addEventListener('click', () => {
        modal.classList.remove('open');
      });

      const trigger = modal.querySelector('#prop-modal-type-trigger');
      const dropdown = modal.querySelector('#prop-modal-type-dropdown');
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
      dropdown.querySelectorAll('.editor-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          modal.querySelector('#prop-modal-type-label').textContent = item.textContent;
          dropdown.dataset.selectedValue = item.dataset.value;
          dropdown.classList.remove('open');
        });
      });
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
          dropdown.classList.remove('open');
        }
      });
    }
    const titleMap = { pages: '页面属性', components: '组件属性', flowcharts: '流程图属性' };
    modal.querySelector('#prop-modal-title').textContent = titleMap[type] || '属性';
    modal.querySelector('#prop-modal-name').textContent = node.name || '';
    modal.querySelector('#prop-modal-path').textContent = `prototype/${type}/${node.path}`;

    const typeWrap = modal.querySelector('#prop-modal-type-wrap');
    const dropdown = modal.querySelector('#prop-modal-type-dropdown');
    const saveBtn = modal.querySelector('.prop-modal-save');
    if (isPage) {
      typeWrap.style.display = 'block';
      saveBtn.style.display = 'inline-block';
      const currentVal = node.page_type || 'default';
      modal.querySelector('#prop-modal-type-label').textContent = labelMap[currentVal];
      dropdown.dataset.selectedValue = currentVal;
      saveBtn.onclick = async () => {
        const newType = dropdown.dataset.selectedValue || 'default';
        try {
          await window.apiClient.postPageType({
            path: `prototype/${type}/${node.path}`,
            pageType: newType
          });
          node.page_type = newType;
          modal.classList.remove('open');
          window.showToast('保存成功', 'success');
        } catch (e) {
          window.showToast('保存失败：' + e.message, 'error');
        }
      };
    } else {
      typeWrap.style.display = 'none';
      saveBtn.style.display = 'none';
      dropdown.classList.remove('open');
    }

    modal.classList.add('open');
  }

  function renderMenu(event, items, onSelect) {
    removeExistingMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    items.forEach(item => {
      if (item.divider) {
        const hr = document.createElement('div');
        hr.className = 'context-menu-divider';
        menu.appendChild(hr);
        return;
      }
      const div = document.createElement('div');
      div.className = 'context-menu-item' + (item.danger ? ' danger' : '');
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

  async function showCreatePagePrompt(title) {
    return new Promise((resolve) => {
      let modal = document.getElementById('axhost-create-page-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'axhost-create-page-modal';
        modal.className = 'add-doc-modal';
        modal.innerHTML = `
          <div class="add-doc-modal-overlay"></div>
          <div class="add-doc-modal-content">
            <h4>${title}</h4>
            <div class="page-type-cards">
              <div class="page-type-card active" data-value="default">
                <div class="page-type-icon"><iconpark-icon icon-id="browser" size="24"></iconpark-icon></div>
                <span>默认页面</span>
              </div>
              <div class="page-type-card" data-value="mobile">
                <div class="page-type-icon"><iconpark-icon icon-id="iphone" size="24"></iconpark-icon></div>
                <span>手机页面</span>
              </div>
              <div class="page-type-card" data-value="mini-program">
                <div class="page-type-icon"><iconpark-icon icon-id="wechat" size="24"></iconpark-icon></div>
                <span>小程序</span>
              </div>
            </div>
            <input type="text" class="create-page-name-input" placeholder="请输入页面名称">
            <div class="add-doc-modal-actions">
              <button class="create-page-cancel">取消</button>
              <button class="create-page-confirm primary">确认</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }
      modal.querySelector('h4').textContent = title || '新建页面';
      const input = modal.querySelector('.create-page-name-input');
      input.value = '';
      const cards = modal.querySelectorAll('.page-type-card');
      cards.forEach(c => {
        c.classList.toggle('active', c.dataset.value === 'default');
        c.onclick = () => {
          cards.forEach(x => x.classList.remove('active'));
          c.classList.add('active');
        };
      });
      modal.classList.add('open');
      setTimeout(() => input.focus(), 0);

      const btnOk = modal.querySelector('.create-page-confirm');
      const btnCancel = modal.querySelector('.create-page-cancel');
      const overlay = modal.querySelector('.add-doc-modal-overlay');

      function cleanup() {
        modal.classList.remove('open');
        btnOk.onclick = null;
        btnCancel.onclick = null;
        overlay.onclick = null;
        input.onkeydown = null;
        cards.forEach(c => c.onclick = null);
      }

      function submit() {
        const name = input.value.trim();
        if (!name) {
          window.showToast('名称不能为空', 'error');
          return;
        }
        const selected = modal.querySelector('.page-type-card.active');
        cleanup();
        resolve({ name, template: selected ? selected.dataset.value : 'default' });
      }

      function cancel() {
        cleanup();
        resolve(null);
      }

      btnOk.onclick = submit;
      btnCancel.onclick = cancel;
      overlay.onclick = cancel;
      input.onkeydown = (e) => {
        if (e.key === 'Enter') submit();
        else if (e.key === 'Escape') cancel();
      };
    });
  }

  async function handleCreate(parentPath, kind) {
    const labelMap = { page: '页面', component: '组件', flowchart: '流程图', folder: '目录' };
    let name, template = 'default';
    if (kind === 'page') {
      const result = await showCreatePagePrompt('请输入页面名称');
      if (!result) return;
      name = result.name;
      template = result.template;
    } else {
      name = await window.showPrompt(`请输入${labelMap[kind]}名称`);
      if (!name) return;
    }
    if (!name.trim()) {
      window.showToast('名称不能为空', 'error');
      return;
    }
    if (hasSiblingName(parentPath, name)) {
      window.showToast(`同级下已存在名为 "${name}" 的目录或页面`, 'error');
      return;
    }
    try {
      const parent = `prototype/${currentTab}${parentPath ? '/' + parentPath : ''}`;
      await window.apiClient.postCreate({ parentPath: parent, name, kind, template });
      if (parentPath) {
        expandedPaths.add(parentPath);
      }
      await loadTree(currentTab);
      window.showToast(kind === 'folder' ? '目录创建成功' : (kind === 'component' ? '组件创建成功' : kind === 'flowchart' ? '流程图创建成功' : '页面创建成功'), 'success');
    } catch (err) {
      console.error('Create error:', err);
      window.showToast('创建失败: ' + err.message, 'error');
    }
  }

  async function handleRename(nodePath, type, isDir) {
    const nodeName = nodePath.split('/').pop();
    // 需要通过 id 找到显示名称 —— 简单做法：从 treeData 中查找
    let displayName = nodeName;
    function findNodeByPath(nodes, targetPath) {
      for (const n of nodes) {
        if (n.path === targetPath) return n;
        if (n.children) {
          const f = findNodeByPath(n.children, targetPath);
          if (f) return f;
        }
      }
      return null;
    }
    const node = findNodeByPath(treeData, nodePath);
    if (node) displayName = node.name;

    const newName = await window.showPrompt('请输入新名称', '', displayName);
    if (!newName || newName === displayName) return;
    if (!newName.trim()) {
      window.showToast('名称不能为空', 'error');
      return;
    }
    const parentId = node ? (node.parentId || '') : '';
    if (hasSiblingName(parentId, newName)) {
      window.showToast(`同级下已存在名为 "${newName}" 的目录或页面`, 'error');
      return;
    }
    try {
      const oldAbs = `prototype/${currentTab}/${nodePath}`;
      await window.apiClient.postRename({ path: oldAbs, newName });
      await loadTree(currentTab);
      window.showToast('重命名成功', 'success');
      // 新架构下目录名（hash）不变，path 也不变，无需更新 selectedPath
    } catch (err) {
      console.error('Rename error:', err);
      window.showToast('重命名失败: ' + err.message, 'error');
    }
  }

  async function handleCopy(nodePath, type) {
    try {
      const result = await window.apiClient.postCopy({ sourcePath: nodePath, type });
      await loadTree(currentTab);
      window.showToast('复制成功', 'success');
      if (result && result.data && result.data.id) {
        location.hash = '#' + result.data.id;
      }
    } catch (err) {
      console.error('Copy error:', err);
      window.showToast('复制失败: ' + err.message, 'error');
    }
  }

  async function handleDelete(nodePath, type, hasChildren) {
    // 通过 id 找到显示名称
    let displayName = nodePath.split('/').pop();
    function findNodeByPath(nodes, targetPath) {
      for (const n of nodes) {
        if (n.path === targetPath) return n;
        if (n.children) {
          const f = findNodeByPath(n.children, targetPath);
          if (f) return f;
        }
      }
      return null;
    }
    const node = findNodeByPath(treeData, nodePath);
    if (node) displayName = node.name;

    const msg = hasChildren
      ? `是否删除 "${displayName}" 及其下的所有页面/组件？`
      : `是否删除${type === 'components' ? '组件' : type === 'flowcharts' ? '流程图' : '页面'} "${displayName}"？`;
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
    const tab = type === 'component' ? 'components' : type === 'flowchart' ? 'flowcharts' : 'pages';
    if (currentTab !== tab) {
      currentTab = tab;
      renderTabs();
    }
    const isSamePage = selectedPath === node.path;
    selectedPath = node.path;
    expandAncestors(node.path);
    loadTree(currentTab);
    if (isSamePage) return;
    if (window.shell && window.shell.loadPage) {
      window.shell.loadPage(type, node.path);
    }
  });

  window.treeNav = { init: initTreeNav, refresh: () => loadTree(currentTab) };
})();
