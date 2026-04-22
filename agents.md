# Agents

## 角色定位

你正在协助开发 **Axhost-Make** 框架本身。该框架位于 `axhost-make/` 目录下，是一个独立的 Git 仓库（远程地址：`https://github.com/BarnettZhou/AxHost-Make.git`）。

**关键区分**：
- **`axhost-make/`** — 框架源码仓库，包含 CLI、HTTP Server、Client Shell、模板等。
- **工作空间（`../`）** — 外层目录，与 `axhost-make/` 平级存放 `projects/` 目录（内含所有项目）。框架通过 `projects/.projects.json` 管理项目元数据，项目目录名使用 8 位 hash。

**绝对禁止**：未经用户允许，不要修改 `axhost-make/` 之外的任何文件（除非明确是为了测试 `update` 效果而需要查看 `projects/` 下某个项目的 `prototype/` 变化）。

---

## 核心开发原则

### 1. 修改范围

- 只修改与需求相关的框架源码文件（`axhost-make/bin/`、`axhost-make/client/`、`axhost-make/server/`、`axhost-make/templates/`、`axhost-make/skills/`）。
- 不要无意义地重构未涉及的模块。
- 输出修改后的**完整文件内容**。

### 2. 修改后的强制验证步骤

**每次修改以下文件后，必须执行**对应的同步命令：

- 修改了 `axhost-make/client/preview-index.html`、`shell.css`、`icons.js`、`preview-app.js` 中的任意一个：
  ```bash
  node axhost-make/bin/axhost-make.js build
  ```
  该命令会自动把 `client/` 下的 preview 资源复制到 `templates/preview/resources/`，并生成一个引用外部资源的瘦版 `templates/preview/index.html`。

- 修改了 `axhost-make/client/` 或 `axhost-make/templates/` 中的其他文件：
  ```bash
  node axhost-make/bin/axhost-make.js update
  ```
  该命令会将最新的模板、CSS、JS 同步到外层宿主项目的 `prototype/` 目录下。

> **特别提醒**：`build` 命令仅在维护 preview 入口时需要使用，最终用户通常无需直接调用。不要手动复制粘贴修改内容到外层 `prototype/`，统一通过 `update` 或 `build` 命令同步，避免两边不一致。

### 3. Server 代码修改后的重启

如果修改了 `axhost-make/server/` 下的路由、API 或静态文件解析逻辑，**必须重启 `serve` 才能生效**（Node 无热重载）。

重启步骤：
1. 结束现有的 Node 进程：`taskkill /F /IM node.exe`（Windows）或 `pkill node`（macOS/Linux）
2. 重新启动：`node axhost-make/bin/axhost-make.js serve --port 3820`

### 4. 图标规范

框架统一使用 `<iconpark-icon>` 图标组件：
- `client/js/icons.js` 是 IconPark CDN 的 loader。开发模式引用 `/client/js/icons.js`，独立入口引用 `resources/js/icons.js`。
- HTML/JS 中全部使用 `<iconpark-icon icon-id="xxx" size="14"></iconpark-icon>`。
- 升级 CDN 时，只需修改 `client/js/icons.js` 中的 URL，再执行 `update` 即可。

---

## 术语

- **预览模式 / preview**：直接运行 `prototype/` 下的静态原型（通过 `axhost-make preview` 或打开 `prototype/index.html`）。无开发工具，是最终交付版本。
- **开发模式 / 服务模式 / client**：通过 `axhost-make serve` 启动，由 `axhost-make/client/` 提供 Shell 界面（含目录树、文档面板、Prompt 框等）。即使在外层宿主项目中启动，加载的仍是框架 `client/` 的代码，仅通过 iframe 预览宿主项目的 `prototype/` 页面。

---

## 目录结构说明

```
workspace/
├── axhost-make/              # 框架核心代码
│   ├── bin/                  # CLI 入口
│   │   ├── axhost-make.js    # 命令分发
│   │   ├── axhost-init.js    # init 命令
│   │   ├── axhost-update.js  # update 命令
│   │   └── axhost-build.js   # build 命令（生成 preview 入口模板）
│   ├── client/               # 前端壳层资源
│   │   ├── css/              # 样式文件
│   │   │   ├── shell.css     # 开发模式主题与布局
│   │   │   └── home.css      # 项目管理首页样式
│   │   ├── js/               # 交互脚本
│   │   │   ├── icons.js      # <axhost-icon> 内联图标
│   │   │   ├── tree-nav.js   # 左侧目录树
│   │   │   ├── prompt-box.js # Prompt 交互
│   │   │   ├── doc-panel.js  # 文档面板
│   │   │   ├── shell.js      # 开发模式总控
│   │   │   ├── home.js       # 项目管理首页逻辑
│   │   │   └── preview-app.js# Preview 模式逻辑（纯静态渲染）
│   │   ├── assets/           # 第三方静态资源（marked.min.js）
│   │   ├── home.html         # 项目管理首页入口
│   │   ├── shell.html        # 开发模式入口（单项目工作台）
│   │   ├── preview-index.html# Preview 模式源码入口
│   │   └── icon.svg          # Dev 模式 favicon
│   ├── server/               # Node HTTP 服务器
│   │   ├── index.js          # 主服务入口
│   │   ├── router.js         # 路由分发（支持多项目）
│   │   └── api/              # API 实现
│   │       ├── projects.js   # GET/POST /api/projects 项目列表/新建
│   │       ├── export.js     # POST /api/export 导出功能 + /api/export/publish 线上发布
│   │       ├── axhost-proxy.js # POST /api/axhost-proxy 跨域代理（供前端调用远程 AxHost API）
│   │       ├── project-info.js # GET /api/project-info 项目元数据
│   ├── templates/            # 模板目录
│   │   ├── preview/          # Preview 入口产物（build 生成）
│   │   ├── project/          # 用户项目初始化模板
│   │   └── start-script/     # 启动脚本模板（start.cmd / start.ps1 / start.sh）
│   ├── skills/               # Kimi Skill 文档
│   └── agents.md             # 本文件
│
├── start.cmd                 # Windows 双击启动脚本（init/update 生成）
├── start.ps1                 # PowerShell 启动脚本
├── start.sh                  # Linux/mac 启动脚本
└── projects/                 # 项目存放目录（与 axhost-make/ 平级）
    ├── .projects.json        # 项目元数据表（id / name / createdAt / lastModified）
    ├── 184bdd45/             # 项目 A（8 位 hash 目录名）
    │   ├── prototype/
    │   ├── rules/
    │   └── ...
    └── a1b2c3d4/             # 项目 B（8 位 hash 目录名）
        └── ...
```

