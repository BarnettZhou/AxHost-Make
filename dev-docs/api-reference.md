# API 参考

## 通用约定

- **Base URL:** `http://127.0.0.1:3820`
- **Content-Type:** `application/json; charset=utf-8`
- **响应格式:** `{ code: 0, data: ... }` 成功，`{ code: 非0, message: "..." }` 失败
- **项目路由:** 大多数 API 需要通过 `?project=<id>` 指定目标项目。不传则使用单项目兼容模式（`workspaceRoot` 作为 `projectRoot`）
- **路径安全:** 所有文件路径 API 都有 `isSafePath()` 检查防止目录遍历

---

## 项目管理

### GET /api/projects
列出所有项目。

```
Response: { code: 0, data: [{ id, name, createdAt, lastModified }] }
```

### POST /api/projects
创建新项目。生成 8 位 hash ID，初始化目录结构。

```
Body: { name: "项目名称" }
Response: { code: 0, data: { id, name, createdAt } }
```

### GET /api/project-info
获取单个项目信息。

```
Query: ?projectId=<hash>
Response: { code: 0, data: { projectRelativeDir, projectAbsolutePath, editors, platform, isWsl, hasWsl } }
```

---

## 站点地图

### GET /api/scan
获取站点地图的页面/组件/流程图树。

```
Query: ?type=pages|components|flowcharts  （不传返回全部）
Response: { code: 0, data: TreeNode[] }
TreeNode: { id, name, path, type, page_type?, parentId?, children?: TreeNode[], docs: string[] }
```

---

## 文件读写

### GET /api/file
读取文件内容。

```
Query: ?path=prototype/pages/{hash}/index.html （相对 projectRoot）
Response: text/plain
```

### POST /api/file
写入文件内容。不支持的文件扩展名会被拒绝。

```
Body: { path: "...", content: "..." }
允许扩展名: .html .md .css .js .json .txt .mmd
自动行为: 如果是 docs/ 下新的 .md 文件，自动注册到 .axhost-order.json
Response: { code: 0, message: "saved" }
```

---

## CRUD 操作

### POST /api/create
创建页面/组件/流程图/目录。

```
Body: {
  parentPath: "prototype/pages" | "prototype/pages/{hash}",
  name: "名称",
  kind: "page" | "component" | "flowchart" | "folder",
  template?: "default" | "mobile" | "mini-program"  // 仅 page/component
}
Response: { code: 0, data: { id, name, path, kind } }
```

行为说明：
- `kind: "folder"` — 仅添加 sitemap 节点，不创建物理目录
- `kind: "page"/"component"/"flowchart"` — 创建物理目录 + index.html + resources + docs + 更新 sitemap
- 模板文件来自 `templates/project/{tab}/{template}.html`，使用 `{{PAGE_NAME}}` / `{{DATE}}` 变量替换

### POST /api/rename
重命名页面/组件或文档。

```
重命名页面/组件:
Body: { path: "prototype/pages/{hash}", newName: "新名称" }

重命名文档:
Body: { oldPath: "prototype/pages/{hash}/docs/old.md", newName: "new.md" }
```

### POST /api/page-type
修改页面类型。

```
Body: { path: "prototype/pages/{hash}", pageType: "default" | "mobile" | "mini-program" }
Response: { code: 0, data: { path, pageType } }
```

### POST /api/delete
删除页面/组件/流程图/文档。

```
Body: { path: "prototype/pages/{hash}" }  // 递归删除物理目录 + sitemap 节点
Response: { code: 0 }
```

### POST /api/move
移动或排序 sitemap 节点。

```
排序（同父级）:
Body: { type: "pages", sourcePath: "hash1", targetPath: "hash2", position: "before"|"after" }

移动（不同父级）:
Body: { type: "pages", sourcePath: "hash1", targetPath: "hash2" }  // 无 position → drop-into

Response: { code: 0, data: { newPath: "hash1" } }
```

### POST /api/copy
复制页面/组件。

```
Body: { sourcePath: "hash", type: "pages"|"components" }
Response: { code: 0, data: { id, name, path, type } }
```

---

## 文档管理

### GET /api/docs
列出目录下的 .md 文件（按 `.axhost-order.json` 排序）。

```
Query: ?path=prototype/pages/{hash}/docs
Response: { code: 0, data: ["readme.md", "notes.md"] }
```

### POST /api/docs/reorder
重新排序文档。

```
Body: {
  path: "prototype/pages/{hash}/docs",
  order: ["notes.md", "readme.md"]     // 方式一：全部重排
  或
  oldIndex: 0, newIndex: 1             // 方式二：单次移动
}
```

### POST /api/sitemap/reorder
重新排序 sitemap 中的顶级页面/组件。

```
Body: { type: "pages"|"components", oldIndex: 0, newIndex: 1 }
Response: { code: 0 }
```

---

## 项目设置

### GET /api/settings
获取项目设置。

```
Response: { code: 0, data: { name: "项目名称", link: { remoteProjectId, remoteProjectName } | null } }
```

### POST /api/settings
保存项目设置。

```
Body: { name: "新名称", link: { remoteProjectId, remoteProjectName } | null }
Response: { code: 0, data: { name, link } }
```

---

## 导出与发布

### GET /api/export/default-dir
获取默认导出目录路径。

```
Response: { code: 0, data: { path: "/Users/xxx/axhost-make/projects" } }
```

### POST /api/export
导出项目到本地目录。

```
Body: {
  projectName: "名称",
  targetDir: "/path/to/export",
  selectedPages: ["hash1", "hash2"],
  selectedComponents: ["hash3"],
  selectedFlowcharts: ["hash4"]
}
Response: { code: 0, data: { path: "..." } }
```

### POST /api/export/publish
发布项目到 AxHost 远程服务器。

```
Body: {
  serverUrl: "https://axhost.example.com",
  token: "bearer-token",
  remoteProjectId: "abc123",
  projectName: "名称",
  selectedPages: [...], selectedComponents: [...], selectedFlowcharts: [...]
}
Response: { code: 0, data: <upload response> }
```

流程：准备导出 → zip 打包 → upload 到 `{serverUrl}/api/projects/{id}/update-file` → 清理临时文件

---

## 工具接口

### POST /api/open-editor
在外部编辑器中打开项目。

```
Body: { editor: "vscode"|"cursor"|"trae", filePath?: "相对于 projectRoot 的路径" }
Response: { code: 0, message: "opened" }
```

### POST /api/terminal/open
打开终端并 cd 到项目目录。平台自适应选择终端（WSL/PowerShell/Terminal/gnome-terminal 等）。

### POST /api/terminal/open-wsl
在 WSL 中打开项目目录（仅 Windows 有效）。

### POST /api/axhost-proxy
通用 HTTP 代理，用于前端调用 AxHost 远程 API（解决浏览器 CORS）。

```
Body: { serverUrl, path, method, headers, body }
Response: 代理响应的原始内容
```

---

## 附件与缓存

### POST /api/upload-image
上传图片（Base64）。

```
Body: { name: "screenshot.png", mimeType: "image/png", data: "base64..." }
Response: { code: 0, path: "cache/prompt/images/20250401_143000_123.png" }
```

### POST /api/cache-file-delete
删除缓存文件。

```
Body: { path: "cache/prompt/images/xxx.png" }
Response: { code: 0, message: "deleted" }
```

缓存文件在 1 小时后自动清理（`cache-cleanup.js` 中 10 分钟间隔的定时器）。
