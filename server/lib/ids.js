const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function generateId(itemPath) {
  return md5(`${itemPath}:${Date.now()}`).slice(0, 8);
}

function getIdsPath(projectRoot) {
  return path.join(projectRoot, 'prototype', '.axhost-ids.json');
}

async function readIds(projectRoot) {
  try {
    const content = await fs.readFile(getIdsPath(projectRoot), 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeIds(projectRoot, ids) {
  await fs.writeFile(getIdsPath(projectRoot), JSON.stringify(ids, null, 2) + '\n', 'utf-8');
}

function makeKey(tab, itemPath) {
  return `${tab}/${itemPath}`;
}

async function assignId(projectRoot, tab, itemPath) {
  const ids = await readIds(projectRoot);
  const key = makeKey(tab, itemPath);
  if (!ids[key]) {
    ids[key] = generateId(key);
    await writeIds(projectRoot, ids);
  }
  return ids[key];
}

async function renameIdKey(projectRoot, tab, oldPath, newPath) {
  const ids = await readIds(projectRoot);
  const oldKey = makeKey(tab, oldPath);
  const newKey = makeKey(tab, newPath);
  const newIds = {};
  const oldPrefix = oldKey + '/';
  for (const key of Object.keys(ids)) {
    if (key === oldKey) {
      newIds[newKey] = ids[key];
    } else if (key.startsWith(oldPrefix)) {
      newIds[newKey + '/' + key.slice(oldPrefix.length)] = ids[key];
    } else {
      newIds[key] = ids[key];
    }
  }
  await writeIds(projectRoot, newIds);
}

async function removeIdKey(projectRoot, tab, targetPath) {
  const ids = await readIds(projectRoot);
  const targetKey = makeKey(tab, targetPath);
  const newIds = {};
  const targetPrefix = targetKey + '/';
  for (const key of Object.keys(ids)) {
    if (key === targetKey || key.startsWith(targetPrefix)) continue;
    newIds[key] = ids[key];
  }
  await writeIds(projectRoot, newIds);
}

function collectPathsFromTree(nodes) {
  const paths = [];
  function walk(list) {
    for (const node of list) {
      if (node.path) paths.push(node.path);
      if (node.children) walk(node.children);
    }
  }
  walk(nodes);
  return paths;
}

async function ensureIdsForTree(projectRoot, treeNodes, keyPrefix) {
  const ids = await readIds(projectRoot);
  let changed = false;
  for (const p of collectPathsFromTree(treeNodes)) {
    const key = makeKey(keyPrefix, p);
    if (!ids[key]) {
      ids[key] = generateId(key);
      changed = true;
    }
  }
  if (changed) await writeIds(projectRoot, ids);
  return ids;
}

function injectIds(nodes, ids, keyPrefix) {
  function walk(list) {
    for (const node of list) {
      const key = makeKey(keyPrefix, node.path);
      if (node.path && ids[key]) {
        node.id = ids[key];
      }
      if (node.children) walk(node.children);
    }
  }
  walk(nodes);
}

module.exports = {
  readIds,
  writeIds,
  assignId,
  renameIdKey,
  removeIdKey,
  ensureIdsForTree,
  injectIds,
};
