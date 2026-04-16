const fs = require('fs/promises');
const path = require('path');

const ORDER_FILE = '.axhost-order.json';

async function readOrder(dirPath) {
  try {
    const content = await fs.readFile(path.join(dirPath, ORDER_FILE), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeOrder(dirPath, order) {
  await fs.writeFile(path.join(dirPath, ORDER_FILE), JSON.stringify(order, null, 2) + '\n', 'utf-8');
}

async function ensureOrder(dirPath, entries) {
  let order = await readOrder(dirPath);
  if (!Array.isArray(order)) {
    order = entries.slice();
    await writeOrder(dirPath, order);
    return order;
  }
  // 清理已不存在的项
  const set = new Set(entries);
  order = order.filter(name => set.has(name));
  // 追加新项
  for (const name of entries) {
    if (!order.includes(name)) order.push(name);
  }
  await writeOrder(dirPath, order);
  return order;
}

async function reorder(dirPath, oldIndex, newIndex) {
  const order = await readOrder(dirPath);
  if (!Array.isArray(order)) return false;
  if (oldIndex < 0 || oldIndex >= order.length || newIndex < 0 || newIndex >= order.length) return false;
  const [moved] = order.splice(oldIndex, 1);
  order.splice(newIndex, 0, moved);
  await writeOrder(dirPath, order);
  return true;
}

async function removeFromOrder(dirPath, name) {
  const order = await readOrder(dirPath);
  if (!Array.isArray(order)) return;
  const idx = order.indexOf(name);
  if (idx !== -1) {
    order.splice(idx, 1);
    await writeOrder(dirPath, order);
  }
}

async function addToOrder(dirPath, name, index = -1) {
  let order = await readOrder(dirPath);
  if (!Array.isArray(order)) order = [];
  const idx = order.indexOf(name);
  if (idx !== -1) order.splice(idx, 1);
  if (index >= 0 && index < order.length) {
    order.splice(index, 0, name);
  } else {
    order.push(name);
  }
  await writeOrder(dirPath, order);
}

async function renameInOrder(dirPath, oldName, newName) {
  const order = await readOrder(dirPath);
  if (!Array.isArray(order)) return;
  const idx = order.indexOf(oldName);
  if (idx !== -1) {
    order[idx] = newName;
    await writeOrder(dirPath, order);
  }
}

module.exports = {
  readOrder,
  writeOrder,
  ensureOrder,
  reorder,
  removeFromOrder,
  addToOrder,
  renameInOrder,
};
