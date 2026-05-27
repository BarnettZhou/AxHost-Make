(function () {
  const promptInput = document.getElementById('prompt-input');
  const btnCopy = document.getElementById('btn-prompt-copy');
  const promptStatus = document.getElementById('prompt-status');
  const btnAttachToggle = document.getElementById('btn-attach-toggle');
  const attachPopup = document.getElementById('attach-popup');
  const btnAttachClose = document.getElementById('btn-attach-close');
  const attachList = document.getElementById('attach-list');

  if (!promptInput || !btnCopy || !promptStatus) return;

  // ===== Attached images state =====
  const attachedImages = []; // { path, url }

  function getProjectId() {
    return window.__axhostProjectId || '';
  }

  // ===== Prompt builder (with multimodal attachments) =====
  function buildPrompt(userText, pageType, pagePath, pageRelativePath, pageAbsolutePath) {
    const projectId = getProjectId();
    const projectInfo = window.__axhostProjectInfo || {};
    const baseUrl = projectId
      ? `http://${location.host}/projects/${projectId}/prototype`
      : `http://${location.host}/prototype`;
    const isComponent = pageType === 'component';
    const outputInstruction = isComponent
      ? '请根据用户指示决定是否阅读页面文档。\n直接修改对应源码文件（html/js/css）、文档（.md）或流程图（.mmd），总结并输出修改要点。\n当前正在开发/修改组件（component），请确保已阅读并理解框架内的 system-rules/components-spec.md 文档（从项目目录出发的相对路径：../../axhost-make/system-rules/components-spec.md）\n每次针对组件接口有修改后，务必同步更新组件的 docs/readme.md 文档'
      : '请根据用户指示决定是否阅读页面文档。\n直接修改对应源码文件（html/js/css）、文档（.md）或流程图（.mmd），总结并输出修改要点。';

    const lines = [
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
      outputInstruction
    ];

    // Append attachment files list
    if (attachedImages.length > 0) {
      lines.push('', '# Attachment Files:', '');
      attachedImages.forEach((img, idx) => {
        const num = String(idx + 1).padStart(2, '0');
        lines.push(`- image-${num}:<image-path:${img.path}>`);
      });
    }

    return lines.join('\n');
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
      updateStatus('请先选择页面或组件');
      return;
    }
    const userText = promptInput.value.trim();
    if (!userText) {
      updateStatus('请输入需求');
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
      updateStatus('复制成功');
    } else {
      updateStatus('复制失败');
    }
  }

  function updateStatus(text, autoResetDelay = 3000) {
    promptStatus.textContent = text;
    if (text) {
      promptStatus.classList.remove('hidden');
    } else {
      promptStatus.classList.add('hidden');
    }
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    if (autoResetDelay > 0) {
      statusTimer = setTimeout(() => {
        promptStatus.classList.add('hidden');
        promptStatus.textContent = DEFAULT_STATUS;
      }, autoResetDelay);
    }
  }

  btnCopy.addEventListener('click', handleCopy);

  // ===== Image paste upload =====
  async function uploadImage(file) {
    const projectId = getProjectId();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result.split(',')[1];
          const res = await fetch(`/api/prompt-upload?project=${encodeURIComponent(projectId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              mimeType: file.type,
              data: base64
            })
          });
          const data = await res.json();
          if (data.code === 0) resolve(data);
          else reject(new Error(data.message || 'Upload failed'));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  promptInput.addEventListener('paste', async (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    let hasImage = false;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        hasImage = true;
        break;
      }
    }
    if (!hasImage) return;
    e.preventDefault();

    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (!file) continue;
      try {
        updateStatus('上传中');
        const data = await uploadImage(file);
        const url = URL.createObjectURL(file);
        attachedImages.push({ path: data.path, url });
        updateStatus('上传成功');
        renderAttachPopup();
      } catch (err) {
        console.error('Image upload error:', err);
        updateStatus('上传失败');
      }
    }
  });

  // ===== Attach popup =====
  function toggleAttachPopup() {
    const isHidden = attachPopup.classList.contains('hidden');
    if (isHidden) {
      attachPopup.classList.remove('hidden');
      btnAttachToggle.classList.add('active');
    } else {
      attachPopup.classList.add('hidden');
      btnAttachToggle.classList.remove('active');
    }
  }

  function hideAttachPopup() {
    attachPopup.classList.add('hidden');
    btnAttachToggle.classList.remove('active');
  }

  function renderAttachPopup() {
    if (!attachList) return;
    attachList.innerHTML = '';
    if (attachedImages.length === 0) {
      attachList.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">暂无附件</div>';
      return;
    }
    attachedImages.forEach((img, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      const thumb = document.createElement('div');
      thumb.className = 'attach-thumb';
      thumb.innerHTML = `
        <div class="attach-thumb-img">
          <img src="${img.url}" alt="">
          <button class="attach-thumb-close" data-path="${escapeHtml(img.path)}" title="删除">
            <iconpark-icon icon-id="close-small" size="10"></iconpark-icon>
          </button>
        </div>
        <div class="attach-thumb-footer" title="点击复制 image-${num}">${num}</div>
      `;
      thumb.querySelector('.attach-thumb-close').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteAttachedImage(img.path);
      });
      thumb.querySelector('.attach-thumb-footer').addEventListener('click', (e) => {
        e.stopPropagation();
        const text = `image-${num}`;
        navigator.clipboard.writeText(text).then(() => {
          window.showToast && window.showToast(`已复制 ${text}`, 'success');
        }).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          window.showToast && window.showToast(`已复制 ${text}`, 'success');
        });
      });
      attachList.appendChild(thumb);
    });
  }

  async function deleteAttachedImage(imgPath) {
    // 1. Remove from attachedImages
    const idx = attachedImages.findIndex(img => img.path === imgPath);
    if (idx >= 0) {
      URL.revokeObjectURL(attachedImages[idx].url);
      attachedImages.splice(idx, 1);
    }

    // 2. Delete file on server
    try {
      await fetch('/api/cache-file-delete?project=' + encodeURIComponent(getProjectId()), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: imgPath })
      });
    } catch (err) {
      console.error('Delete cache file error:', err);
    }

    renderAttachPopup();
  }

  if (btnAttachToggle) {
    btnAttachToggle.addEventListener('click', toggleAttachPopup);
  }
  if (btnAttachClose) {
    btnAttachClose.addEventListener('click', hideAttachPopup);
  }
  renderAttachPopup();

  // ===== Autocomplete for @ (pages) and # (components) =====
  var acDropdown = null;
  var acState = null;
  var acCache = {};
  var isComposing = false;

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
  }

  function findTrigger(text, cursorPos) {
    for (var i = cursorPos - 1; i >= 0; i--) {
      var ch = text[i];
      if (ch === '@' || ch === '#') {
        var prev = i > 0 ? text[i - 1] : '';
        if (i === 0 || /\s/.test(prev)) {
          var keyword = text.substring(i + 1, cursorPos);
          if (!/\s/.test(keyword)) {
            return { char: ch, startPos: i, keyword: keyword, type: ch === '@' ? 'pages' : 'components' };
          }
        }
        return null;
      }
    }
    return null;
  }

  async function updateDropdown() {
    if (isComposing) return;
    var pos = promptInput.selectionStart;
    var text = promptInput.value;
    var trigger = findTrigger(text, pos);
    if (!trigger) {
      window.acCore.hideDropdown(acDropdown);
      acState = null;
      return;
    }

    if (!acState) acCache = {};

    var items = await window.acCore.loadScanData(trigger.type, acCache);
    var filtered = window.acCore.filterItems(items, trigger.keyword);

    if (filtered.length === 0) {
      window.acCore.hideDropdown(acDropdown);
      acState = null;
      return;
    }

    acDropdown = window.acCore.ensureDropdown('prompt-autocomplete', 'prompt-autocomplete');

    window.acCore.buildDropdownItems(filtered, escapeHtml, function (item) {
      selectItem(item);
    }, acDropdown);

    window.acCore.positionDropdown(acDropdown, promptInput, trigger.startPos);

    acState = { trigger: trigger, items: filtered, selectedIndex: 0 };
  }

  function selectItem(item) {
    if (!acState) return;
    var trigger = acState.trigger;
    var text = promptInput.value;
    var before = text.substring(0, trigger.startPos);
    var after = text.substring(promptInput.selectionStart);
    var replacement = trigger.char + item.type + '/' + item.path + '(' + item.name + ')';
    promptInput.value = before + replacement + after;
    var newPos = before.length + replacement.length;
    promptInput.setSelectionRange(newPos, newPos);
    window.acCore.hideDropdown(acDropdown);
    acState = null;
    promptInput.focus();
  }

  promptInput.addEventListener('input', updateDropdown);
  promptInput.addEventListener('compositionstart', function () { isComposing = true; });
  promptInput.addEventListener('compositionend', function () { isComposing = false; updateDropdown(); });

  promptInput.addEventListener('keydown', function (e) {
    if (!acState) return;
    window.acCore.handleKeyNav(e, acState, acDropdown, function (item) {
      selectItem(item);
    });
  });

  document.addEventListener('click', function (e) {
    if (acState && acDropdown && !acDropdown.contains(e.target) && e.target !== promptInput) {
      window.acCore.hideDropdown(acDropdown);
      acState = null;
    }
  });


  window.promptBox = { updateStatus };
})();
