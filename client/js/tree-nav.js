(function () {
  const treeRoot = document.getElementById('tree-root');
  let currentTab = 'pages';
  let expandedPaths = new Set();
  let selectedPath = null;
  let treeData = [];
  let hasAutoLoaded = false;
  let draggedItem = null;
  let draggedParentUl = null;

  // 拖拽插入指示
  const INDENT = 16;   // 每级缩进像素，与 buildNode 的 level*16 对应
  const BASE_PAD = 8;  // tree-label 的基础 padding-left
  let dropIndicator = null;
  let currentDrop = null;

  // 收集当前可见的节点行（前序排列），排除被拖拽节点及其子树
  function collectVisibleRows() {
    const rows = [];
    const items = treeRoot.querySelectorAll('.tree-item');
    items.forEach(li => {
      if (draggedItem && (li === draggedItem || draggedItem.contains(li))) return;
      const label = li.querySelector(':scope > .tree-label');
      if (!label) return;
      const rect = label.getBoundingClientRect();
      rows.push({
        li,
        id: li.dataset.id,
        parentId: li.dataset.parentId || '',
        depth: parseInt(li.dataset.level, 10) || 0,
        top: rect.top,
        bottom: rect.bottom,
        mid: rect.top + rect.height / 2
      });
    });
    return rows;
  }

  // 根据鼠标位置计算落点：{ parentId, anchorId, depth, top }
  function computeDrop(clientX, clientY) {
    const rows = collectVisibleRows();
    if (rows.length === 0) return null;
    const rowById = {};
    rows.forEach(r => { rowById[r.id] = r; });

    // 插入索引 i：落在 rows[i-1] 与 rows[i] 之间
    let i = 0;
    for (const r of rows) {
      if (clientY > r.mid) i++; else break;
    }
    const prev = rows[i - 1] || null;
    const next = rows[i] || null;

    // 该间隙允许的层级范围
    const maxDepth = prev ? prev.depth + 1 : 0;
    const minDepth = next ? next.depth : 0;

    // 由鼠标横向位置选择目标层级（向右更深、向左更浅）
    const rootRect = treeRoot.getBoundingClientRect();
    let desired = Math.round((clientX - rootRect.left - BASE_PAD) / INDENT);
    const depth = Math.max(minDepth, Math.min(maxDepth, desired));

    function ancestorAtDepth(row, d) {
      let cur = row;
      while (cur && cur.depth > d) cur = rowById[cur.parentId];
      return cur || null;
    }

    let parentId = '';
    let anchorId = '';
    if (depth > 0) {
      const parentRow = prev ? ancestorAtDepth(prev, depth - 1) : null;
      parentId = parentRow ? parentRow.id : '';
      // 锚点：插入到该层级已有分支之后；若 prev 正是父级则作为首个子级
      if (prev && prev.depth >= depth) {
        const anchorRow = ancestorAtDepth(prev, depth);
        anchorId = anchorRow ? anchorRow.id : '';
      } else {
        anchorId = '';
      }
    } else {
      // 顶级
      parentId = '';
      anchorId = prev ? (ancestorAtDepth(prev, 0) || {}).id || '' : '';
    }

    // 指示线纵向位置
    const lineY = prev ? prev.bottom : (next ? next.top : rootRect.top);

    return { parentId, anchorId, depth, top: lineY };
  }

  function ensureDropIndicator() {
    if (dropIndicator && dropIndicator.isConnected) return dropIndicator;
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'tree-drop-line';
    treeRoot.appendChild(dropIndicator);
    return dropIndicator;
  }

  function renderDropIndicator(drop) {
    const line = ensureDropIndicator();
    const rootRect = treeRoot.getBoundingClientRect();
    const top = drop.top - rootRect.top + treeRoot.scrollTop;
    line.style.top = top + 'px';
    line.style.left = (BASE_PAD + drop.depth * INDENT) + 'px';
    line.style.display = 'block';

    // 高亮目标父级行
    treeRoot.querySelectorAll('.tree-item.drop-parent').forEach(el => el.classList.remove('drop-parent'));
    if (drop.parentId) {
      const parentLi = treeRoot.querySelector('.tree-item[data-id="' + drop.parentId + '"]');
      if (parentLi) parentLi.classList.add('drop-parent');
    }
  }

  function clearDropIndicator() {
    currentDrop = null;
    if (dropIndicator) dropIndicator.style.display = 'none';
    treeRoot.querySelectorAll('.tree-item.drop-parent').forEach(el => el.classList.remove('drop-parent'));
  }


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

    // 拖拽排序 / 移动 —— 采用「缩进插入线」模型：
    // 插入线的左缩进表示移动后的层级（全宽=顶级，每内缩一个 tab=深一级）。
    treeRoot.addEventListener('dragover', (e) => {
      if (!draggedItem) return;
      e.preventDefault();
      const drop = computeDrop(e.clientX, e.clientY);
      if (!drop) {
        clearDropIndicator();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
        return;
      }
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      currentDrop = drop;
      renderDropIndicator(drop);
    });

    treeRoot.addEventListener('dragleave', (e) => {
      // 只有真正离开 treeRoot 时才清除，避免在子元素间移动时闪烁
      if (e.relatedTarget && treeRoot.contains(e.relatedTarget)) return;
      clearDropIndicator();
    });

    treeRoot.addEventListener('drop', async (e) => {
      e.preventDefault();
      const drop = currentDrop;
      clearDropIndicator();
      if (!draggedItem || !drop) return;

      const sourcePath = draggedItem.dataset.path;
      try {
        await window.apiClient.postMove({
          type: currentTab,
          sourcePath,
          parentPath: drop.parentId,
          anchorPath: drop.anchorId
        });
        if (drop.parentId) expandedPaths.add(drop.parentId);
        window.showToast('移动成功', 'success');
        await loadTree(currentTab);
      } catch (err) {
        console.error('Tree drag/drop error:', err);
        window.showToast((err && err.message) || '操作失败', 'error');
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
      if (node.children && node.children.length) {
        expandedPaths.add(node.path);
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
            window.shell.loadPage(getNodeTypeForTab(target), target.path, target.name);
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
    li.dataset.id = node.id;
    li.dataset.parentId = node.parentId || '';
    li.dataset.level = level;

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
      const arrowIcon = document.createElement('iconpark-icon');
      arrowIcon.setAttribute('icon-id', expandedPaths.has(node.path) ? 'down' : 'right');
      arrowIcon.setAttribute('size', '12');
      arrowIcon.setAttribute('color', 'currentColor');
      arrowIcon.setAttribute('stroke', 'currentColor');
      arrowIcon.setAttribute('fill', 'currentColor');
      arrow.appendChild(arrowIcon);
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
      var pageType = node.page_type || 'default';
      icon = createTreeIcon(pageType === 'mobile' ? 'iphone' : pageType === 'mini-program' ? 'wechat' : 'page');
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
      clearDropIndicator();
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

      const iconEl = label.querySelector(':scope > iconpark-icon');
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
          window.shell.loadPage(type === 'components' ? 'component' : type === 'flowcharts' ? 'flowchart' : 'page', node.path, node.name);
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

  async function showExportComponentModal(node) {
    let projectList = [];
    let selectedProjectId = null;

    // Scan component index.html for external resource references
    var externalRefs = [];
    try {
      var content = await window.apiClient.getFile('prototype/components/' + node.path + '/index.html');
      if (content && typeof content === 'string') {
        var matches = content.match(/["'(]\.\.\/\.\.\/resources\/[^"') ]+/g);
        if (matches) {
          var seen = {};
          matches.forEach(function(m) {
            var ref = m.replace(/^["'(]/, '');
            if (!seen[ref]) { seen[ref] = true; externalRefs.push(ref); }
          });
        }
      }
    } catch (e) { /* ignore, show generic warning */ }

    var warningHtml;
    if (externalRefs.length > 0) {
      warningHtml = '<div style="font-size:12px;background:var(--bg-hover);padding:8px 10px;border-radius:4px;line-height:1.6;">' +
        '<div style="color:var(--text-main);font-weight:600;margin-bottom:4px;">该组件引用以下全局资源：</div>' +
        externalRefs.map(function(r) { return '<div style="color:var(--text-muted);padding-left:8px;">• ' + r.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>'; }).join('') +
        '<div style="color:var(--text-muted);margin-top:6px;border-top:1px solid var(--border);padding-top:6px;">导出后请在目标项目中检查适配。</div>' +
        '</div>';
    } else {
      warningHtml = '<div style="font-size:12px;color:var(--text-muted);background:var(--bg-hover);padding:8px 10px;border-radius:4px;line-height:1.5;">未检测到项目级全局资源引用，导出后可直接使用。</div>';
    }

    var modal = new AxhostModal({
      title: '导出组件 — ' + (node.name || ''),
      width: '400px',
      confirmText: '导出',
      body: function(container) {
        container.innerHTML =
          '<label>目标项目</label>' +
          '<div style="position:relative;margin-bottom:12px;">' +
            '<input type="text" id="export-modal-project" placeholder="搜索或选择项目..." autocomplete="off" style="width:100%;padding:6px 10px;font-size:13px;border-radius:4px;border:1px solid var(--border);background:var(--bg-body);color:var(--text-main);">' +
            '<div id="export-modal-project-dropdown" class="host-project-dropdown" style="top:100%;left:0;right:0;"></div>' +
          '</div>' +
          '<label>导出文档</label>' +
          '<div id="export-modal-docs" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px 8px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-body);margin-bottom:12px;"></div>' +
          warningHtml;
      },
      onConfirm: function() {
        var targetProjectId = selectedProjectId;
        if (!targetProjectId) { window.showToast('请选择有效的目标项目', 'error'); throw new Error(); }
        var docsDiv = modal.getBody().querySelector('#export-modal-docs');
        var checkedDocs = [];
        docsDiv.querySelectorAll('input[type="checkbox"]:checked').forEach(function(cb) { checkedDocs.push(cb.value); });
        if (checkedDocs.length === 0) { window.showToast('请至少选择一个文档', 'error'); throw new Error(); }
        return window.apiClient.postExportComponent({
          sourceProjectId: window.__axhostProjectId,
          targetProjectId: targetProjectId,
          componentPath: node.path,
          selectedDocs: checkedDocs
        }).then(function(result) {
          if (result.code !== 0) {
            window.showToast('导出失败：' + (result.message || '未知错误'), 'error');
            throw new Error();
          }
          window.showToast('导出成功', 'success');
        }).catch(function(e) {
          if (e.message && e.message.indexOf('导出失败') !== -1) throw e;
          window.showToast('导出失败：' + e.message, 'error');
          throw e;
        });
      }
    });

    // Set up project search after modal is created
    var body = modal.getBody();
    var projectInput = body.querySelector('#export-modal-project');
    var projectDropdown = body.querySelector('#export-modal-project-dropdown');

    function renderProjectDropdown(keyword) {
      projectDropdown.innerHTML = '';
      var kw = (keyword || '').toLowerCase();
      var filtered = kw ? projectList.filter(function(p) { return p.name.toLowerCase().indexOf(kw) !== -1; }) : projectList;
      if (filtered.length === 0) {
        projectDropdown.innerHTML = '<div class="host-project-dropdown-empty">无匹配项目</div>';
      } else {
        filtered.forEach(function(p) {
          var div = document.createElement('div');
          div.className = 'host-project-dropdown-item';
          div.textContent = p.name;
          div.addEventListener('click', function() {
            projectInput.value = p.name;
            selectedProjectId = p.id;
            projectDropdown.classList.remove('open');
          });
          projectDropdown.appendChild(div);
        });
      }
      projectDropdown.classList.add('open');
    }

    projectInput.addEventListener('input', function() {
      selectedProjectId = null;
      renderProjectDropdown(this.value);
    });
    projectInput.addEventListener('focus', function() {
      if (projectList.length > 0 && !projectDropdown.classList.contains('open')) {
        renderProjectDropdown(this.value);
      }
    });
    projectInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { projectDropdown.classList.remove('open'); return; }
      if (e.key === 'Enter') {
        var items = projectDropdown.querySelectorAll('.host-project-dropdown-item');
        var activeItem = projectDropdown.querySelector('.host-project-dropdown-item.active');
        if (activeItem) { activeItem.click(); e.preventDefault(); }
        else if (items.length === 1) { items[0].click(); e.preventDefault(); }
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      var items = projectDropdown.querySelectorAll('.host-project-dropdown-item');
      if (items.length === 0) return;
      var activeItem = projectDropdown.querySelector('.host-project-dropdown-item.active');
      var idx = -1;
      if (activeItem) {
        activeItem.classList.remove('active');
        idx = Array.prototype.indexOf.call(items, activeItem);
      }
      if (e.key === 'ArrowDown') idx = (idx + 1) % items.length;
      else idx = (idx - 1 + items.length) % items.length;
      items[idx].classList.add('active');
    });

    function closeExportDropdown(e) {
      if (!projectDropdown.classList.contains('open')) return;
      if (!projectDropdown.contains(e.target) && e.target !== projectInput) {
        projectDropdown.classList.remove('open');
      }
    }
    document.addEventListener('click', closeExportDropdown);

    // Fetch projects
    fetch('/api/projects')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.code !== 0) throw new Error(data.message);
        var all = data.data || [];
        var currentId = window.__axhostProjectId;
        projectList = [];
        all.forEach(function(p) {
          if (p.id !== currentId) projectList.push({ id: p.id, name: p.name || p.id });
        });
        if (projectList.length === 0) {
          projectInput.placeholder = '无其他项目可导出';
          projectInput.disabled = true;
        }
      })
      .catch(function() { projectInput.placeholder = '加载失败'; });

    // Docs
    var docsDiv = body.querySelector('#export-modal-docs');
    var docs = node.docs || ['readme.md'];
    docs.forEach(function(doc) {
      var label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = doc;
      cb.checked = true;
      if (doc === 'readme.md') cb.disabled = true;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(doc));
      docsDiv.appendChild(label);
    });

    modal.open();
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
      ...(type === 'components' ? [{ label: '导出到项目', action: 'export_to_project' }] : []),
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
      } else if (action === 'export_to_project') {
        showExportComponentModal(node, type);
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

  let nodePropsModal = null;
  let nodePropsModalNode = null;
  let nodePropsModalType = null;

  function showNodeProperties(node, type) {
    var isPage = type === 'pages';

    if (!nodePropsModal) {
      nodePropsModal = new AxhostModal({
        title: '',
        width: '360px',
        hideConfirm: true,
        hideCancel: true,
        header: function(container) {
          container.innerHTML =
            '<span id="prop-modal-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;margin-right:8px;font-size:18px;font-weight:600;"></span>' +
            '<span id="prop-modal-path-tag" style="flex-shrink:0;font-size:11px;color:var(--text-muted);background:var(--bg-body);border:1px solid var(--border);padding:2px 8px;border-radius:4px;font-family:Consolas,monospace;"></span>';
        },
        body: function(container) {
          container.innerHTML =
            '<label>页面类型</label>' +
            '<div class="page-type-cards">' +
              '<div class="page-type-card" data-value="default">' +
                '<div class="page-type-icon"><iconpark-icon icon-id="browser" size="24"></iconpark-icon></div>' +
                '<span>默认页面</span>' +
              '</div>' +
              '<div class="page-type-card" data-value="mobile">' +
                '<div class="page-type-icon"><iconpark-icon icon-id="iphone" size="24"></iconpark-icon></div>' +
                '<span>手机页面</span>' +
              '</div>' +
              '<div class="page-type-card" data-value="mini-program">' +
                '<div class="page-type-icon"><iconpark-icon icon-id="wechat" size="24"></iconpark-icon></div>' +
                '<span>小程序</span>' +
              '</div>' +
            '</div>';
        },
        footer: function(container) {
          container.innerHTML =
            '<button class="axhost-modal-btn prop-modal-close">关闭</button>' +
            '<button class="axhost-modal-btn axhost-modal-btn-primary prop-modal-save" style="display:none;">保存</button>';
          container.querySelector('.prop-modal-close').addEventListener('click', function() {
            nodePropsModal.close();
          });
        }
      });
    }

    nodePropsModalNode = node;
    nodePropsModalType = type;

    var el = nodePropsModal.getElement();

    // Header: page name (truncatable) + path tag
    el.querySelector('#prop-modal-title').textContent = node.name || '';
    var pathTag = el.querySelector('#prop-modal-path-tag');
    if (isPage) {
      pathTag.textContent = 'pages/' + node.path;
    pathTag.style.display = '';
    pathTag.style.cursor = 'pointer';
    pathTag.title = '点击复制ID';
    pathTag.onclick = async function() {
      var id = node.path;
      try {
        await navigator.clipboard.writeText(id);
        window.showToast('项目ID已复制', 'success');
      } catch (err) {
        var ta = document.createElement('textarea');
        ta.value = id;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        window.showToast(ok ? '项目ID已复制' : '项目ID复制失败', ok ? 'success' : 'error');
      }
    };
    } else {
      pathTag.style.display = 'none';
    }

    // Body: type cards (pages only)
    var body = nodePropsModal.getBody();
    var typeCardsWrap = body.querySelector('.page-type-cards');
    var saveBtn = el.querySelector('.prop-modal-save');

    if (isPage) {
      typeCardsWrap.style.display = '';
      saveBtn.style.display = 'inline-block';

      var cards = typeCardsWrap.querySelectorAll('.page-type-card');
      var currentVal = node.page_type || 'default';
      cards.forEach(function(c) {
        c.classList.toggle('active', c.dataset.value === currentVal);
      });

      saveBtn.onclick = async function() {
        var activeCard = typeCardsWrap.querySelector('.page-type-card.active');
        var newType = activeCard ? activeCard.dataset.value : 'default';
        try {
          await window.apiClient.postPageType({
            path: 'prototype/' + nodePropsModalType + '/' + nodePropsModalNode.path,
            pageType: newType
          });
          nodePropsModalNode.page_type = newType;
          nodePropsModal.close();
          loadTree(nodePropsModalType);
          window.showToast('保存成功', 'success');
        } catch (e) {
          window.showToast('保存失败：' + e.message, 'error');
        }
      };

      // Card click toggles active
      cards.forEach(function(c) {
        c.onclick = function() {
          cards.forEach(function(x) { x.classList.remove('active'); });
          c.classList.add('active');
        };
      });
    } else {
      typeCardsWrap.style.display = 'none';
      saveBtn.style.display = 'none';
    }

    nodePropsModal.open();
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
    const menuHeight = menu.offsetHeight;
    const viewportH = window.innerHeight;
    if (event.clientY + menuHeight > viewportH) {
      menu.style.top = Math.max(0, event.clientY - menuHeight) + 'px';
    }
    setTimeout(() => {
      document.addEventListener('click', removeExistingMenu, { once: true });
    }, 0);
  }

  function removeExistingMenu() {
    document.querySelectorAll('.context-menu').forEach(el => el.remove());
  }

  function _createTypeSelectPrompt(title, typeCards, placeholder, extraBody, collectExtra) {
    return new Promise(function(resolve) {
      var submitted = false;
      var modal = new AxhostModal({
        title: title,
        body: function(container) {
          var cardsHtml = '';
          typeCards.forEach(function(c, i) {
            cardsHtml += '<div class="page-type-card' + (i === 0 ? ' active' : '') + '" data-value="' + c.value + '">' +
              '<div class="page-type-icon"><iconpark-icon icon-id="' + c.icon + '" size="24"></iconpark-icon></div>' +
              '<span>' + c.label + '</span></div>';
          });
          container.innerHTML =
            '<div class="page-type-cards">' + cardsHtml + '</div>' +
            '<input type="text" class="axhost-modal-input create-page-name-input" placeholder="' + placeholder + '" style="margin-top:12px;">' +
            (extraBody || '');

          container.querySelectorAll('.page-type-cards, [data-select-group]').forEach(function(group) {
            var items = group.querySelectorAll('.page-type-card, .theme-chip');
            group.addEventListener('click', function(e) {
              var chip = e.target.closest('.page-type-card, .theme-chip');
              if (!chip) return;
              items.forEach(function(x) { x.classList.remove('active'); });
              chip.classList.add('active');
            });
          });
        },
        confirmText: '确认',
        onConfirm: function() {
          var input = modal.getBody().querySelector('.create-page-name-input');
          var name = input.value.trim();
          if (!name) { window.showToast('名称不能为空', 'error'); throw new Error(); }
          var selected = modal.getBody().querySelector('.page-type-card.active');
          var extra = collectExtra ? collectExtra(modal.getBody()) : {};
          submitted = true;
          resolve(Object.assign({ name: name, template: selected ? selected.dataset.value : 'default' }, extra));
        },
        onCancel: function() { if (!submitted) resolve(null); },
        onClose: function() { if (!submitted) resolve(null); }
      });
      modal.open();
      var input = modal.getBody().querySelector('.create-page-name-input');
      if (input) {
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') { e.preventDefault(); modal._handleConfirm(); }
        });
      }
    });
  }

  function showCreatePagePrompt(title) {
    return _createTypeSelectPrompt(title || '新建页面', [
      { value: 'default', icon: 'browser', label: '默认页面' },
      { value: 'mobile', icon: 'iphone', label: '手机页面' },
      { value: 'mini-program', icon: 'wechat', label: '小程序' }
    ], '请输入页面名称');
  }

  function showCreateComponentPrompt(title) {
    return _createTypeSelectPrompt(title || '新建组件', [
      { value: 'default', icon: 'browser', label: '默认页面' },
      { value: 'mobile', icon: 'iphone', label: '手机页面' }
    ], '请输入组件名称',
    '<style>.theme-chip{display:flex;align-items:center;gap:4px;padding:6px 10px;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:13px;flex:1;justify-content:center;}.theme-chip.active{border-color:var(--accent,#4a9eff);background:#e7f4ff;}</style>' +
      '<div style="margin-top:12px;">' +
      '<label style="font-size:13px;color:var(--text-secondary);display:block;margin-bottom:6px;">页面主题</label>' +
      '<div id="theme-select-group" data-select-group style="display:flex;gap:8px;">' +
        '<div class="theme-chip active" data-value="light">' +
          '<iconpark-icon icon-id="dome-light" size="14"></iconpark-icon>' +
          '<span>明亮</span>' +
        '</div>' +
        '<div class="theme-chip" data-value="dark">' +
          '<iconpark-icon icon-id="moon" size="14"></iconpark-icon>' +
          '<span>暗黑</span>' +
        '</div>' +
      '</div>' +
    '</div>',
    function(body) {
      var active = body.querySelector('#theme-select-group .theme-chip.active');
      return { theme: active ? active.dataset.value : 'light' };
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
    } else if (kind === 'component') {
      const result = await showCreateComponentPrompt('请输入组件名称');
      if (!result) return;
      name = result.name;
      template = result.template;
      var theme = result.theme || 'light';
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
      await window.apiClient.postCreate({ parentPath: parent, name, kind, template, theme: theme || 'light' });
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
    // Find display name for default value
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

    const labelMap = { pages: '页面', components: '组件', flowcharts: '流程图' };
    const defaultName = displayName + '-副本';
    const newName = await window.showPrompt('复制' + (labelMap[type] || ''), '请输入新名称', defaultName);
    if (!newName || !newName.trim()) return;

    try {
      const result = await window.apiClient.postCopy({ sourcePath: nodePath, type, newName: newName.trim() });
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
