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

## 目录规则

**项目目录**

- 即本项目所在的目录，也为本 AGENTS.md 文件所在的目录：`{workspace}/projects/{project_hash}/`
- 你当前所需要修改的代码文件也位于项目目录下

**框架目录**

- 框架目录位于 `{workspace}/axhost-make/`，若以项目目录出发，相对位置位于 `../../axhost-make/`
- 框架目录内为 axhost 前后端代码、必要的规则文件（axhost-make/system-rules/）等

## 路径速查

| 资源类型 | 存放位置 | 页面内引用方式 |
|---------|---------|-------------|
| 页面私有 JS/CSS | `pages/{hash}/resources/` | `resources/js/xxx.js` |
| 组件私有 JS/CSS | `components/{hash}/resources/` | `resources/js/xxx.js`（组件内） |
| 框架 Shell 资源 | `prototype/shell-resources/` | `../../shell-resources/js/xxx.js`（只读，禁止修改） |
| 项目公共资源 | `prototype/resources/` | `../../resources/js/xxx.js`（从 pages 下引用） |
| 框架系统规则 | `../../axhost-make/system-rules/` | 只读，禁止修改 |

> **shell-resources vs resources**：`shell-resources/` 存放框架提供的运行时文件（shell.css、icon-loader-shell.js、marked.min.js、preview-app.js 等），由 `axhost-make update` 自动维护，**禁止手动修改**。`resources/` 存放项目自己的公共资源（跨页面复用的 CSS/JS/组件），由开发者维护。

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
- 框架 Shell 资源统一在 `prototype/shell-resources/`，路径与项目资源分离，避免误改。

## 按需阅读

**注意**

- 本节内的相对路径以项目根目录为起点（即本 AGENTS.md 文件所在的目录）

| 场景 | 文件 |
|------|------|
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
2. 询问是否需要 Git 提交。若用户确认：`git add -A` → `git commit -m "..."`。
3. 自检：路径拼写正确、资源引用匹配、浏览器可打开、未破坏已有功能。

## Compaction 恢复

触发 compaction 后，收到 `/restart` 或 `重新开始` 指令时，重新阅读本文件及路由表中的规范，然后告知：

> 已重新加载上下文，让我们继续任务。
