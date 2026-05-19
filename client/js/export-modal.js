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
  const tabButtons = modal.querySelectorAll('.export-right-panel .export-tabs button');
  const modeTabButtons = modal.querySelectorAll('.export-mode-tabs button');
  const localContent = document.getElementById('export-local-content');
  const remoteContent = document.getElementById('export-remote-content');

  // Remote project elements
  const hostProjectWrap = document.getElementById('export-host-project-wrap');
  const hostProjectSearch = document.getElementById('export-host-project-search');
  const hostProjectDropdown = document.getElementById('export-host-project-dropdown');
  const hostProjectLinked = document.getElementById('export-host-project-linked');
  const hostProjectLinkedName = document.getElementById('export-host-project-linked-name');
  const btnUnlinkProject = document.getElementById('export-btn-unlink-project');
  const btnCreateRemoteProject = document.getElementById('export-btn-create-remote-project');
  const hostProjectHint = document.getElementById('export-host-project-hint');
  const exportPreviewUrlField = document.getElementById('export-preview-url-field');
  const exportPreviewUrl = document.getElementById('export-preview-url');

  let currentTab = 'pages';
  let currentMode = 'local';
  let treeData = { pages: [], components: [], flowcharts: [] };
  let expandedPaths = new Set();
  let checkedPaths = new Set();
  let selectAll = true;
  let defaultDir = '';
  let hostProjectList = [];
  let selectedHostProject = null;
  let currentSettingsLink = null;

  // Open / Close
  function open() {
    treeData = { pages: [], components: [] };
    expandedPaths = new Set();
    checkedPaths = new Set();
    selectAll = true;
    if (selectAllCheckbox) selectAllCheckbox.checked = true;
    treeContainer.classList.add('all-selected');
    loadDefaultInfo();
    loadTree(currentTab).then(() => {
      const tabs = ['pages', 'components', 'flowcharts'];
      for (const t of tabs) {
        if (t !== currentTab) preloadTree(t);
      }
    });
    modal.classList.add('open');
  }
  function close() {
    modal.classList.remove('open');
    hostProjectDropdown.classList.remove('open');
  }

  btnExport.addEventListener('click', open);
  btnClose.addEventListener('click', close);
  btnCancel.addEventListener('click', close);

  // Load default project name and dir
  async function loadDefaultInfo() {
    try {
      const res = await window.apiClient.getSettings();
      if (res.code === 0) {
        projectNameInput.value = res.data.name || '';
        currentSettingsLink = res.data.link || null;
        renderHostProjectState();
      }
    } catch (e) {}

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

  // Mode tabs
  modeTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      modeTabButtons.forEach(b => b.classList.toggle('active', b === btn));
      if (currentMode === 'local') {
        localContent.classList.remove('hidden');
        remoteContent.classList.add('hidden');
        btnConfirm.textContent = '导出';
      } else {
        localContent.classList.add('hidden');
        remoteContent.classList.remove('hidden');
        btnConfirm.textContent = '发布';
      }
    });
  });

  // Tabs (pages / components)
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
    const targetType = type === 'pages' ? 'page' : type === 'components' ? 'component' : 'flowchart';
    if (treeData[type] && treeData[type].length > 0) {
      if (selectAll) {
        collectAllPaths(treeData[type], targetType, checkedPaths);
      }
      renderTree(type);
      return;
    }
    try {
      const res = await window.apiClient.getScan(type);
      if (res.code === 0) {
        treeData[type] = res.data || [];
        if (selectAll) {
          collectAllPaths(treeData[type], targetType, checkedPaths);
        }
        renderTree(type);
      }
    } catch (err) {
      treeContainer.innerHTML = '<div style="padding:12px;color:#999">加载失败</div>';
    }
  }

  async function preloadTree(type) {
    const targetType = type === 'pages' ? 'page' : type === 'components' ? 'component' : 'flowchart';
    if (treeData[type] && treeData[type].length > 0) {
      if (selectAll) {
        collectAllPaths(treeData[type], targetType, checkedPaths);
      }
      return;
    }
    try {
      const res = await window.apiClient.getScan(type);
      if (res.code === 0) {
        treeData[type] = res.data || [];
        if (selectAll) {
          collectAllPaths(treeData[type], targetType, checkedPaths);
        }
      }
    } catch (e) {}
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
      const icon = document.createElement('iconpark-icon');
      icon.setAttribute('icon-id', expandedPaths.has(node.path) ? 'down' : 'right');
      icon.setAttribute('size', '12');
      icon.setAttribute('color', 'currentColor');
      arrow.appendChild(icon);
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

  // ===== Host Project Logic =====
  function generateRandomPassword() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let pwd = '';
    for (let i = 0; i < 6; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  }

  function updatePreviewUrl() {
    if (!exportPreviewUrlField || !exportPreviewUrl) return;
    const baseUrl = localStorage.getItem('axhost-server-url');
    if (selectedHostProject && selectedHostProject.id && baseUrl) {
      const url = baseUrl.replace(/\/+$/, '') + `/projects/${selectedHostProject.id}/index.html`;
      exportPreviewUrl.href = url;
      exportPreviewUrl.textContent = url;
      exportPreviewUrlField.style.display = '';
    } else {
      exportPreviewUrlField.style.display = 'none';
    }
  }

  function renderHostProjectState() {
    if (currentSettingsLink && currentSettingsLink.remoteProjectId) {
      hostProjectSearch.style.display = 'none';
      hostProjectLinked.style.display = 'flex';
      hostProjectLinkedName.textContent = currentSettingsLink.remoteProjectName || currentSettingsLink.remoteProjectId;
      selectedHostProject = { id: currentSettingsLink.remoteProjectId, name: currentSettingsLink.remoteProjectName };
    } else {
      hostProjectSearch.style.display = '';
      hostProjectLinked.style.display = 'none';
      selectedHostProject = null;
    }
    hostProjectHint.textContent = '';
    updatePreviewUrl();
  }

  async function fetchHostProjects() {
    const baseUrl = localStorage.getItem('axhost-server-url');
    if (!baseUrl) {
      hostProjectHint.textContent = '请先设置 AxHost 服务地址';
      return [];
    }
    const token = localStorage.getItem('axhost-token') || '';
    if (!token) {
      hostProjectHint.textContent = '请先登录';
      return [];
    }
    try {
      const res = await fetch('/api/axhost-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: baseUrl,
          path: '/api/projects?project_type=my',
          method: 'GET',
          headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        })
      });
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        return data.items;
      }
      if (Array.isArray(data)) return data;
      return [];
    } catch (e) {
      hostProjectHint.textContent = '加载项目列表失败';
      return [];
    }
  }

  function renderHostProjectDropdown(list, keyword) {
    hostProjectDropdown.innerHTML = '';
    const filtered = keyword
      ? list.filter(p => (p.name || '').toLowerCase().includes(keyword.toLowerCase()))
      : list;
    if (filtered.length === 0) {
      hostProjectDropdown.innerHTML = '<div class="host-project-dropdown-empty">无匹配项目</div>';
    } else {
      filtered.forEach(p => {
        const div = document.createElement('div');
        div.className = 'host-project-dropdown-item';
        div.textContent = p.name || p.object_id || p.id || '';
        div.addEventListener('click', async () => {
          selectedHostProject = { id: p.object_id || p.id, name: p.name };
          currentSettingsLink = { remoteProjectId: p.object_id || p.id, remoteProjectName: p.name };
          hostProjectSearch.value = p.name || '';
          hostProjectDropdown.classList.remove('open');
          hostProjectHint.textContent = '';
          renderHostProjectState();
          try {
            await window.apiClient.postSettings({ link: currentSettingsLink });
            window.showToast('托管关联已设置', 'success');
            if (window.onHostProjectLinked) window.onHostProjectLinked(p.object_id || p.id, p.name);
          } catch (e) {}
        });
        hostProjectDropdown.appendChild(div);
      });
    }
    hostProjectDropdown.classList.add('open');
  }

  if (hostProjectSearch) {
    hostProjectSearch.addEventListener('focus', async () => {
      const token = localStorage.getItem('axhost-token') || '';
      if (!token) {
        hostProjectHint.textContent = '请先登录';
        return;
      }
      if (hostProjectList.length === 0) {
        hostProjectList = await fetchHostProjects();
      }
      renderHostProjectDropdown(hostProjectList, hostProjectSearch.value.trim());
    });
    hostProjectSearch.addEventListener('input', () => {
      renderHostProjectDropdown(hostProjectList, hostProjectSearch.value.trim());
    });
    document.addEventListener('click', (e) => {
      if (!hostProjectWrap.contains(e.target)) {
        hostProjectDropdown.classList.remove('open');
      }
    });
  }

  if (btnUnlinkProject) {
    btnUnlinkProject.addEventListener('click', async () => {
      currentSettingsLink = null;
      renderHostProjectState();
      try {
        await window.apiClient.postSettings({ link: null });
        window.showToast('托管关联已移除', 'info');
        if (window.onHostProjectUnlinked) window.onHostProjectUnlinked();
      } catch (e) {}
    });
  }

  if (btnCreateRemoteProject) {
    btnCreateRemoteProject.addEventListener('click', function() {
      var modal = new AxhostModal({
        title: '创建新项目',
        width: '360px',
        confirmText: '创建',
        body: function(container) {
          container.innerHTML =
            '<label for="export-new-remote-name">项目名称</label>' +
            '<input type="text" id="export-new-remote-name" placeholder="请输入项目名称" autocomplete="off">' +
            '<div class="remote-password-option" style="margin-top:12px;">' +
              '<label class="checkbox-label" style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-main);cursor:pointer;">' +
                '<input type="checkbox" id="export-needs-pwd" style="width:16px;height:16px;cursor:pointer;">' +
                '<span>需要密码</span>' +
              '</label>' +
            '</div>' +
            '<div id="export-pwd-field" style="display:none;margin-top:10px;">' +
              '<label for="export-pwd-input">密码</label>' +
              '<div style="display:flex;gap:8px;">' +
                '<input type="text" id="export-pwd-input" placeholder="请输入密码" maxlength="6" autocomplete="off" style="flex:1;">' +
                '<button class="axhost-modal-btn" id="export-random-pwd" type="button" style="white-space:nowrap;">随机生成</button>' +
              '</div>' +
            '</div>' +
            '<div id="export-create-error" style="color:#ff4d4f;font-size:12px;margin-top:8px;min-height:16px;"></div>';

          var needsPwd = container.querySelector('#export-needs-pwd');
          var pwdField = container.querySelector('#export-pwd-field');
          var pwdInput = container.querySelector('#export-pwd-input');
          var btnRandom = container.querySelector('#export-random-pwd');
          var errorEl = container.querySelector('#export-create-error');
          var nameInput = container.querySelector('#export-new-remote-name');

          needsPwd.addEventListener('change', function() {
            pwdField.style.display = this.checked ? '' : 'none';
            if (!this.checked) pwdInput.value = '';
          });

          btnRandom.addEventListener('click', function() {
            pwdInput.value = generateRandomPassword();
          });

          container._errorEl = errorEl;
          container._needsPwd = needsPwd;
          container._pwdInput = pwdInput;
          container._nameInput = nameInput;
        },
        onConfirm: async function() {
          var body = modal.getBody();
          var nameInput = body._nameInput;
          var errorEl = body._errorEl;
          var needsPwd = body._needsPwd;
          var pwdInput = body._pwdInput;

          var name = nameInput.value.trim();
          if (!name) { errorEl.textContent = '请输入项目名称'; throw new Error(); }

          var baseUrl = localStorage.getItem('axhost-server-url');
          if (!baseUrl) { errorEl.textContent = 'AxHost 服务地址未设置'; throw new Error(); }

          var token = localStorage.getItem('axhost-token') || '';
          if (!token) { errorEl.textContent = '请先登录'; throw new Error(); }

          var res = await fetch('/api/axhost-proxy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serverUrl: baseUrl, path: '/api/projects', method: 'POST',
              headers: { 'Authorization': 'Bearer ' + token },
              body: {
                name: name,
                is_public: !(needsPwd && needsPwd.checked),
                view_password: (needsPwd && needsPwd.checked) ? (pwdInput ? pwdInput.value.trim() : '') : undefined
              }
            })
          });
          var data = await res.json();
          if (res.ok && (data.object_id || data.id)) {
            var projectId = data.object_id || data.id;
            selectedHostProject = { id: projectId, name: data.name || name };
            currentSettingsLink = { remoteProjectId: projectId, remoteProjectName: data.name || name };
            renderHostProjectState();
            window.showToast('项目创建成功并已关联', 'success');
            try { await window.apiClient.postSettings({ link: currentSettingsLink }); } catch (e) {}
            if (window.onHostProjectLinked) window.onHostProjectLinked(projectId, data.name || name);
            hostProjectList = await fetchHostProjects();
          } else {
            errorEl.textContent = data.message || '创建失败';
            throw new Error();
          }
        }
      });
      modal.open();
    });
  }

  // Confirm export / publish
  btnConfirm.addEventListener('click', async () => {
    const selectedPages = [];
    const selectedComponents = [];
    const selectedFlowcharts = [];

    if (selectAll) {
      collectAllPaths(treeData.pages, 'page', selectedPages);
      collectAllPaths(treeData.components, 'component', selectedComponents);
      collectAllPaths(treeData.flowcharts, 'flowchart', selectedFlowcharts);
    } else {
      for (const path of checkedPaths) {
        const inPages = findNodeByPath(treeData.pages, path);
        const inComponents = findNodeByPath(treeData.components, path);
        const inFlowcharts = findNodeByPath(treeData.flowcharts, path);
        if (inPages && inPages.type === 'page') selectedPages.push(path);
        if (inComponents && inComponents.type === 'component') selectedComponents.push(path);
        if (inFlowcharts && inFlowcharts.type === 'flowchart') selectedFlowcharts.push(path);
      }
    }

    if (selectedPages.length === 0 && selectedComponents.length === 0 && selectedFlowcharts.length === 0) {
      window.showToast('请至少选择一个页面、组件或流程图', 'error');
      return;
    }

    if (currentMode === 'local') {
      await doExport(selectedPages, selectedComponents, selectedFlowcharts);
    } else {
      await doPublish(selectedPages, selectedComponents, selectedFlowcharts);
    }
  });

  async function doExport(selectedPages, selectedComponents, selectedFlowcharts) {
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

    try {
      btnConfirm.disabled = true;
      btnConfirm.textContent = '导出中...';
      const res = await window.apiClient.postExport({
        projectName,
        targetDir,
        selectedPages,
        selectedComponents,
        selectedFlowcharts
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
  }

  async function doPublish(selectedPages, selectedComponents, selectedFlowcharts) {
    if (!selectedHostProject || !selectedHostProject.id) {
      window.showToast('请先选择或创建托管项目', 'error');
      return;
    }
    const baseUrl = localStorage.getItem('axhost-server-url');
    const token = localStorage.getItem('axhost-token') || '';
    if (!baseUrl) {
      window.showToast('AxHost 服务地址未设置', 'error');
      return;
    }
    if (!token) {
      window.showToast('请先登录', 'error');
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'axhost-request-login' }, '*');
      }
      return;
    }

    try {
      btnConfirm.disabled = true;
      btnConfirm.textContent = '发布中...';
      const projectId = window.__axhostProjectId || '';
      const publishUrl = projectId ? `/api/export/publish?project=${encodeURIComponent(projectId)}` : '/api/export/publish';
      const res = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: baseUrl,
          token,
          remoteProjectId: selectedHostProject.id,
          selectedPages,
          selectedComponents,
          selectedFlowcharts
        })
      });
      const data = await res.json();
      if (data.code === 0) {
        window.showToast('发布成功', 'success');
        close();
      } else {
        window.showToast('发布失败: ' + (data.message || '未知错误'), 'error');
      }
    } catch (err) {
      window.showToast('发布失败: ' + err.message, 'error');
    } finally {
      btnConfirm.disabled = false;
      btnConfirm.textContent = '发布';
    }
  }

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
