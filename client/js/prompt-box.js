(function () {
  const promptInput = document.getElementById('prompt-input');
  const btnCopy = document.getElementById('btn-prompt-copy');
  const promptStatus = document.getElementById('prompt-status');

  if (!promptInput || !btnCopy || !promptStatus) return;

  function buildPrompt(userText, pageType, pagePath, pageRelativePath, pageAbsolutePath) {
    const projectId = window.__axhostProjectId || '';
    const projectInfo = window.__axhostProjectInfo || {};
    const baseUrl = projectId
      ? `http://${location.host}/projects/${projectId}/prototype`
      : `http://${location.host}/prototype`;
    return [
      '# Current Page',
      '',
      `- **页面类型**: ${pageType}`,
      `- **项目ID**: ${projectId}`,
      `- **项目目录**: ${projectInfo.projectRelativeDir || ''}`,
      `- **项目绝对路径**: ${projectInfo.projectAbsolutePath || ''}`,
      `- **页面相对路径**: ${pageRelativePath || ''}`,
      `- **页面绝对路径**: ${pageAbsolutePath || ''}`,
      '- **页面文档路径**: 页面路径/docs',
      '- **js文件路径**: 页面路径/resources/js',
      '- **css文件路径**: 页面路径/resources/css',
      '',
      '---',
      '',
      '# User Request',
      '',
      userText,
      '',
      '---',
      '',
      '# Output Instruction',
      '',
      '请根据用户指示决定是否阅读页面文档。',
      '直接修改对应源码文件（html/js/css）、文档（.md）或流程图（.mmd），总结并输出修改要点。'
    ].join('\n');
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    }
  }

  const DEFAULT_STATUS = '';
  let statusTimer = null;

  async function handleCopy() {
    const state = window.__axhostState;
    if (!state || !state.currentPage) {
      updateStatus('⚠️ 请先选择一个页面或组件');
      return;
    }
    const userText = promptInput.value.trim();
    if (!userText) {
      updateStatus('⚠️ 请输入修改需求');
      return;
    }
    const prompt = buildPrompt(
      userText,
      state.currentPage.type,
      state.currentPage.path,
      state.currentPage.pageRelativePath,
      state.currentPage.pageAbsolutePath
    );
    const ok = await copyToClipboard(prompt);
    if (ok) {
      updateStatus('复制成功', 3000);
    } else {
      updateStatus('复制失败');
    }
  }

  function updateStatus(text, autoResetDelay = 0) {
    promptStatus.textContent = text;
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    if (autoResetDelay > 0) {
      statusTimer = setTimeout(() => {
        promptStatus.textContent = DEFAULT_STATUS;
      }, autoResetDelay);
    }
  }

  btnCopy.addEventListener('click', handleCopy);

  // ===== Autocomplete for @ (pages) and # (components) =====
  let acDropdown = null;
  let acState = null;
  let pagesCache = null;
  let componentsCache = null;
  let isComposing = false;

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  async function loadScanData(type) {
    if (type === 'pages' && pagesCache) return pagesCache;
    if (type === 'components' && componentsCache) return componentsCache;
    try {
      const res = await window.apiClient.getScan(type);
      if (res.code === 0) {
        const list = flattenNodes(res.data || [], type);
        if (type === 'pages') pagesCache = list;
        else componentsCache = list;
        return list;
      }
    } catch (e) { console.error('loadScanData error:', e); }
    return [];
  }

  function flattenNodes(nodes, type, parentNames = []) {
    const result = [];
    for (const node of nodes) {
      const currentNames = [...parentNames, node.name];
      if (node.type === 'page' || node.type === 'component') {
        result.push({
          name: node.name,
          path: node.path,
          type: type,
          breadcrumb: currentNames.join(' / ')
        });
      }
      if (node.children && node.children.length) {
        result.push(...flattenNodes(node.children, type, currentNames));
      }
    }
    return result;
  }

  function getCaretCoordinates(textarea, position) {
    const div = document.createElement('div');
    const style = getComputedStyle(textarea);
    const properties = [
      'boxSizing','width','height','overflowX','overflowY',
      'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
      'paddingTop','paddingRight','paddingBottom','paddingLeft',
      'fontStyle','fontVariant','fontWeight','fontStretch','fontSize',
      'fontFamily','lineHeight','textTransform','textIndent','textDecoration',
      'letterSpacing','wordSpacing','tabSize','whiteSpace'
    ];
    div.style.position = 'fixed';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    properties.forEach(prop => { div.style[prop] = style[prop]; });
    div.style.width = textarea.clientWidth + 'px';

    const taRect = textarea.getBoundingClientRect();
    div.style.left = taRect.left + 'px';
    div.style.top = taRect.top + 'px';

    const text = textarea.value.substring(0, position);
    const span = document.createElement('span');
    span.innerHTML = escapeHtml(text).replace(/\n/g, '<br/>');
    const caret = document.createElement('span');
    caret.textContent = '|';
    div.appendChild(span);
    div.appendChild(caret);
    document.body.appendChild(div);

    const caretRect = caret.getBoundingClientRect();
    document.body.removeChild(div);
    return { left: caretRect.left, top: caretRect.top + caretRect.height };
  }

  function findTrigger(text, cursorPos) {
    for (let i = cursorPos - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === '@' || ch === '#') {
        const prev = i > 0 ? text[i - 1] : '';
        if (i === 0 || /\s/.test(prev)) {
          const keyword = text.substring(i + 1, cursorPos);
          if (!/\s/.test(keyword)) {
            return { char: ch, startPos: i, keyword, type: ch === '@' ? 'pages' : 'components' };
          }
        }
        return null;
      }
      if (/\s/.test(ch)) return null;
    }
    return null;
  }

  function ensureDropdown() {
    if (!acDropdown) {
      acDropdown = document.createElement('div');
      acDropdown.id = 'prompt-autocomplete';
      acDropdown.className = 'prompt-autocomplete';
      document.body.appendChild(acDropdown);
    }
    return acDropdown;
  }

  function hideDropdown() {
    if (acDropdown) acDropdown.classList.remove('open');
    acState = null;
  }

  async function updateDropdown() {
    if (isComposing) return;
    const pos = promptInput.selectionStart;
    const text = promptInput.value;
    const trigger = findTrigger(text, pos);
    if (!trigger) {
      hideDropdown();
      return;
    }

    const items = await loadScanData(trigger.type);
    const keyword = trigger.keyword.toLowerCase();
    const filtered = keyword
      ? items.filter(it => it.name.toLowerCase().includes(keyword) || it.path.toLowerCase().includes(keyword))
      : items.slice(0, 20);

    if (filtered.length === 0) {
      hideDropdown();
      return;
    }

    const dropdown = ensureDropdown();
    dropdown.innerHTML = '';
    filtered.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'prompt-ac-item' + (idx === 0 ? ' active' : '');
      div.innerHTML = `<div class="prompt-ac-name">${escapeHtml(item.name)}</div><div class="prompt-ac-meta">${escapeHtml(item.breadcrumb)}</div>`;
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectItem(item);
      });
      dropdown.appendChild(div);
    });

    const coords = getCaretCoordinates(promptInput, trigger.startPos);
    const taRect = promptInput.getBoundingClientRect();
    dropdown.style.left = coords.left + 'px';
    dropdown.style.top = coords.top + 'px';
    dropdown.style.minWidth = taRect.width + 'px';
    dropdown.classList.add('open');

    acState = { trigger, items: filtered, selectedIndex: 0 };
  }

  function selectItem(item) {
    if (!acState) return;
    const { trigger } = acState;
    const text = promptInput.value;
    const before = text.substring(0, trigger.startPos);
    const after = text.substring(promptInput.selectionStart);
    const prefix = trigger.char;
    const replacement = `${prefix}${item.type}/${item.path}(${item.name})`;
    promptInput.value = before + replacement + after;
    const newPos = before.length + replacement.length;
    promptInput.setSelectionRange(newPos, newPos);
    hideDropdown();
    promptInput.focus();
  }

  function updateActiveItem() {
    if (!acState || !acDropdown) return;
    acDropdown.querySelectorAll('.prompt-ac-item').forEach((el, idx) => {
      el.classList.toggle('active', idx === acState.selectedIndex);
    });
  }

  promptInput.addEventListener('input', updateDropdown);
  promptInput.addEventListener('compositionstart', () => { isComposing = true; });
  promptInput.addEventListener('compositionend', () => { isComposing = false; updateDropdown(); });

  promptInput.addEventListener('keydown', (e) => {
    if (!acState) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      acState.selectedIndex = (acState.selectedIndex + 1) % acState.items.length;
      updateActiveItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      acState.selectedIndex = (acState.selectedIndex - 1 + acState.items.length) % acState.items.length;
      updateActiveItem();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectItem(acState.items[acState.selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideDropdown();
    }
  });

  document.addEventListener('click', (e) => {
    if (acState && acDropdown && !acDropdown.contains(e.target) && e.target !== promptInput) {
      hideDropdown();
    }
  });

  window.promptBox = { updateStatus };
})();
