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

  window.promptBox = { updateStatus };
})();
