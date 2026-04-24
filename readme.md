# Axhost-Make

> 通过本地 AI-Agent 直接生成并维护原型项目的轻量框架。

Axhost-Make 是一套**本地优先、Agent 驱动**的原型开发工具。它提供一个基于 Node.js 的本地 Dev Server，以及一个浏览器端的工作台壳（Shell），让你在统一的界面中管理多个项目、预览原型、管理文档、一键拼接 Prompt 并复制给外部 Agent。

---

## 安装与初始化

确保本地已安装 **Node.js >= 22** 以及 **Git**。

### 方式一：通过 Agent 快速开始（推荐）

新建一个空目录作为项目目录，在目录下打开你的 Agent，例如：

```bash
mkdir -p workspace/prototype-project && cd workspace/prototype-project
claude
```

在您的 Agent 中输入如下 Prompt：

```
请遵循如下文件的内容在当前目录初始化 AxHost Make：

https://raw.githubusercontent.com/BarnettZhou/AxHost-Make/refs/heads/master/install/install-for-empty-folder.md
```

发送 Prompt 后等待安装完成即可。

### 方式二：通过 Web UI 创建（推荐）

1. 克隆核心代码到任意位置：
   ```bash
   git clone https://github.com/BarnettZhou/AxHost-Make.git axhost-make
   ```

2. 进入你期望的**工作空间目录**（该目录下将存放多个项目子目录）：
   ```bash
   mkdir -p ~/workspace && cd ~/workspace
   node /path/to/axhost-make/bin/axhost-make.js serve
   ```

3. 打开 `http://localhost:3820`，在项目管理首页点击 **「新建原型项目」** 即可创建并自动打开项目。

> **提示**：你也可以直接在单个项目目录内运行 `serve`，框架会自动识别其父目录为工作空间。

### 方式二：通过 CLI 初始化工作空间

新建一个空目录作为项目目录，在该目录下执行命令初始化空间，例如：

```bash
mkdir -p workspace/prototype-project && cd workspace/prototype-project
git clone https://github.com/BarnettZhou/AxHost-Make.git axhost-make
node axhost-make/bin/axhost-make.js init
```

`init` 会检查父级目录下是否仅有 `axhost-make` 目录，确认后自动在工作空间创建以下目录和文件：

```
projects/                  # 项目存放目录
projects/.projects.json    # 项目元数据表（id / name / createdAt / lastModified）
package.json               # 方便运行 npm 命令
start.cmd / start.ps1      # Windows 双击启动脚本
start.sh                   # Linux/mac 启动脚本
```

初始化完成后会提示是否立即启动服务，输入 `y` 并回车即可通过 `serve` 命令启动。

---

## 启动服务

### 方式一：双击启动脚本（Windows 推荐）

初始化后工作空间根目录会生成 `start.cmd`，**直接双击即可启动服务**。窗口保持打开状态即为服务运行中，关闭窗口即停止服务。

> macOS / Linux 用户可运行 `./start.sh` 启动。

### 方式二：命令行启动

```bash
node axhost-make/bin/axhost-make.js serve [--port <number>]
```

默认端口为 `3820`，服务仅绑定 `127.0.0.1`。

启动后可通过以下地址访问：

| 地址 | 说明 |
|------|------|
| `http://localhost:3820` | **项目管理首页**（项目列表、搜索、新建/导入） |
| `http://localhost:3820/shell.html?project=xxx` | **单项目开发模式**（导航 + iframe + 文档 + Prompt） |
| `http://localhost:3820/client/preview-index.html` | **Preview 模式实时预览**（开发时直接查看 preview 效果，无需 build） |
| `http://localhost:3820/projects/xxx/prototype/index.html` | **独立入口 / 预览模式**（不依赖 axhost-make API 的静态页面） |

### 纯静态预览

如果你只需要一个轻量的静态服务器来预览某个项目的 `prototype/` 目录：

```bash
node axhost-make/bin/axhost-make.js preview [--port <number>]
```

