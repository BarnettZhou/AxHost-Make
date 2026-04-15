# Axhost-Make

> 通过本地 AI-Agent 直接生成并维护原型项目的轻量框架。

Axhost-Make 是一套**本地优先、Agent 驱动**的原型开发工具。它提供一个基于 Node.js 的本地 Dev Server，以及一个浏览器端的工作台壳（Shell），让你在统一的界面中预览原型、管理文档、一键拼接 Prompt 并复制给外部 Agent。

---

## 核心特性

- **零前端框架依赖**：使用原生 HTML / CSS / JavaScript，降低 LLM 生成与维护成本。
- **开发 / 预览双模式**：开发模式带 Prompt 输入和文档编辑；预览模式仅用于展示。
- **动态目录树**：自动扫描 `prototype/pages` 和 `prototype/components`，无需手写 sitemap。
- **文档一体**：右侧文档面板自动加载当前页面的 `docs/*.md`，支持渲染和编辑保存。
- **Prompt 一键复制**：自动拼接 `agents.md`、`rules/*.md`、当前页面源码和文档，生成可直接给 Agent 的完整提示词。
- **快速创建页面/组件**：通过右键菜单新建目录、页面或组件，自动生成标准化模板。
- **独立入口**：同时生成 `prototype/index.html`，可直接通过任意静态服务器访问原型项目。

---

## 初始化项目

### 通过你的 Agent 快速开始（推荐）

新建一个空目录作为项目目录，在目录下打开你的 Agent，例如

```bash
mkdir -p workspace/prototype-project && cd workspace/prototype-project
claude
```

在您的 Agent 中输入如下 Prompt

```
请遵循如下文件的内容在当前目录初始化 AxHost Make：

https://raw.githubusercontent.com/BarnettZhou/AxHost-Make/refs/heads/master/install/install-for-empty-folder.md
```

发送 Prompt 后等待安装完成即可。

### 通过你的 Agent 迁移已有 HTML 项目

如果你已经有一个现成的 HTML 项目，需要先**将其放到一个全新的空目录中**，并将这个空目录作为项目目录。例如：

```bash
mkdir -p workspace/my-html-project
cp -r /path/to/your/html-project workspace/my-html-project/
cd workspace/my-html-project
claude
```

确保当前目录下只有一个子目录（即你的 HTML 项目），然后输入如下 Prompt：

```
请遵循如下文件的内容将当前目录的 HTML 项目迁移为 AxHost Make 项目：

https://raw.githubusercontent.com/BarnettZhou/AxHost-Make/refs/heads/master/install/install-with-html-project.md
```

发送 Prompt 后等待迁移完成即可。

### 通过源代码安装

确保本地已安装 **Node.js >= 22** 以及 **Git**。

新建一个空目录作为项目目录，在目录中 clone 核心代码

```bash
mkdir -p workspace/prototype-project && cd workspace/prototype-project
git clone https://github.com/BarnettZhou/AxHost-Make.git
```

然后在项目根目录下运行初始化命令：

```bash
node axhost-make/bin/axhost-make.js init
```

`init` 会自动创建以下目录和文件：

```
rules/
changelog/
changelog/raw/
memory/
wiki/
wiki/raw/
wiki/pages/
prototype/
prototype/resources/
prototype/resources/js/
prototype/resources/css/
prototype/components/
prototype/pages/
prototype/index.html       # 独立入口（含左侧树导航 + 文档面板）
prototype/start.html       # 自动跳转页
prototype/sitemap.js       # 自动扫描生成的站点地图
agents.md                  # Agent 全局规则（若不存在）
readme.md                  # 项目说明（若不存在）
```

---

## 启动服务

### 开发模式（推荐）

```bash
node axhost-make/bin/axhost-make.js serve [--port <number>]
```

默认端口为 `3820`，服务仅绑定 `127.0.0.1`。

启动后可通过以下地址访问：

| 地址 | 说明 |
|------|------|
| `http://localhost:3820` | **开发模式**（完整功能：导航 + iframe + 文档 + Prompt） |
| `http://localhost:3820/client/preview.html` | **预览模式**（仅导航 + iframe + 文档，无编辑和 Prompt） |
| `http://localhost:3820/prototype/index.html` | **独立入口**（不依赖 axhost-make API 的静态页面，可用于任意静态服务器） |
| `http://localhost:3820/prototype/start.html` | 自动跳转到 `prototype/index.html` |

### 纯静态预览

如果你只需要一个轻量的静态服务器来预览 `prototype/` 目录：

```bash
node axhost-make/bin/axhost-make.js preview [--port <number>]
```

默认端口为 `8080`，仅提供 `prototype/` 目录的静态文件访问，无 API 和 Shell 功能。

访问地址：`http://localhost:8080/index.html`

### 更新项目入口和样式

当 `axhost-make` 框架自身升级后，如果你希望将最新的独立入口模板、CSS 和 JS 同步到当前项目中：

```bash
node axhost-make/bin/axhost-make.js update
```

