# 架构评审报告

> 2026-05-15，基于完整代码阅读的评审

## 最需要改进

### 1. Sitemap 读-改-写缺乏并发保护

`server/api/` 下几乎所有写操作（create、rename、delete、move、copy）都是同一模式：`readSitemap()` → 内存修改 → `writeSitemap()`。Node.js 单线程但异步 I/O，两个请求的 `req.on('end')` 回调可能交替执行各自的读-改-写，导致后写覆盖先写。同时 `_map` 字段靠人工维护，与树结构容易不一致。

**建议：** 引入一个简单的写锁（Promise 队列），或将 sitemap 操作集中到一个模块，所有写操作排队执行。

### 2. Sitemap 与 .axhost-meta.json 双写冗余

`name`、`parentId`、`page_type` 在 `sitemap.js` 和每个目录的 `.axhost-meta.json` 中各存一份。`rename.js` 和 `move.js` 需要同时更新两处，`scan.js` 的 `scanFlat()` 还直接从 `.axhost-meta.json` 读取而不是 sitemap。两者不可避免会漂移。

**建议：** 明确 sitemap.js 为唯一数据源，废弃 `.axhost-meta.json` 中的冗余字段（只保留 sitemap 无法覆盖的），或反过来让 sitemap 完全从 `.axhost-meta.json` 派生。

### 3. Client 端代码大量重复

`preview-app.js`（920 行）与 `shell.js` 生态重复了触控模拟、面板拖拽、缩放控制、键盘快捷键、Markdown 渲染的几乎全部逻辑。`prompt-box.js` 和 `doc-panel.js` 中的自动补全逻辑（caret 坐标计算、dropdown 管理、scan 数据拉取）也是独立实现的同一套模式。

**建议：** 将共享逻辑抽成独立模块（如 `touch-emulation.js`、`autocomplete.js`、`resizer.js`），preview 和 dev 模式共同引用。

### 4. router.js 是巨型 if-else 链

25+ 个 `if (urlPath === '/api/xxx' && req.method === 'GET')` 串行判断，加一个 API 就得改 router。方法+路径的组合散落在条件里难以一览。

**建议：** 改为路由表 + 简单匹配。

---

## 可改可不改

- **无请求日志** — 调试全靠 `console.error`，没有访问日志或请求耗时统计
- **输入验证不统一** — 每个 handler 自己做 `JSON.parse` + 字段检查，没有公共的验证/解析层
- **`createItem` 函数过长** — ~200 行承担了 hash 生成、目录创建、模板替换、sitemap 更新、flowchart 特殊处理等全部职责
- **CSS 单文件 2200+ 行** — `shell.css` 可以按区域拆分为 `nav.css`、`doc-panel.css`、`prompt.css` 等
- **无自动化测试** — 零覆盖，全靠手动验证
- **`regenerateSitemap` 存在但未挂载路由** — 是一个隐藏的维护工具，要么暴露为 API，要么移入 CLI
