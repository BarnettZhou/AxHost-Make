const path = require('path');
const { readIds } = require('../../server/lib/ids.js');

function isValidName(name) {
  return /^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(name);
}

async function resolveByHash(projectRoot, hash) {
  const ids = await readIds(projectRoot);
  for (const [key, id] of Object.entries(ids)) {
    if (id === hash) {
      const [tab, ...rest] = key.split('/');
      return { tab, relPath: rest.join('/') };
    }
  }
  return null;
}

async function resolveParent(projectRoot, parentInput, tab) {
  if (!parentInput) {
    return `prototype/${tab}`;
  }
  if (/^(pages|components)\//.test(parentInput)) {
    return `prototype/${parentInput}`;
  }
  if (/^[a-f0-9]{8}$/i.test(parentInput)) {
    const resolved = await resolveByHash(projectRoot, parentInput);
    if (!resolved) {
      throw new Error(`无法找到 hash 对应的节点: ${parentInput}`);
    }
    return `prototype/${resolved.tab}/${resolved.relPath}`;
  }
  // 允许直接传入相对路径（如 sub-pages/xxx），在前面补 tab
  if (!parentInput.includes('prototype/')) {
    return `prototype/${tab}/${parentInput}`;
  }
  return parentInput;
}

async function resolvePageOrComponent(projectRoot, input) {
  if (/^(pages|components)\//.test(input)) {
    const [tab, ...rest] = input.split('/');
    return { tab, relPath: rest.join('/') };
  }
  if (/^[a-f0-9]{8}$/i.test(input)) {
    const resolved = await resolveByHash(projectRoot, input);
    if (!resolved) {
      throw new Error(`无法找到 hash 对应的节点: ${input}`);
    }
    return resolved;
  }
  throw new Error(`无法解析归属页面/组件: ${input}，请使用完整路径（pages/xxx 或 components/xxx）或 hash 值`);
}

module.exports = {
  isValidName,
  resolveParent,
  resolvePageOrComponent,
};