- 覆盖 `prototype/index.html` 为最新模板
- 同步 `prototype/resources/css/shell.css` 和 `prototype/resources/js/marked.min.js`
- 重新生成 `prototype/sitemap.js`（保留已设置的项目名称）

---

## 项目目录结构

```
project-root/
├── axhost-make/              # 本框架核心代码
│   ├── bin/
│   │   ├── axhost-make.js    # CLI 入口（serve / init）
│   │   └── axhost-init.js    # 初始化脚本
│   ├── server/
│   │   ├── index.js          # HTTP 服务启动器
│   │   ├── router.js         # 路由分发
│   │   ├── middleware/
│   │   │   ├── static.js     # 静态文件服务
│   │   │   └── cors.js       # 跨域头
│   │   └── api/
│   │       ├── scan.js       # GET /api/scan 目录树扫描
│   │       ├── file.js       # GET/POST /api/file 文件读写
│   │       └── create.js     # POST /api/create 新建页面/组件/目录
│   ├── client/
│   │   ├── index.html        # 开发模式主页面
│   │   ├── preview.html      # 预览模式主页面
│   │   ├── css/shell.css     # 工作台样式
│   │   ├── js/
│   │   │   ├── shell.js      # 壳核心（初始化、iframe、拖拽条）
│   │   │   ├── tree-nav.js   # 左侧树形导航 + 右键新建菜单
│   │   │   ├── doc-panel.js  # 右侧文档面板（渲染/编辑/保存）
│   │   │   ├── prompt-box.js # 底部 Prompt 输入 + 上下文拼接
│   │   │   ├── api-client.js # fetch 封装
│   │   │   └── md-renderer.js# Markdown 渲染封装
│   │   └── assets/
│   │       └── marked.min.js # Markdown 渲染库
│   └── templates/
│       ├── page.html         # 页面模板
│       ├── component.html    # 组件模板
│       ├── doc.md            # 文档模板
│       ├── prototype-index.html  # 独立入口模板
│       └── prototype-start.html  # 跳转页模板
│
├── prototype/                 # 原型文件目录
│   ├── index.html
│   ├── start.html
│   ├── sitemap.js
│   ├── resources/
│   ├── components/
│   └── pages/
│       └── your_page/
│           ├── index.html
│           ├── resources/
│           └── docs/
│               └── readme.md
├── rules/                     # 项目规范文档
├── agents.md                  # Agent 全局规则
└── readme.md                  # 项目说明
```

---

## 使用指南

### 新建页面或组件

1. 在左侧目录树中右键一个文件夹。
2. 选择「新建页面」或「新建目录」（`pages` 目录下）。
3. 选择「新建组件」或「新建目录」（`components` 目录下）。
4. 输入名称后，系统自动生成模板文件和初始文档，左侧树会自动刷新。

### 编辑文档

- 点击页面后，右侧文档面板自动加载 `docs/readme.md` 并渲染为 HTML。
- 点击 **Edit** 进入编辑模式，修改后点击 **Save** 保存到本地文件。

### 使用 Prompt 驱动 Agent 修改

1. 在开发模式底部的输入框中描述修改需求。
2. 点击 **Copy Prompt**。
3. 提示词已自动拼接好：`agents.md` + `rules/*.md` + 当前页面源码 + 当前文档 + 你的需求。
4. 将提示词粘贴给 Kimi / Claude / Trae 等 Agent，Agent 修改文件后刷新页面即可查看。

### 调整面板大小

- **左侧导航**：拖动其右侧的 5px 边框条改变宽度。
- **右侧文档**：拖动其左侧的 5px 边框条改变宽度。
- **底部 Prompt 框**（开发模式）：拖动其上侧的 5px 边框条改变高度。

> 拖拽实现采用全局遮罩层，鼠标经过 iframe 区域也不会丢失焦点。

---

## API 说明

所有 API 均通过 `http://localhost:3820/api/*` 提供：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/scan?type=pages` | GET | 扫描 `prototype/pages` 返回树形 JSON |
| `/api/scan?type=components` | GET | 扫描 `prototype/components` 返回树形 JSON |
| `/api/file?path=...` | GET | 读取指定文件内容 |
| `/api/file` | POST | 保存文件（JSON: `{ path, content }`） |
| `/api/create` | POST | 新建目录/页面/组件（JSON: `{ parentPath, name, kind }`） |

---

## 技术栈

- **后端**：Node.js 内置 `http` + `fs/promises`，**零外部 npm 依赖**
- **前端**：原生 HTML5 / CSS3 / ES6
- **Markdown 渲染**：[marked.js](https://marked.js.org/)

---

## 授权与扩展

Axhost-Make 为内部原型框架，可自由复制和修改以适配团队工作流。未来可扩展方向：

- 接入本地 LLM（如 Ollama）实现页内直接调用 Agent
- 增加源码编辑器（CodeMirror / Monaco）替代 Prompt Copy 流程
- 支持多项目工作区切换
