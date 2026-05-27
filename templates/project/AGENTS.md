# Agents

## Axhost-Make

本地优先、Agent 驱动的原型框架。原生 HTML5 + CSS3 + JavaScript（ES6），无构建工具。你当前工作在 `projects/{hash}/` 项目目录下，原型文件位于 `prototype/`。

## 核心规则

1. **阅读上下文**：修改前必须阅读当前页面的 `index.html` 源码和 `docs/readme.md` 文档，以及路由表中指向的规范文件。
2. **只改本项目**：仅修改 `prototype/` 内文件，**禁止**修改 `axhost-make/` 框架源码。
3. **原生技术栈**：禁止引入 Vue/React/Angular 等框架（除非用户明确要求且仅限单页面）。
4. **完整输出**：输出修改后的**完整文件内容**，不输出 diff 片段。
5. **相对路径**：所有资源引用必须使用相对路径，**禁止**使用 `/prototype/` 开头的绝对路径（部署在子目录时会 404）。
6. **容器加 id**：独立区块容器元素必须添加有意义的 `id`，方便后续精确定位。
7. **精准修改**：只修改与需求相关的文件，不重构未涉及的部分。
8. **Git 安全**：未经允许禁止 `git push`、`git reset`、`git rebase`。不跳过 hooks。禁止删除用户数据。
9. **维护索引**：新增/删除/重大变更组件后，**必须**更新项目根目录下的 `COMPONENTS.md`；新增/删除/重大变更公共资源后，**必须**更新项目根目录下的 `RESOURCES.md`。

## 目录规则

**工作区布局**

```
{workspace}/
├── axhost-make/              ← 框架目录（只读，禁止修改）
│   └── system-rules/         ← 框架规范文件
└── projects/
    └── {hash}/               ← 项目目录（本 AGENTS.md 所在目录）
        ├── prototype/
        │   ├── pages/
        │   ├── components/
        │   └── resources/
        ├── RESOURCES.md
        ├── COMPONENTS.md
        └── rules/
```

- **项目目录** = 本 AGENTS.md 所在的目录（`{workspace}/projects/{hash}/`），你要修改的文件都在这里
- **框架目录** = `{workspace}/axhost-make/`

> **路径解析铁律**：下文所有 `../../axhost-make/` 开头的路径，**必须以项目目录为起点**拼接。无论你当前 `cd` 到了哪个子目录，读取框架文件时请先定位到 AGENTS.md 所在目录，再拼接相对路径。**禁止**从 `prototype/pages/xxx/` 等子目录直接拼接 `../../axhost-make/`，那样会解析到错误的 `prototype/axhost-make/`。

## 路径速查

| 资源类型 | 存放位置 | 页面内引用方式 |
|---------|---------|-------------|
| 页面私有 JS/CSS | `pages/{hash}/resources/` | `resources/js/xxx.js` |
| 组件私有 JS/CSS | `components/{hash}/resources/` | `resources/js/xxx.js`（组件内） |
| 框架 Shell 资源 | `/client/`（dev 模式由框架提供） | 无需手动引用，导出时框架自动打包并重写路径 |
| 项目公共资源 | `prototype/resources/` | `../../resources/js/xxx.js`（从 pages 下引用） |
| 框架系统规则 | `../../axhost-make/system-rules/` | 只读，禁止修改 |

> **框架 Shell 资源**：shell.css、icon-loader-shell.js、marked.min.js 等框架运行时文件，dev 模式下由 `/client/` 统一提供，导出/发布时框架自动打包并重写路径，页面开发无需关心。`resources/` 存放项目自己的公共资源（跨页面复用的 CSS/JS/组件），由开发者维护。
>
> **icon-loader.js**：`prototype/resources/js/icon-loader.js`，原型页面使用的图标加载器。由 `init`/`update` 自动创建空文件，Agent 按需填入加载逻辑。
>
> **navigate.js**：`prototype/resources/js/navigate.js`，页面间导航工具。提供 `window.AxUtils.navigate(hash, tab)` 方法，通过 `postMessage` 通知 Shell 切换页面，保持目录树同步。由 `init`/`update` 自动创建，无需手动维护。

目录名为 8 位 hash（人类不可读），用 CLI 获取映射，**禁止**手动 `ls prototype/pages/` 猜测结构。

页面/组件/流程图的内部结构：

```
{page|component}/{hash}/
├── index.html
├── resources/{css/,js/}
└── docs/readme.md

flowchart/{hash}/
├── index.html        ← thin wrapper（引用公共资源，不改）
└── diagram.mmd       ← Mermaid 源码（只改这个）
```

- dir 节点是逻辑分组，无物理目录，仅存在于 `sitemap.js`。
- 页面级资源（仅该页面使用）→ 页面 `resources/` 下；跨页面共享 → `prototype/resources/` 下。
- 框架 Shell 资源（shell.css、icon-loader-shell.js 等）dev 模式下由 `/client/` 统一提供，导出时自动打包，页面开发无需关心。

## 按需阅读

> **路径起点**：以下 `../../axhost-make/` 路径均以**项目目录**（AGENTS.md 所在目录）为起点。
> 读取时请从项目目录出发，不要从 `prototype/pages/xxx/` 深处直接拼 `../../`。

| 场景 | 文件（以项目目录为起点） |
|------|------|
| **开始任何工作前** | 本项目 `RESOURCES.md`、`COMPONENTS.md`、`rules/design.md` |
| **所有原型开发** | `../../axhost-make/system-rules/dev-spec.md` |
| **创建/复用组件** | `../../axhost-make/system-rules/components-spec.md` |
| **手机端/小程序原型** | `../../axhost-make/system-rules/mobile-frame-spec.md` |
| **编写项目文档** | `../../axhost-make/system-rules/doc-format-spec.md` |
| 项目自定义规则 | 本项目 `rules/*.md`（如存在） |

## 样式与脚本

- 采用原生 HTML/JS/CSS。CSS 优先内嵌 `<style>` 或页面私有 `resources/css/style.css`；JS 优先内嵌 `<script>` 或 `resources/js/main.js`。
- 保持中文文案，注释也使用中文。

## CLI 速查

```bash
node axhost-make/bin/axhost-make.js list                      # 页面映射
node axhost-make/bin/axhost-make.js path <hash>               # 绝对路径
node axhost-make/bin/axhost-make.js add-page <name> [--parent <hash>]
node axhost-make/bin/axhost-make.js add-component <name> [--parent <hash>]
node axhost-make/bin/axhost-make.js add-folder <name> [--parent <hash>]
node axhost-make/bin/axhost-make.js add-doc <name> --to <hash>
```

## 跨项目参考

以当前项目目录为起点，通过相对路径读取其他项目（只读，不修改）：

```
../{project_hash}/prototype/pages/{hash}/index.html
```

## 修改后

1. 告知用户修改了哪些文件、各文件主要改动点。
2. 若涉及公共资源（`prototype/resources/`）的增删或重大变更，更新项目根目录 `RESOURCES.md`。
3. 若涉及组件（`prototype/components/`）的增删或重大变更，更新项目根目录 `COMPONENTS.md`。
4. 询问是否需要 Git 提交。若用户确认：`git add -A` → `git commit -m "..."`。
5. 自检：路径拼写正确、资源引用匹配、浏览器可打开、未破坏已有功能。

## Compaction 恢复

触发 compaction 后，收到 `/restart` 或 `重新开始` 指令时，重新阅读本文件及路由表中的规范，然后告知：

> 已重新加载上下文，让我们继续任务。
