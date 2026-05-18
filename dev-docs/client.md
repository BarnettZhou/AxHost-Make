# 客户端设计

## 模块体系

客户端采用 **IIFE + window 全局注册** 模式，无打包器。脚本通过 `<script src>` 按依赖顺序加载。

### 加载顺序（shell.html）

```
1. icon-loader-shell.js → IconPark CDN loader（Shell 宿主使用）
2. inline script     → 设置 window.__axhostProjectId（从 ?project= 参数）
3. marked.min.js     → Markdown 渲染库
4. html-to-image.min.js → 元素截图库
5. api-client.js     → window.apiClient（API 封装）
6. md-renderer.js    → window.mdRenderer（Markdown 扩展）
7. tree-nav.js       → window.treeNav（目录树）
8. doc-panel.js      → window.docPanel（文档面板）
9. export-modal.js   → 独立 IIFE（导出/发布）
10. inspector.js     → 独立 IIFE（元素检查器）
11. prompt-box.js    → window.promptBox（Prompt 构建）
12. inline theme     → 主题切换 + postMessage 同步
13. shell.js         → 总控协调器，设置 window.shell、window.__axhostState
```

## 全局状态

### window.__axhostState（shell.js 定义）
```js
{
  mode: 'dev' | 'preview',
  navVisible: true,         // 左侧导航面板
  docsVisible: false,       // 文档面板
  rightBarVisible: true,    // 右侧 Prompt 面板
  currentPage: {            // 当前选中的页面信息
    type: 'page' | 'component' | 'flowchart',
    path: 'hash',
    pageRelativePath: 'prototype\\pages\\hash',
    pageAbsolutePath: 'D:\\...\\prototype\\pages\\hash'
  },
  currentDoc: null
}
```

### 其他全局变量

| 变量 | 设置者 | 用途 |
|---|---|---|
| `window.__axhostProjectId` | shell.html inline | API 请求的 project 参数 |
| `window.__axhostProjectInfo` | shell.js loadProjectInfo() | 编辑器下拉、Prompt 构建 |
| `window.__axhostSitemap` | 通过 `<script>` 加载 sitemap.js | 仅 preview 模式使用 |
| `window.__axhostPendingDoc` | doc-panel.js | 跨页面文档导航暂存 |
| `window.apiClient` | api-client.js | 所有模块的 API 调用 |
| `window.mdRenderer` | md-renderer.js | Markdown 渲染 |
| `window.treeNav` | tree-nav.js | 目录树 API |
| `window.docPanel` | doc-panel.js | 文档面板 API |
| `window.promptBox` | prompt-box.js | Prompt 面板 API |
| `window.shell` | shell.js | 总控 API（loadPage、exitRuleMode） |

### 全局工具函数（shell.js 挂载）

| 函数 | 说明 |
|---|---|
| `window.showToast(msg, type)` | 浮动提示（info/success/error），2500ms 自动消失 |
| `window.showConfirm(title, content)` | Promise<boolean> 确认对话框 |
| `window.showPrompt(title, placeholder, defaultValue)` | Promise<string\|null> 输入对话框 |

### localStorage 键

| 键 | 值 | 读者 |
|---|---|---|
| `axhost-theme` | "dark" \| "light" | 所有页面 |
| `axhost-server-url` | AxHost 服务地址 | home.js, shell.js |
| `axhost-token` | Bearer token | home.js, shell.js |
| `axhost-user-name` | 用户名 | home.js |
| `axhost-tabs` | JSON 数组 | home.js |
| `axhost-active-tab` | 项目 ID | home.js |
| `axhost-view-mode` | "gallery" \| "list" | home.js |
| `axhost-sort-field` | "lastModified" \| "name" \| "createdAt" | home.js |
| `axhost-sort-dir` | "desc" \| "asc" | home.js |
| `axhost-rules-collapsed` | "true" \| "false" | shell.js |

## 模块详解

### api-client.js
封装所有 API 调用。每个方法返回 Promise，自动附带 `?project=<id>` 参数。错误抛出异常（含服务端错误信息）。

```js
window.apiClient = {
  getScan, getFile, getSettings, getDocs,
  postFile, postCreate, postRename, postPageType, postDelete,
  postReorder, postMove, postCopy, postExport,
  postDocsReorder, postSettings,
  postOpenEditor, postOpenTerminal, postOpenWslTerminal
}
```

### tree-nav.js
**导出：** `window.treeNav = { init, refresh }`  
**内部状态：** `currentTab`, `expandedPaths` (Set), `selectedPath`, `treeData`, `hasAutoLoaded`, `draggedItem`

- `init()` — 渲染 tabs、加载树、绑定 iframe load（同步选中）、drag/drop、contextmenu
- `loadTree(type)` — 调用 `apiClient.getScan(type)`，首次时展开全部节点，递归 DOM 构建
- `buildNode(node, type, level)` — 递归构建 `<li>` 元素，含箭头/图标/文本/click/contextmenu/drag
- `syncTreeFromIframe()` — 解析 iframe URL 中的 `/(pages|components|flowcharts)/(hash)` 同步选中
- 支持 3 种页面类型选择（default/mobile/mini-program）的创建对话框
- 右键菜单：空白区（新建页面/目录）、目录（新建/复制路径/重命名/删除）、叶子（新建/复制页面/属性/删除）

