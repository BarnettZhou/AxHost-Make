# 构建与部署

## 模板体系

```
templates/
├── preview/                    # 预览模式入口（build 命令产出）
│   ├── index.html              # 从 client/preview-index.html 路径重写生成
│   ├── start.html              # Meta refresh 重定向到 index.html
│   ├── icon.svg                # Favicon
│   └── shell-resources/
│       ├── css/shell.css       # 从 client/css/shell.css 复制
│       └── js/
│           ├── icon-loader-shell.js   # 从 client/js/icon-loader-shell.js 复制
│           ├── preview-app.js         # 从 client/js/preview-app.js 复制
│           ├── md-renderer.js         # 从 client/js/md-renderer.js 复制
│           ├── zoom-control.js        # 从 client/js/zoom-control.js 复制
│           └── touch-emulation.js     # 从 client/js/touch-emulation.js 复制
├── project/                    # 新项目的脚手架模板
│   ├── AGENTS.md / CLAUDE.md   # Agent 配置文件
│   ├── pages/                  # 页面模板
│   │   ├── page.html           # 默认桌面页面（{{PAGE_NAME}} 占位）
│   │   ├── mobile.html + .css  # 手机页面壳
│   │   └── mini-program.html + .css  # 小程序页面壳
│   ├── components/             # 组件模板
│   │   ├── component.html      # 桌面组件（demo-container 布局）
│   │   └── component-mobile.html  # 手机组件（375x812 壳）
│   ├── flowcharts/             # 流程图模板
│   │   ├── flowchart.html      # 查看器（代码编辑器 + 预览 + 缩略图）
│   │   ├── flowchart.css       # 查看器样式
│   │   └── flowchart.mmd       # 示例 Mermaid 图
│   ├── docs/                   # 文档模板
│   │   ├── readme.md           # 含 {{PAGE_NAME}} {{DATE}} 占位
│   │   └── notes.md            # 开发笔记模板
│   ├── rules/design.md         # 设计规范模板（空章节占位）
│   └── resources/              # 项目资源模板
│       ├── flowchart/          # 流程图 UI（flowchart.js + .css，同步至 shell-resources/）
│       └── js/mermaid.min.js   # Mermaid 库源文件（条件性复制至 shell-resources/）
└── start-script/               # 启动脚本模板（各平台）
    ├── start.sh                # Bash
    ├── start.ps1               # PowerShell
    └── start.cmd               # Windows 命令脚本
```

## build 命令

**输入：** `client/preview-index.html` + `client/css/shell.css` + `client/js/icon-loader-shell.js` + `client/js/preview-app.js` + `client/js/md-renderer.js` + `client/js/zoom-control.js` + `client/js/touch-emulation.js`  
**输出：** `templates/preview/index.html` + `templates/preview/shell-resources/*`

### 路径重写规则（对 preview-index.html 的字符串替换）

| 源路径 | 替换为 | 原因 |
|---|---|---|
| `window.__axhostBasePath = '/prototype/'` | `'./'` | 改为相对路径 |
| `/client/css/` | `./shell-resources/css/` | CSS 资源本地化 |
| `/client/js/` | `./shell-resources/js/` | JS 资源本地化 |
| `/client/icon.svg` | `./icon.svg` | Favicon 本地化 |
| `/prototype/` | `./` | 原型文件相对路径 |

## update 命令

**目的：** 将框架更新（templates + client assets）同步到用户项目。

### 同步的文件清单

| 源 | 目标 | 策略 |
|---|---|---|
| `templates/preview/index.html` | `prototype/index.html` | 覆盖 |
| `templates/preview/start.html` | `prototype/start.html` | 如果缺失则创建 |
| `client/assets/marked.min.js` | `prototype/shell-resources/js/marked.min.js` | 覆盖 |
| `templates/project/resources/js/mermaid.min.js` | `prototype/shell-resources/js/mermaid.min.js` | 有流程图时复制，无则删除 |
| `client/js/icon-loader-shell.js` | `prototype/shell-resources/js/icon-loader-shell.js` | 覆盖 |
| `client/css/shell.css` | `prototype/shell-resources/css/shell.css` | 覆盖 |
| `client/js/preview-app.js` | `prototype/shell-resources/js/preview-app.js` | 覆盖 |
| `client/js/md-renderer.js` | `prototype/shell-resources/js/md-renderer.js` | 覆盖 |
| `client/js/zoom-control.js` | `prototype/shell-resources/js/zoom-control.js` | 覆盖 |
| `client/js/touch-emulation.js` | `prototype/shell-resources/js/touch-emulation.js` | 覆盖 |
| `client/icon.svg` | `prototype/icon.svg` | 覆盖 |
| `templates/project/AGENTS.md` | `project/AGENTS.md` | 覆盖 |
| `templates/project/CLAUDE.md` | `project/CLAUDE.md` | 覆盖 |
| `templates/project/rules/design.md` | `project/rules/design.md` | 如果缺失则创建 |

### ensurePageResources()
扫描 `pages/`、`components/`、`flowcharts/` 下每个有 `index.html` 的目录，确保存在 `resources/css/style.css` 和 `resources/js/main.js`（缺失时创建空文件）。

## 两种 HTML 入口

### 开发模式（shell.html）
- URL: `http://127.0.0.1:3820/shell?project=<id>`
- 脚本从 `/client/js/*` 加载（框架目录下的源文件）
- 数据通过 `/api/*` 获取
- 完整开发工具

### 预览模式（preview/index.html）
- URL: `http://127.0.0.1:3820/prototype/index.html`
- 脚本从 `shell-resources/js/*` 加载（本地化后的副本）
- 数据从 `sitemap.js` 直接读取（无 API）
- 精简 UI（无 Prompt Box、Inspector、Export）

## 预览服务器

`axhost-make preview [--port 8080]` 启动 `preview-server.js`：
- 独立的 `http.createServer`
- 仅提供静态文件，CORS `*`
- root 指向 `prototype/` 目录
- 用于直接预览原型效果，无需框架开发工具

## 项目初始化模板创建

当通过 API 或 CLI 创建新页面时，`createItem()` 使用模板文件：

```
模板: templates/project/{tab}/{template}.html
变量: {{PAGE_NAME}} → 用户输入的名称, {{DATE}} → 当前日期
```

不同 kind + template 对应的模板：

| kind | template | 模板文件 |
|---|---|---|
| page | default | pages/page.html |
| page | mobile | pages/mobile.html + pages/mobile.css |
| page | mini-program | pages/mini-program.html + pages/mini-program.css |
| component | default | components/component.html |
| component | mobile | components/component-mobile.html |
| flowchart | — | flowcharts/flowchart.html + flowchart.css + flowchart.mmd |