---

## 开发 Workflow

### 修改框架 Client / Templates

1. 修改 `axhost-make/client/` 或 `axhost-make/templates/` 中的源文件。
2. 如果修改了 `preview-index.html`、`shell.css`、`icons.js` 或 `preview-app.js`，**先执行 build**：
   ```bash
   node axhost-make/bin/axhost-make.js build
   ```
3. **然后执行 update** 同步到外层宿主项目：
   ```bash
   node axhost-make/bin/axhost-make.js update
   ```
4. 刷新浏览器 `http://127.0.0.1:3820` 验证效果（默认打开项目管理首页）；如需进入开发模式，点击项目卡片打开；如需验证 preview 模式，直接访问：
   ```
   http://127.0.0.1:3820/client/preview-index.html
   ```

### 修改框架 Server

1. 修改 `axhost-make/server/` 中的文件。
2. **杀死旧进程并重启 serve**。
3. 浏览器中验证 API 行为。

### 修改 CLI（init / update）

1. 修改 `axhost-make/bin/` 中的脚本。
2. 如果是 `init.js` 或 `update.js`，修改后建议手动运行一次对应命令验证逻辑。
3. `init.js` 和 `update.js` 都会调用 `syncStartScripts(workspaceRoot)`，将 `templates/start-script/` 下的脚本同步到工作空间根目录。
4. 若 `update.js` 新增了对 `templates/` 中新文件的复制逻辑，记得同时把该文件放入 `templates/` 目录。

---

## Git 工作流

对 `axhost-make/` 这个独立仓库的提交：

1. 进入 `axhost-make/` 目录。
2. `git add -A`（注意排除外层产物，如 `axhost-make/prototype/`、`axhost-make/agents.md` 之外误生成的文件）。
3. `git commit -m "描述本次修改"`
4. **禁止**在未经用户允许时执行 `git push`。

> 当前仓库已有 `.gitattributes` 设置 `* text=auto eol=lf`，Windows 下提交时不会出现 CRLF 警告。

---

## 禁止事项

- **禁止**把外层宿主项目的业务代码（`prototype/`、`pages/` 等）混入 `axhost-make/` 仓库提交。
- **禁止**在 `axhost-make/` 内创建 `prototype/` 目录（这是之前的技术债，已清理）。
- **禁止**引入 Vue/React/Angular 等框架到 `client/` 或 `templates/` 中。
- **禁止**未经用户确认执行 `git push`、`git reset`、`git rebase`。

---

## AxHost 集成（登录 / 设置 / 发布）

框架支持与远程 AxHost 平台对接，实现项目托管和线上发布。

### 登录
- **入口**：home 页面 header 头像 dropdown → 登录账号
- 调用 `POST {baseUrl}/api/auth/login`（工号 + 密码）
- Token 保存到 `localStorage('axhost-token')`，有效期 30 天
- 浏览器 CORS 限制：前端不直接请求远程，统一走 `/api/axhost-proxy` 由 Node 服务端转发

### 设置（AxHost 服务地址 / 托管项目）
- **AxHost 服务地址**：home 页面头像 dropdown → 系统设置，保存到 `localStorage('axhost-server-url')`
- **托管项目关联**：shell 页面 → 项目设置（#btn-settings）→ 托管项目
  - 支持下拉搜索 / 选择已有项目 / 创建新项目并自动关联
  - 关联信息保存在项目根目录 `.axhost-link.json`：`{ remoteProjectId, remoteProjectName }`
  - 接口：`GET/POST /api/settings`（扩展了 link 字段）

### 线上发布
- **入口**：shell 页面 → 导出按钮（#btn-export，icon-id=upload）→ 线上发布 tab
- **流程**：
  1. 选择右侧 pages/components（复用导出弹窗的树形勾选）
  2. 左侧选择托管项目（未关联时无法发布）
  3. 点击「发布」调用 `POST /api/export/publish`
  4. Server 端：复制文件到 `../cache/{projectId}` → `tar -acf` 打包 zip → `fetch` + `FormData` 上传到 AxHost `POST /api/projects/{id}/update-file`
  5. 上传完成后自动清理 cache 目录
- **前置检查**：发布前校验 `axhost-server-url`、`axhost-token`、托管项目是否已设置

### 代理接口
- `POST /api/axhost-proxy`
- 请求体：`{ serverUrl, path, method, headers, body }`
- 用于前端调用所有 AxHost 远程 API（解决浏览器 CORS）

---

## 提示

如果你在上下文中已经读取了本文件和 `axhost-make/` 下的相关源码，可直接基于已有上下文和用户的最新 Prompt 开始修改。每次改完核心代码后，**别忘了执行 `update`**。
