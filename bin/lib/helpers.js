const fs = require('fs/promises');
const path = require('path');

const META_NAME_PATTERN = /^[\s\S]+$/; // 新架构下名称几乎无限制（除空字符串）

function isValidName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.trim() === name;
}

async function readMap(projectRoot) {
  const mapPath = path.join(projectRoot, 'prototype', '.axhost-map.json');
  try {
    const content = await fs.readFile(mapPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function resolveByHash(projectRoot, hash) {
  const map = await readMap(projectRoot);
  const entry = map[hash.toLowerCase()];
  if (!entry) return null;
  const [tab, ...rest] = entry.path.split('/');
  return { tab, relPath: rest.join('/') };
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
  readMap,
  resolveByHash,
  resolveParent,
  resolvePageOrComponent,
};
