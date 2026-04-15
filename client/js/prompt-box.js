(function () {
  const promptInput = document.getElementById('prompt-input');
  const btnCopy = document.getElementById('btn-prompt-copy');
  const promptStatus = document.getElementById('prompt-status');

  if (!promptInput || !btnCopy || !promptStatus) return;

  function buildPrompt(userText, pageType, pagePath) {
    return [
      '# System Prompt',
      '',
      '请遵循项目根目录下的 agents.md 以及 rules/ 目录中的规则文件来绘制原型（若你的上下文中已包含这些规则，则无需重复读取）。',
      '如需补充信息，可参考 wiki/ 目录。',
      '',
      '---',
      '',
      '# Current Page',
      '',
      `- **页面类型**: ${pageType}`,
      `- **页面路径**: prototype/${pageType}s/${pagePath}`,
      `- **访问 URL**: http://localhost:3820/prototype/${pageType}s/${pagePath}/index.html`,
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
      '请直接修改对应源码文件或文档，并输出修改后的完整文件内容。'
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
    const prompt = buildPrompt(userText, state.currentPage.type, state.currentPage.path);
    const ok = await copyToClipboard(prompt);
    updateStatus(ok ? '✅ 已复制到剪贴板，可直接粘贴给 Agent' : '❌ 复制失败，请手动全选复制');
  }

  function updateStatus(text) {
    promptStatus.textContent = text;
  }

  btnCopy.addEventListener('click', handleCopy);

  window.promptBox = { updateStatus };
})();
