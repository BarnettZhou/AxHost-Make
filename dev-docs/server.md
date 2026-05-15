# 服务端设计

## 入口与启动

**`server/index.js`** 导出 `startServer({ port, host, projectRoot })`：
- 调用 `createRouter(projectRoot)` 创建路由函数
- `http.createServer` 将所有请求委托给 router
- 启动 `cache-cleanup.js` 的定时清理任务
- 绑定 127.0.0.1（不对外暴露）

**`server/preview-server.js`** 导出 `startPreviewServer({ port, host, root })`：
- 独立静态文件服务器，CORS 设为 `*`
- 用于 `axhost-make preview` 命令

## 路由分发（router.js）

`createRouter(workspaceRoot)` 返回 `async router(req, res)`，按以下优先级分发：

1. **CORS + OPTIONS** — 所有请求先过 `cors()`，OPTIONS 直接返回 204
2. **API 路由** — `/api/*` 前缀，提取 `projectRoot`（从 `?project=` 参数），按 exact path + method 匹配到具体 handler
3. **客户端静态文件** — `/`、`/shell`、`/client/*` 映射到 `client/` 目录
4. **项目原型文件** — `/projects/{id}/prototype/*` 映射到 `workspaceRoot/projects/{id}/prototype/*`
5. **兼容模式** — `/prototype/*` 先尝试 `workspaceRoot/prototype/*`（单项目），再尝试从 Referer 提取 project id（多项目）
6. **404** — 返回 text/plain

### projectRoot 解析

```js
function getProjectRoot(req) {
  // 从 ?project=<id> 获取项目 id
  // → workspaceRoot/projects/<id>
  // 无参数时 → workspaceRoot（单项目兼容）
}
```

## API Handler 模式

每个 API handler 文件导出一个或多个 `handle*` 函数：

```js
// 模式：读请求体 → 验证参数 → 执行业务逻辑 → 写响应
async function handleXxx(req, res, projectRoot) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const params = JSON.parse(body || '{}');
      // ... 业务逻辑 ...
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 0, data: result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 500, message: err.message }));
    }
  });
}
```

**注意：** 不使用 Express 等框架，手动解析请求体（`req.on('data')` / `req.on('end')`）。

## API Handler 清单

| 文件 | Handler | 职责 |
|---|---|---|
| `scan.js` | `handleScan` | 返回 sitemap 树（从 sitemap.js 读取） |
| `file.js` | `handleFileGet` / `handleFilePost` | 文件读写，扩展名白名单 |
| `create.js` | `handleCreate` / `createItem` | 创建 page/component/flowchart/folder |
| `rename.js` | `handleRename` | 重命名节点或文档 |
| `page-type.js` | `handlePageType` | 修改 page_type |
| `delete.js` | `handleDelete` | 删除节点（递归删除物理目录） |
| `move.js` | `handleMove` | 移动/排序 sitemap 节点 |
| `copy.js` | `handleCopy` | 深拷贝节点 |
| `docs.js` | `handleDocsGet` / `handleDocsReorder` | 文档列表与排序 |
| `reorder.js` | `handleReorder` | sitemap 顶级重排序 |
| `settings.js` | `handleSettingsGet` / `handleSettingsPost` | 项目设置 + AxHost 链接 |
| `projects.js` | `handleProjectsGet` / `handleProjectsPost` | 项目索引 CRUD |
| `project-info.js` | `handleProjectInfoGet` | 项目目录信息 |
| `export.js` | `handleExportDefaultDir` / `handleExportPost` / `handleExportPublish` | 本地导出 + 远程发布 |
| `open-editor.js` | `handleOpenEditor` | 在 vscode/cursor/trae 中打开项目 |
| `terminal.js` | `handleOpenTerminal` / `handleOpenWslTerminal` | 打开终端 |
| `axhost-proxy.js` | `handleAxHostProxy` | 代理转发到 AxHost |
| `upload-image.js` | `handleUploadImage` | Base64 图片保存 |
| `cache-cleanup.js` | `handleDeleteCacheFile` / `startCacheCleanup` | 缓存清理（1 小时 TTL，10 分钟轮询） |

## 共享库

### lib/sitemap-io.js
```js
readSitemap(projectRoot)   → 从 prototype/sitemap.js 解析 JSON
writeSitemap(projectRoot, data) → 写回 sitemap.js
```

### lib/ids.js
```js
generateId(name, existingIds)  → 8 位 hex hash（MD5 + 盐，防碰撞）
```

### lib/order.js
```js
ensureOrder(dirPath, entries)  → 读取/初始化 .axhost-order.json，追加新条目
addToOrder(dirPath, name, index?)
removeFromOrder(dirPath, name)
renameInOrder(dirPath, oldName, newName)
reorder(dirPath, oldIndex, newIndex)
```

### utils/sort-tree.js
```js
sortTree(nodes, type, prefix, orderMap)  → 递归排序 sitemap 树
```

## 中间件

### middleware/cors.js
设置 CORS 头（`*` 来源），所有响应统一处理。

### middleware/static.js
根据扩展名设置 MIME type，从磁盘读取文件。目录自动尝试 `index.html`。

## 安全

- **路径遍历防护：** 各 handler 自行实现 `isSafePath()`，确保解析后路径在 projectRoot 内
- **文件写入白名单：** `file.js` 只允许 `.html .md .css .js .json .txt .mmd` 扩展名
- **网络绑定：** 服务器绑定 127.0.0.1，不对外暴露
- **AxHost 代理验证：** `axhost-proxy.js` 只接受 `http://` 或 `https://` 开头的 serverUrl
