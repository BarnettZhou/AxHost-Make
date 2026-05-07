# Agents

## Axhost-Make 简介

Axhost-Make 是一个**本地优先、Agent 驱动**的原型生成与维护框架。它的核心目标是通过 AI-Agent 直接生成并迭代 HTML/JS/CSS 原型项目，无需引入复杂的前端构建工具。

本项目位于一个多项目工作空间中。工作空间根目录与 `axhost-make/` 框架目录平级，所有项目存放在 `projects/` 目录下，以 8 位 hash 命名（如 `projects/8d55f3fc/`）。你当前的工作目录即为其中一个项目目录。

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

1. **理解上下文**：仔细阅读当前页面的 `index.html` 源码、`docs/readme.md` 文档，以及框架系统规则（`../../axhost-make/rules/`）和项目自定义规则（`rules/`）。
2. **遵循规则**：严格遵守 `agents.md`、框架系统规则（`../../axhost-make/rules/`）和项目自定义规则（`rules/`）中定义的设计规范、代码风格、命名约定。
3. **精准修改**：只修改与需求相关的文件，不要无意义地重构未涉及的部分。
4. **保持完整**：输出修改后的**完整文件内容**，不要只输出 diff 片段。
5. **验证路径**：确保引用路径（如 `<script src="...">`、`<link href="...">`）与当前目录结构匹配。
6. **保存并确认**：修改完成后告知用户修改了哪些文件，并主动询问是否需要在 Git 中提交。

---

## 初次运行

初次在项目工作目录运行 Agent 开始工作时，仔细阅读当前页面的 `index.html` 源码、`docs/readme.md` 文档，以及框架系统规则（`../../axhost-make/rules/`）和项目自定义规则（`rules/`），然后根据用户的指示开始工作。

---

## compaction 后的动作

如果触发了 Agent 的 compaction，遵循用户发送的 `/restart` 或 `重新开始` 指令，重新阅读必要的规范文件（`agents.md`、框架系统规则 `../../axhost-make/rules/`、项目自定义规则 `rules/` 等），在完成阅读后，简单告知用户即可：

```
已重新加载上下文，让我们继续任务
```

---

## CLI 命令速查

> 完整命令说明参考 `skills/axhost-make-cli.md`。

常用命令（在项目目录内执行）：

```bash
# 获取页面映射（目录名为 hash，不可直接阅读）
node axhost-make/bin/axhost-make.js list

# 获取文件绝对路径
node axhost-make/bin/axhost-make.js path <hash>

# 快速创建页面/组件/目录/文档
node axhost-make/bin/axhost-make.js add-page <name> [--parent <hash>]
node axhost-make/bin/axhost-make.js add-component <name> [--parent <hash>]
node axhost-make/bin/axhost-make.js add-folder <name> [--parent <hash>]
node axhost-make/bin/axhost-make.js add-doc <name> --to <hash>
```

---

## 目录结构规范

在修改文件前，请确认你理解以下目录含义：

```
workspace/                 # 工作空间根目录（与 axhost-make/ 平级）
├── axhost-make/           # 框架源码（⚠️ 禁止修改）
├── projects/              # 所有项目存放目录
│   ├── .projects.json     # 项目元数据表（id / name / createdAt / lastModified）
│   └── {hash}/            # 单个项目目录（如 8d55f3fc/）
│       ├── prototype/     # 原型文件根目录
│       │   ├── pages/     # 页面原型（目录名为 8 位 hash）
│       │   ├── components/# 组件原型（目录名为 8 位 hash）
│       │   ├── flowcharts/# 流程图（目录名为 8 位 hash，thin wrapper 结构）
│       │   ├── resources/ # 公共资源（js/css/图片等）
│       │   ├── sitemap.js # 站点地图
│       │   ├── index.html # 独立入口
│       │   └── start.html # 跳转页
│       ├── rules/         # 项目规范文档
│       ├── wiki/          # 项目百科/知识库
│       ├── changelog/     # 变更记录
│       ├── agents.md      # 本文件（Agent 全局规则）
│       └── readme.md      # 项目说明
```

### 页面/组件目录内部结构

**page / component**（有物理目录）：