默认端口为 `8080`，仅提供 `prototype/` 目录的静态文件访问，无 API 和 Shell 功能。

访问地址：`http://localhost:8080/index.html`

### 更新项目入口和样式

当 `axhost-make` 框架自身升级后，如果你希望将最新的独立入口模板、CSS 和 JS 同步到项目中：

```bash
# 更新指定项目
node axhost-make/bin/axhost-make.js update --id <hash>

# 批量更新所有项目
node axhost-make/bin/axhost-make.js update --all
```

- 覆盖 `prototype/index.html` 为最新模板
- 同步 `prototype/resources/css/shell.css` 和 `prototype/resources/js/marked.min.js` 等公共资源
- 重新生成 `prototype/sitemap.js`（保留已设置的项目名称）

### 构建独立入口模板

如果你在维护 `axhost-make` 框架本身，并修改了 `client/preview-index.html`、`shell.css`、`icons.js` 或 `preview-app.js`，需要先重新生成 `templates/preview/index.html`：

```bash
node axhost-make/bin/axhost-make.js build
```

`build` 命令会：
- 读取 `client/preview-index.html`
- 把路径从 `/client/...` 和 `/prototype/...` 转换为 `./resources/...` 和 `./...`
- 将 `shell.css`、`icons.js`、`preview-app.js` 复制到 `templates/preview/resources/`
- 生成引用外部资源的瘦版 `templates/preview/index.html`

> **注意**：普通项目使用者通常无需直接运行 `build`。修改完框架源码后，运行 `build` 再运行 `update`，即可将最新模板同步到项目中。

---

## 核心特性

- **零前端框架依赖**：使用原生 HTML / CSS / JavaScript，降低 LLM 生成与维护成本。
- **多项目工作区管理**：通过 `home.html` 管理多个原型项目，支持搜索、排序、画廊/列表双视图。
- **开发 / 预览双模式**：开发模式带 Prompt 输入和文档编辑；预览模式仅用于展示。
- **动态目录树**：自动扫描 `prototype/pages` 和 `prototype/components`，无需手写 sitemap。
- **文档一体**：右侧文档面板自动加载当前页面的 `docs/*.md`，支持渲染和编辑保存。
- **Prompt 一键复制**：自动拼接 `agents.md`、`rules/*.md`、当前页面源码和文档，生成可直接给 Agent 的完整提示词。
- **快速创建页面/组件**：通过右键菜单新建目录、页面或组件，自动生成标准化模板。
- **独立入口**：同时生成 `prototype/index.html`，可直接通过任意静态服务器访问原型项目。
- **导出功能**：支持选择 pages/components 导出为独立可运行包，sitemap 自动按需重写。
- **双击启动脚本**：Windows 下双击 `start.cmd` 即可启动服务，无需打开命令行。

---

## 项目目录结构

```
workspace/                    # 工作空间目录
├── axhost-make/              # 框架核心代码
│   ├── bin/                  # CLI 入口
│   ├── client/               # 前端壳层资源
│   ├── server/               # Node HTTP 服务器
│   └── templates/            # 模板目录
│
├── start.cmd               # Windows 双击启动脚本
├── start.ps1               # PowerShell 启动脚本
├── start.sh                # Linux/mac 启动脚本
├── package.json            # npm 脚本入口
└── projects/               # 项目存放目录（与 axhost-make/ 平级）
    ├── .projects.json      # 项目元数据表（id / name / createdAt / lastModified）
    ├── 184bdd45/           # 项目 A（8 位 hash 目录名）
    │   ├── prototype/
    │   │   ├── index.html
    │   │   ├── start.html
    │   │   ├── sitemap.js
    │   │   ├── resources/
    │   │   ├── components/
    │   │   └── pages/
    │   │       └── your_page/
    │   │           ├── index.html
    │   │           ├── resources/
    │   │           └── docs/
    │   │               └── readme.md
    │   ├── rules/
    │   ├── agents.md
    │   └── readme.md
    └── a1b2c3d4/           # 项目 B（8 位 hash 目录名）
        └── ...
```

