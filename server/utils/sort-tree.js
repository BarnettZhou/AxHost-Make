function sortTree(nodes, type, prefix, orderMap) {
  if (!Array.isArray(nodes)) return;
  const key = prefix ? `${type}/${prefix}` : type;
  const orders = (orderMap && orderMap[key]) || {};
  nodes.sort((a, b) => {
    const oa = orders[a.name] ?? 999999;
    const ob = orders[b.name] ?? 999999;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      const childPrefix = prefix ? `${prefix}/${node.name}` : node.name;
      sortTree(node.children, type, childPrefix, orderMap);
    }
  }
}

module.exports = { sortTree };