```
pages/a1b2c3d4/
├── .axhost-meta.json    # { "name": "订单列表", "parentId": null }
├── index.html           # 页面源码
├── resources/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── main.js
└── docs/
    └── readme.md
```

**flowchart**（流程图，thin wrapper 结构）：

```
flowcharts/f1a2b3c4/
├── .axhost-meta.json    # { "name": "用户注册流程", "parentId": null, "kind": "flowchart" }
├── index.html           # thin wrapper，引用公共资源
└── diagram.mmd          # Mermaid 源码
```

flowchart 的 `index.html` 是标准化 thin wrapper，**不要内联 CSS/JS**。统一引用全局公共资源：

```html
<link rel="stylesheet" href="../../resources/flowchart/flowchart.css">
<script src="../../resources/js/mermaid.min.js"></script>
<script src="../../resources/js/icons.js"></script>
<!-- ... -->
<script src="../../resources/flowchart/flowchart.js"></script>
```

流程图的渲染、编辑、缩放、缩略图等交互逻辑全部由 `resources/flowchart/flowchart.js` 提供。Agent 只需要修改 `diagram.mmd` 中的 Mermaid 源码即可。

**dir**（逻辑分组，无物理目录）：

- 仅在 `sitemap.js` 中作为节点存在，不占用文件系统
- 没有 `.axhost-meta.json`、`index.html`、`resources/` 或 `docs/`
- 用于前端树形展示的分组，子节点通过 `parentId` 关联

### 关键原则

- **所有源码修改必须在当前项目的 `prototype/` 内进行**，不要修改 `axhost-make/` 框架源码，除非用户明确要求。
- `axhost-make/` 位于工作空间根目录，与当前项目（`projects/{hash}/`）平级，**绝对禁止**在项目开发过程中修改框架源码。
- 页面级资源（仅该页面使用的 css/js）应放在对应页面的 `resources/` 子目录下。
- 跨页面共享资源应放在 `prototype/resources/` 下。
- **页面/组件的目录名是 8 位 hash**，不要在文件名或路径中使用显示名称。
- **dir 节点是逻辑分组**，没有物理目录，不要尝试在文件系统中创建对应目录。
- **树形顺序由 `sitemap.js` 维护**，不要手动创建 `.axhost-order.json`。

---

## Agent 操作页面规范

### 1. 获取映射信息

**永远不要直接 `ls prototype/pages/` 来猜测页面结构**——目录名是 hash，人类不可读。

操作前请先获取映射：

```bash
# 方式 A：读取轻量级映射文件
node axhost-make/bin/axhost-make.js list

# 方式 B：读取 sitemap.js 中的 _map
cat prototype/sitemap.js | sed 's/window.__axhostSitemap = //' | sed 's/;//' | jq '._map'
```

### 2. 使用 CLI 获取准确路径

修改文件时，使用 `path` 命令获取绝对路径，避免手动拼接出错：

```bash
FILE_PATH=$(node axhost-make/bin/axhost-make.js path a1b2c3d4)
# → /Users/xxx/projects/prototype/pages/a1b2c3d4/index.html
cat "$FILE_PATH"
```

### 3. 名称中可以包含任意字符

由于显示名称存储在 `sitemap.js` 或 `.axhost-meta.json` 中，**页面/目录名称可以包含任意 Unicode 字符**（包括 `/ \ : * ? " < > |` 等），不受文件系统限制。

但建议保持名称简洁，避免使用换行符等特殊控制字符。

---

## 资源文件规范

若需要引入第三方库或共用资源，请遵循以下路径约定：

- **页面私有资源**：`prototype/pages/{hash}/resources/js/xxx.js`
- **全局共享资源**：`prototype/resources/js/xxx.js`
- **flowchart 公共资源**：`prototype/resources/flowchart/flowchart.css`、`prototype/resources/flowchart/flowchart.js`

示例：

```html
<!-- 页面内引用私有资源 -->
<script src="resources/js/mock-data.js"></script>

<!-- 页面内引用全局资源（从 pages/{hash}/index.html 向上回退到 prototype 根目录） -->
<script src="../resources/js/marked.min.js"></script>

<!-- flowchart 引用公共资源（从 flowcharts/{hash}/index.html 向上回退两级） -->
<link rel="stylesheet" href="../../resources/flowchart/flowchart.css">
<script src="../../resources/flowchart/flowchart.js"></script>
```