### doc-panel.js
**导出：** `window.docPanel = { load, isEditing }`  
**内部状态：** `currentDocs[]`, `activeDocIndex`, `isEditMode`, `isPreviewMode`, `loadToken`

- `load(type, pagePath, targetDoc?)` — 加载页面关联的文档列表和内容
- 视图模式：阅读（渲染 Markdown） / 编辑（textarea） / 分屏编辑（textarea + 实时预览）
- 编辑时支持 `@hash/` 和 `#hash/` 文档链接自动补全（两阶段：先选页面/组件，再选文档）
- 文档 CRUD：创建（正则验证名称）、重命名、删除、拖拽排序
- 文档链接点击：同页跳转 / 跨页跳转（通过 `window.__axhostPendingDoc` 暂存目标文档名）

### prompt-box.js
**导出：** `window.promptBox = { updateStatus }`

- `buildPrompt(userText, ...)` — 构建结构化 Markdown Prompt，含页面元数据 + 附件列表
- 剪贴板复制（优先 navigator.clipboard，回退 execCommand）
- 图片粘贴上传：监听 paste 事件 → detect image → upload via `/api/upload-image` → 缩略图管理
- `@` / `#` 自动补全：加载 scan 数据（缓存），键盘导航，替换为 `@pages/hash(name)` 格式

### inspector.js
无 window 导出，独立 IIFE。

- 注入样式和 overlay 到 iframe document
- hover 时显示元素边界，click 锁定并弹出详情（tag/id/class/尺寸/字号）
- 操作按钮：选中父元素、复制 CSS 选择器、复制为图片（html-to-image）
- 主题色从 host document 的 CSS 变量读取

### export-modal.js
无 window 导出，独立 IIFE。

- 两种模式：本地导出（选目录）和远程发布（选 AxHost 项目）
- 树形勾选界面（展开/折叠/全选）
- `doExport()` → `apiClient.postExport()`
- `doPublish()` → POST `/api/export/publish`（服务端 zip + upload）
- 发布前校验：AxHost 地址、Token、托管项目是否已设置

### md-renderer.js
**导出：** `window.mdRenderer = { renderMarkdown, escapeHtml, parseDocLink }`

三个 marked.js 自定义扩展：
1. **彩色文字：** `{#red text}` 或 `{#dc3737 text}` → `<span style="color:...">`
2. **Alert 引用块：** `> [info|success|warning|error|default] text` → `<blockquote class="axhost-alert axhost-alert-type">`
3. **文档链接：** 文件名 → 同页跳转，`@hash/doc.md` → 跨页（page），`#hash/doc.md` → 跨页（component）

## 跨 Frame 通讯

通过 `postMessage` 实现：

| 方向 | type | 用途 |
|---|---|---|
| shell → iframe | `axhost-theme` | 主题同步 |
| iframe → shell | `axhost-navigate` | 页面内导航请求 |
| home → shell iframes | `axhost-theme` | 主题同步到所有已打开的 tab |
| export-modal → parent | `axhost-request-login` | 发布时触发登录 |

## Iframe 预览机制

1. `shell.loadPage(type, pagePath)` 设置 `previewFrame.src = {prototypeBase}/{tab}/{pagePath}/index.html`
2. iframe 加载后，`treeNav.syncTreeFromIframe()` 解析 URL 同步目录树高亮
3. Zoom 通过 CSS `--preview-zoom` 变量控制 `#preview-frame { zoom: var(...) }`（0.75–1.5，7 档）
4. Touch Emulation：注入 `<style>` + `<div>` 到 iframe document，实现拖拽滚动 + 惯性动画
5. Inspector：注入 overlay div + popup 到 iframe document，读取 host CSS 变量保持主题一致

## 键盘快捷键

| 键 | 功能 | 条件 |
|---|---|---|
| `I` | 切换元素检查器 | 开发模式，非禁用状态 |
| `T` | 切换触控模拟 | 始终可用 |
| `D` | 切换文档面板 | 始终可用 |
| `N` | 切换导航栏 | 始终可用 |
| `]` | 切换右侧 Prompt 面板 | 始终可用 |
| `Esc` | 退出检查器 | 检查器激活时 |

快捷键绑定在 host document 和 iframe document 上（每次 iframe 加载时重新绑定）。

## 面板拖拽调整

`.resizer` 元素支持 mousedown 拖拽调整面板尺寸：
- `#panel-nav`（导航栏）：min 180px, max 400px, 水平拖拽
- `#panel-docs`（文档面板）：min 180px, max 1200px, 水平拖拽
- `#panel-right-bar`（右侧栏）：min 180px, max 400px, 水平拖拽
- `#panel-nav-top`（树区域）：min 80px, max (panel-nav 高度 - 80 - 5), 垂直拖拽

拖拽时创建透明 overlay 防止 iframe 捕获事件。
