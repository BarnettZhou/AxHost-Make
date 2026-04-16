# Agents

## Axhost-Make 简介

Axhost-Make 是一个**本地优先、Agent 驱动**的原型生成与维护框架。它的核心目标是通过 AI-Agent 直接生成并迭代 HTML/JS/CSS 原型项目，无需引入复杂的前端构建工具。

本项目的所有原型文件存放在 `prototype/` 目录下，采用原生 HTML5 + CSS3 + JavaScript（ES6）技术栈。Agent 的核心工作是根据用户的自然语言描述，直接读取和修改 `prototype/` 下的源码文件及对应文档。

### 核心工作流

1. 用户在 Axhost-Make 的开发模式 Shell 中查看原型页面。
2. 用户在 Prompt Box 中输入修改需求，复制后交给 Agent（如 Kimi）。
3. Agent 读取当前页面源码、文档、项目规则，生成修改后的文件内容。
4. Agent 直接覆盖保存到本地文件系统。
5. 用户刷新浏览器即可查看效果。

---

## 项目依赖

在操作本项目之前，请确保环境满足以下条件：

- **Node.js >= 22**：用于启动本地开发服务和执行初始化脚本。
- **Git**：用于版本管理和变更提交（可选但强烈推荐）。

---

## 你的职责

当用户给出 Prompt 时，你需要：

1. **理解上下文**：仔细阅读当前页面的 `index.html` 源码、`docs/readme.md` 文档，以及 `rules/` 下的规范文件。
2. **遵循规则**：严格遵守 `agents.md` 和 `rules/` 中定义的设计规范、代码风格、命名约定。
3. **精准修改**：只修改与需求相关的文件，不要无意义地重构未涉及的部分。
4. **保持完整**：输出修改后的**完整文件内容**，不要只输出 diff 片段。
5. **验证路径**：确保引用路径（如 `<script src="...">`、`<link href="...">`）与当前目录结构匹配。
6. **保存并确认**：修改完成后告知用户修改了哪些文件，并主动询问是否需要在 Git 中提交。

---

## 可用命令行命令

### serve — 启动开发环境

```bash
node axhost-make/bin/axhost-make.js serve [--port <number>]
```

- 默认端口为 **3820**，仅绑定 `127.0.0.1`。
- 提供完整的开发模式工作台（含左侧目录树、中间 iframe 预览、右侧文档面板、底部 Prompt 框）。
- 若端口被占用，请手动指定其他端口（如 `--port 3821`）。

> **重要**：`serve` 是前台阻塞进程。如果你需要帮用户启动服务，请在后台运行：
> - **Windows**：`Start-Process node -ArgumentList "axhost-make/bin/axhost-make.js","serve"`
> - **macOS/Linux**：`node axhost-make/bin/axhost-make.js serve &`
> - 或者通知用户自行在独立终端中运行。

### preview — 启动纯静态预览

```bash
node axhost-make/bin/axhost-make.js preview [--port <number>]
```

- 默认端口为 **8080**，仅绑定 `127.0.0.1`。
- 这是一个轻量静态服务器，直接 serve `prototype/` 目录。
- 适用于模拟托管平台（如 GitHub Pages、OSS）的访问效果，无 API 和编辑功能。
- 若端口被占用，请手动指定其他端口（如 `--port 8081`）。

> **重要**：`preview` 同样是前台阻塞进程。后台运行方式与 `serve` 相同。

### init — 初始化项目

```bash
node axhost-make/bin/axhost-make.js init
```

- 自动创建项目所需的标准目录结构（`prototype/`、`rules/`、`wiki/`、`changelog/` 等）。
- 自动扫描 `prototype/pages/` 和 `prototype/components/`，生成 `prototype/sitemap.js`。
- 生成 `prototype/index.html`（独立入口）和 `prototype/start.html`（跳转页）。
- 若 `agents.md` 或 `readme.md` 不存在，会自动创建默认模板。

### update — 更新项目入口和样式

```bash
node axhost-make/bin/axhost-make.js update
```

- 将最新的 `prototype/index.html` 模板、CSS（`shell.css`）、JS（`marked.min.js`）同步到当前项目的 `prototype/` 下。
- 重新生成 `prototype/sitemap.js`，同时**保留已设置的项目名称**。
- 适用于 `axhost-make` 框架升级后，修复或更新独立入口和样式。

---

## 目录结构规范

在修改文件前，请确认你理解以下目录含义：

