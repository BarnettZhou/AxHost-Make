# 顶层架构

## 三层设计

Axhost-Make 采用三层架构，运行在同一台机器的不同进程中：

```
┌─────────────────────────────────────────────────────────────┐
│ CLI (bin/)                                                   │
│ axhost-make.js → init / update / build / serve / add-*       │
│ 工作于工作区根目录，调用 server 层函数或 spawn 子进程             │
├─────────────────────────────────────────────────────────────┤
│ Server (server/)                                             │
│ index.js → router.js → api/*.js + middleware/*.js             │
│ Node.js http.createServer，绑 127.0.0.1，默认端口 3820       │
│ 无框架，零外部依赖                                             │
├─────────────────────────────────────────────────────────────┤
│ Client (client/)                                             │
│ home.html/shell.html/preview-index.html + vanilla JS modules │
│ IIFE 模块模式，window 全局注册，无打包器                        │
│ 依赖：marked.js（Markdown）+ Mermaid.js（流程图）+ IconPark   │
└─────────────────────────────────────────────────────────────┘
```

## 工作区布局

```
workspace/                       # 工作区根目录（在 axhost-make/ 之外）
├── axhost-make/                 # 框架仓库（本仓库）
│   ├── bin/                     # CLI 入口
│   ├── client/                  # 前端壳资源
│   ├── server/                  # HTTP 服务器
│   ├── templates/               # 模板（preview/、project/、start-script/）
│   ├── system-rules/            # Agent 规范文件
│   └── skills/                  # Kimi Skill 文档
├── projects/                    # 用户项目
│   ├── .projects.json           # 项目索引
│   └── {8位hash}/               # 每个项目
│       ├── prototype/           # 原型文件
│       │   ├── sitemap.js       # 站点地图（唯一数据源）
│       │   ├── pages/           # 页面（每页一个 hash 命名的目录）
│       │   ├── components/      # 组件
│       │   ├── flowcharts/      # 流程图
│       │   └── resources/       # 共享资源
│       ├── rules/               # 项目规则
│       └── ...                  # changelog/、memory/、wiki/
├── start.sh / start.cmd         # 启动脚本（init 生成）
└── package.json                 # 工作区级 npm 脚本（init 生成）
```

## 核心设计原则

1. **零外部 npm 依赖** — Server 仅使用 Node.js 内置模块（http、fs、path、crypto、child_process）
2. **无框架** — 客户端使用 IIFE + window 全局注册，无 Vue/React/Angular
3. **Sitemap 为唯一数据源** — 页面/组件树的权威来源是 `prototype/sitemap.js`
4. **Hash 目录命名** — 页面和组件目录使用 8 位 hex hash，支持重命名而不影响路径
5. **本地优先** — 所有数据存储在本地文件系统，无需数据库

## 两种模式

| | 开发模式（serve） | 预览模式（preview） |
|---|---|---|
| 入口 | `client/shell.html` | `templates/preview/index.html` |
| Shell | 完整开发工具（Tree Nav + Doc Panel + Prompt Box + Inspector + Export） | 精简版（Tree Nav + Doc Panel） |
| 数据源 | `/api/scan` → sitemap.js | 直接加载 `sitemap.js` |
| API | 有 | 无 |

## 术语

- **Page（页面）** — 原型中的一个完整页面，`prototype/pages/{hash}/index.html`
- **Component（组件）** — 可复用的 UI 组件，`prototype/components/{hash}/index.html`
- **Flowchart（流程图）** — Mermaid 流程图，`prototype/flowcharts/{hash}/index.html`
- **Doc（文档）** — Markdown 文档，位于 `{页面或组件路径}/docs/`
- **Rule（规则）** — 项目级 Markdown 文件，位于 `project/rules/`
- **Sitemap** — 站点地图，记录 pages/components/flowcharts 树结构
- **Workspace Root** — 包含 `axhost-make/` 和 `projects/` 的目录
- **Project Root** — 单个项目目录，即 `projects/{hash}/`
