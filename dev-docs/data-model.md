# 数据模型

## 核心数据结构

### 1. sitemap.js — 站点地图（唯一数据源）

**位置：** `prototype/sitemap.js`  
**格式：** JavaScript 文件，挂载到 `window.__axhostSitemap`

```js
window.__axhostSitemap = {
  name: "项目名称",
  pages: [
    {
      id: "85a10724",           // 8 位 hex hash（目录名）
      name: "用户中心",           // 显示名称
      path: "85a10724",         // 路径（同 id，或多级时如 "parentId/childId"）
      type: "page",             // "page" | "component" | "flowchart" | "dir" | "spec"
      page_type: "default",     // 仅 page: "default" | "mobile" | "mini-program"
      parentId: null,           // 父节点 id，根级别为 null
      docs: ["readme.md", "notes.md"],  // 关联文档列表
      children: [               // 子节点（仅 dir 或带子节点的 page 有）
        { /* 递归结构 */ }
      ]
    }
  ],
  components: [ /* 同上 */ ],
  flowcharts: [ /* 同上 */ ],
  _map: {                       // 扁平 ID→元数据 查找表
    "85a10724": { name: "用户中心", type: "page", path: "pages/85a10724" }
  },
  generatedBy: "axhost-make"
}
```

**读写方式：** 通过 `server/lib/sitemap-io.js` 的 `readSitemap()` / `writeSitemap()`

```js
// readSitemap: 去掉前缀 window.__axhostSitemap = 和尾部分号，然后 JSON.parse
// writeSitemap: 重新包装为 window.__axhostSitemap = JSON.stringify(data, null, 2);
```

**关键约束：**
- 目录名 = node.id（8 位 hex），不可变
- 显示名称存在 node.name 和 `.axhost-meta.json` 两份（以 sitemap 为准）
- `_map` 是派生数据，用于快速 ID→路径查找
- 节点树由 `parentId` 关联，目录节点（type="dir"）无物理目录

### 2. .axhost-meta.json — 节点元数据

**位置：** `prototype/{tab}/{hash}/.axhost-meta.json`  
**每个物理目录（page/component/flowchart）一个**

```json
{
  "name": "用户中心",
  "kind": "page",
  "page_type": "default",
  "parentId": "6e3d21e9"
}
```

- `kind`: "page" | "component" | "flowchart"（dir 无物理目录，故无此文件）
- `page_type`: "default" | "mobile" | "mini-program"（仅 page/component）
- `parentId`: 父节点 hash，根级别为 null
- 在 rename / page-type 修改 / move 时更新

### 3. .axhost-order.json — 文档排序

**位置：** `prototype/{tab}/{hash}/docs/.axhost-order.json`（目录级别可有多份）  
**格式：** 文件名的 JSON 数组

```json
["readme.md", "api-spec.md", "ui-design.md", "notes.md"]
```

**操作函数（`server/lib/order.js`）：**
- `ensureOrder(dirPath, entries)` — 初始化或清理（追加新文件、删除已不存在的）
- `addToOrder(dirPath, name)` — 追加新文件
- `reorder(dirPath, oldIndex, newIndex)` — 移动排序
- `renameInOrder(dirPath, oldName, newName)` — 重命名时更新
- `removeFromOrder(dirPath, name)` — 删除文件时清理

### 4. .projects.json — 项目索引

**位置：** `projects/.projects.json`  
**格式：**

```json
{
  "projects": [
    {
      "id": "184bdd45",
      "name": "我的项目",
      "createdAt": "2025-03-15T10:00:00.000Z",
      "lastModified": "2025-04-01T14:30:00.000Z"
    }
  ]
}
```

- **读者：** `server/api/projects.js`（GET 列出所有项目，POST 创建新项目）
- **写者：** `server/api/projects.js`（POST 时追加）

### 5. .axhost-link.json — AxHost 远程关联

**位置：** 项目根目录（`projects/{hash}/.axhost-link.json`）

```json
{
  "remoteProjectId": "abc123...",
  "remoteProjectName": "线上项目名"
}
```

- **读者：** `server/api/settings.js`（GET 时合并到返回数据中）
- **写者：** `server/api/settings.js`（POST 时写入或删除）

## 物理目录结构（一个页面）

```
prototype/pages/85a10724/
├── .axhost-meta.json          # 元数据
├── index.html                 # 页面入口
├── resources/
│   ├── css/
│   │   └── style.css          # 页面样式
│   └── js/
│       └── main.js            # 页面脚本
└── docs/
    ├── .axhost-order.json     # 文档排序
    ├── readme.md              # 说明文档
    └── notes.md               # 开发笔记
```

## ID 生成规则

**`server/lib/ids.js` — `generateId(name, existingIds)`：**

```js
// MD5(name + Date.now() + salt) → 取前 8 位 hex
// salt 自增直到不在 existingIds 中（不区分大小写）
```

- 输入 `name` 仅用于哈希种子，生成的 ID 不包含名称信息
- 这使得页面可以任意重命名而不影响 URL 路径
- 新建时从 `collectExistingIds()` 收集 pages/components/flowcharts 下所有已用的 8 位 hex 目录名

## 模板变量替换

`createItem()` 使用 `{{VAR}}` 语法替换模板中的变量：
- `{{PAGE_NAME}}` — 页面/组件名
- `{{DATE}}` — 创建日期（ISO 格式前 10 位）