```
project-root/
├── prototype/           # 原型文件根目录
│   ├── pages/           # 页面原型
│   ├── components/      # 组件原型
│   ├── resources/       # 公共资源（js/css/图片等）
│   ├── index.html       # 独立入口（左侧导航 + iframe 预览）
│   ├── start.html       # 自动跳转到 index.html
│   └── sitemap.js       # 站点地图（含 pages、components、name）
├── rules/               # 项目规范文档
│   ├── global.md        # 全局规则
│   ├── design-spec.md   # UI 设计规范
│   ├── dev-spec.md      # 原型页面开发规范
│   └── glossary.md      # 术语表
├── wiki/                # 项目百科/知识库
│   ├── raw/             # 原始需求文档
│   └── pages/           # 整理后的 wiki 页面
├── changelog/           # 变更记录
├── agents.md            # 本文件（Agent 全局规则）
└── readme.md            # 项目说明
```

### 关键原则

- **所有源码修改必须在 `prototype/` 内进行**，不要修改 `axhost-make/` 框架源码，除非用户明确要求。
- 页面级资源（仅该页面使用的 css/js）应放在对应页面的 `resources/` 子目录下。
- 跨页面共享资源应放在 `prototype/resources/` 下。

---

## 资源文件规范

若需要引入第三方库或共用资源，请遵循以下路径约定：

- **页面私有资源**：`prototype/pages/{page_name}/resources/js/xxx.js`
- **全局共享资源**：`prototype/resources/js/xxx.js`

示例：

```html
<!-- 页面内引用私有资源 -->
<script src="resources/js/mock-data.js"></script>

<!-- 页面内引用全局资源 -->
<script src="/prototype/resources/js/marked.min.js"></script>
```

> 注意：在 `prototype/index.html`（独立入口）中引用全局资源时，应使用相对路径 `./resources/...`。

---

## 修改流程与最佳实践

### 1. 读取上下文

每次修改前，请确认已阅读：

- `agents.md`（本文件）
- `rules/*.md`（如存在）
- 当前页面的 `prototype/{type}s/{path}/index.html`
- 当前页面的 `prototype/{type}s/{path}/docs/readme.md`

### 2. 理解需求边界

- 如果用户只要求"修改表格样式"，不要顺便重构整个页面的 DOM 结构。
- 如果用户说"参考 wiki/xxx.md"，请优先读取该 wiki 文件。

### 3. 输出要求

- **必须输出完整文件内容**，使用代码块包裹。
- 在代码块前明确标注文件路径，例如：

  ```
  文件：prototype/pages/dashboard/index.html
  ```

### 4. 样式与脚本规范

- 采用原生 HTML/JS/CSS，**禁止引入 Vue/React/Angular 等框架**（除非用户明确要求且仅限单个页面内部）。
- CSS 优先使用内嵌 `<style>` 或页面私有 `resources/css/style.css`。
- JavaScript 优先使用内嵌 `<script>` 或页面私有 `resources/js/main.js`。
- 保持中文文案，注释也使用中文。

### 5. 修改后验证清单

- [ ] 文件路径正确，无拼写错误。
- [ ] 引用的资源路径（`src`、`href`）与当前文件位置匹配。
- [ ] 页面在浏览器中可直接打开，无报错。
- [ ] 未破坏已有的交互逻辑和数据结构。

---

## Git 工作流

完成修改并保存到本地文件后，请执行以下步骤：

1. **告知用户修改摘要**：
   - 修改了哪些文件？
   - 每个文件的主要改动点是什么？给出摘要即可，无需全部展示

2. **询问是否提交**：

   ```
   修改已完成。是否需要在 Git 中提交本次变更？
   ```

3. 若用户确认提交：
   - 执行 `git add -A`
   - 执行 `git commit -m "描述本次修改"`
   - 告知提交成功。

---

## 禁止事项

- **禁止**在未经用户允许的情况下执行 `git push`、`git reset`、`git rebase` 等远程/危险操作。
- **禁止**修改 `axhost-make/` 目录下的框架源码，除非用户明确要求。
- **禁止**在项目根目录外创建或修改文件。
- **禁止**引入不必要的 npm 依赖或构建工具。
- **禁止**删除用户的测试数据、mock 数据或文档，除非需求明确要求替换。

---

## 提示

如果你在上下文中已经读取了 `agents.md` 和 `rules/` 的内容，则无需重复读取。你可以直接基于已有上下文和用户的最新 Prompt 开始修改。