> **设计说明**：项目目录名采用 **8 位 hash**（如 `184bdd45/`），与 pages/components 的目录命名方式一致。显示名称、创建时间、最后修改时间统一维护在 `projects/.projects.json` 元数据表中。因此**项目名称可以包含任意字符**（包括 `/ \ : * ? " < > |` 等），不受文件系统限制。

---

## 使用指南

### 项目管理首页

1. 打开 `http://localhost:3820` 进入项目管理首页。
2. 使用搜索框模糊匹配项目名称。
3. 切换排序方式（最近修改时间 / 名称 / 创建时间，升序/降序）。
4. 切换视图模式（画廊 / 列表）。
5. 点击项目卡片进入该项目的开发环境。
6. 点击 **「新建原型项目」** 快速创建空白项目。

### 开发模式中的 Tab 切换

- Header 横向展示已打开的项目 Tab，点击切换。
- 关闭 Tab 会释放对应资源。
- 超过 10 分钟未激活的 Tab 会自动软释放（iframe 卸载）。
- 点击 Home 按钮（🏠）可回到项目管理首页。

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

### 导出项目

1. 在开发模式 header 中点击 **导出** 按钮（下载图标）。
2. 在弹窗中确认项目名称和保存目录。
3. 切换 `pages` / `components` Tab，选择需要导出的页面或组件。
4. 支持「全选」快捷开关；取消全选后可手动勾选特定项。
5. 点击「导出」，框架会将选中内容复制到目标目录，并自动重写 `sitemap.js`。
6. 导出的包包含 `index.html`、`start.html`、`resources/`、选中页面/组件，可直接用任意静态服务器运行。

### 调整面板大小

- **左侧导航**：拖动其右侧的 5px 边框条改变宽度。
- **右侧文档**：拖动其左侧的 5px 边框条改变宽度。
- **底部 Prompt 框**（开发模式）：拖动其上侧的 5px 边框条改变高度。

> 拖拽实现采用全局遮罩层，鼠标经过 iframe 区域也不会丢失焦点。

### 图标规范

框架使用 IconPark 的 `<iconpark-icon>` Web Component 加载图标：

- **引用方式**：开发模式引用 `/client/js/icons.js`，独立入口引用 `resources/js/icons.js`。
- **标签属性**：使用 `icon-id` 指定图标名称，例如 `<iconpark-icon icon-id="moon" size="14"></iconpark-icon>`。
- **颜色控制**：支持 `color`、`stroke`、`fill` 属性。推荐设置 `color="currentColor"` 让图标跟随父级文字颜色。
- **主题适配**：切换暗黑/明亮主题时，框架会自动刷新所有 `iconpark-icon` 的颜色属性。

---

## API 说明

所有 API 均通过 `http://localhost:3820/api/*` 提供：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/projects` | GET | 获取工作空间下的所有项目列表 |
| `/api/projects` | POST | 新建项目（JSON: `{ name }`） |
| `/api/scan?type=pages` | GET | 扫描指定项目的 `prototype/pages` 返回树形 JSON |
| `/api/scan?type=components` | GET | 扫描指定项目的 `prototype/components` 返回树形 JSON |
| `/api/file?path=...` | GET | 读取指定文件内容 |
| `/api/file` | POST | 保存文件（JSON: `{ path, content }`） |
| `/api/create` | POST | 新建目录/页面/组件（JSON: `{ parentPath, name, kind }`） |
| `/api/export` | POST | 导出选中的 pages/components 到指定目录 |
| `/api/export/default-dir` | GET | 获取默认导出目录（Windows 真实 Documents 路径） |
| `/api/project-info` | GET | 获取项目绝对路径等元数据 |

> 所有项目级 API 支持通过 `?project=project-id` 参数指定目标项目。

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
- 项目封面自动生成与自定义