> **⚠️ 线上托管路径警告**：项目最终可能部署在子目录（如 `/projects/2026xxx/`）中。**禁止**在页面内部使用以 `/prototype/` 开头的绝对路径引用图片、脚本或样式表，否则浏览器会从域名根目录查找资源，导致 404。所有页面级引用全局共享资源时，必须使用相对于当前 HTML 文件的相对路径（如 `../../../resources/images/xxx.png`）。
>
> 在 `prototype/index.html`（独立入口）中引用全局资源时，应使用相对路径 `./resources/...`。

---

## 规则体系（Rules）

本项目存在**两层规则来源**，Agent 在开发原型时需按需查阅：

### 1. 框架系统规则（`axhost-make/rules/`）

位于框架根目录，是**所有项目共享的通用规范**。开发原型前请根据需求选择性阅读：

| 规则文件 | 概述 | 必读场景 |
|---------|------|---------|
| `../../axhost-make/rules/dev-spec.md` | 图标加载规范（`icon-loader.js` 实现、CDN 选择）、页面跳转规范（`postMessage` 导航） | 所有原型开发 |
| `../../axhost-make/rules/components-spec.md` | 组件设计原则、页面复用组件原则、组件文档要求 | 创建/复用组件 |
| `../../axhost-make/rules/mobile-frame-spec.md` | 手机容器规格（`375×812`）、Class 命名、小程序外壳（状态栏 / 导航栏 / Home Indicator） | 手机端 / 小程序原型 |

### 2. 项目自定义规则（本项目 `rules/`）

由项目自行维护，存放项目特定的设计规范、业务约定或补充规则。若本项目 `rules/` 目录下有文件，请在开发前阅读。

---

## 修改流程与最佳实践

### 1. 读取上下文

每次修改前，请确认已阅读：

- `agents.md`（本文件）
- 框架系统规则（`../../axhost-make/rules/` 下与当前需求相关的文件）
- 项目自定义规则（本项目 `rules/*.md`，如存在）
- 当前页面的 `prototype/{type}s/{hash}/index.html`
- 当前页面的 `prototype/{type}s/{hash}/docs/readme.md`

### 2. 理解需求边界

- 如果用户只要求"修改表格样式"，不要顺便重构整个页面的 DOM 结构。
- 如果用户说"参考 wiki/xxx.md"，请优先读取该 wiki 文件。

### 3. 输出要求

- **必须输出完整文件内容**，使用代码块包裹。
- 在代码块前明确标注文件路径，例如：

  ```
  文件：prototype/pages/a1b2c3d4/index.html
  ```

### 4. 样式与脚本规范

- 采用原生 HTML/JS/CSS，**禁止引入 Vue/React/Angular 等框架**（除非用户明确要求且仅限单个页面内部）。
- CSS 优先使用内嵌 `<style>` 或页面私有 `resources/css/style.css`。
- JavaScript 优先使用内嵌 `<script>` 或页面私有 `resources/js/main.js`。
- 保持中文文案，注释也使用中文。
- **容器元素必须添加 id**：编写 HTML 时，若某个 `div`、`section`、`article`、`nav`、`aside`、`header`、`footer` 等元素是一个**独立组件/区块的容器**（如导航栏、表格区域、表单、卡片列表、弹窗、侧边栏等），**务必为其添加一个有意义的 `id`**。这让 LLM 在后续迭代中通过 `id` 快速精准定位目标元素，避免大面积搜索和误改无关 DOM。

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
- **禁止**在工作空间根目录或 `axhost-make/` 目录内创建/修改文件（除非你正在维护框架本身）。
- **禁止**引入不必要的 npm 依赖或构建工具。
- **禁止**删除用户的测试数据、mock 数据或文档，除非需求明确要求替换。

---

## 提示

如果你在上下文中已经读取了 `agents.md` 和 `rules/` 的内容，则无需重复读取。你可以直接基于已有上下文和用户的最新 Prompt 开始修改。
