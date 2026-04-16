# Agents

## 角色定位

你正在协助开发 **Axhost-Make** 框架本身。该框架位于 `axhost-make/` 目录下，是一个独立的 Git 仓库（远程地址：`https://github.com/BarnettZhou/AxHost-Make.git`）。

**关键区分**：
- **`axhost-make/`** — 框架源码仓库，包含 CLI、HTTP Server、Client Shell、模板等。
- **项目根目录（`../`）** — 外层宿主项目，包含 `prototype/`、`pages/`、`rules/` 等实际业务原型文件，用于测试和验证框架功能。

**绝对禁止**：未经用户允许，不要修改 `axhost-make/` 之外的任何文件（除非明确是为了测试 `update` 效果而需要查看外层 `prototype/` 的变化）。

---

## 核心开发原则

### 1. 修改范围

- 只修改与需求相关的框架源码文件（`axhost-make/bin/`、`axhost-make/client/`、`axhost-make/server/`、`axhost-make/templates/`、`axhost-make/skills/`）。
- 不要无意义地重构未涉及的模块。
- 输出修改后的**完整文件内容**。

### 2. 修改后的强制验证步骤

**每次修改 `axhost-make/client/` 或 `axhost-make/templates/` 后，必须执行**：

```bash
node axhost-make/bin/axhost-make.js update
```

该命令会将最新的模板、CSS、JS 同步到外层宿主项目的 `prototype/` 目录下，确保本地开发环境能立即看到变更效果。

> **特别提醒**：不要手动复制粘贴修改内容到外层 `prototype/`，统一通过 `update` 命令同步，避免两边不一致。

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
axhost-make/
├── bin/                    # CLI 入口
│   ├── axhost-make.js      # 命令分发
│   ├── axhost-init.js      # init 命令
│   └── axhost-update.js    # update 命令
├── client/                 # 前端壳层资源
│   ├── css/shell.css       # 主题与布局样式
│   ├── js/                 # 交互脚本
│   │   ├── icons.js        # <axhost-icon> 内联图标
│   │   ├── tree-nav.js     # 左侧目录树
│   │   ├── prompt-box.js   # Prompt 交互
│   │   ├── doc-panel.js    # 文档面板
│   │   └── shell.js        # Dev 模式总控
│   ├── assets/             # 第三方静态资源（marked.min.js）
│   └── index.html          # Dev 模式入口
├── server/                 # Node HTTP 服务器
│   ├── index.js            # 主服务入口
│   ├── router.js           # 路由分发
│   └── api/                # API 实现
├── templates/              # 项目模板
│   ├── prototype-index.html
│   ├── prototype-start.html
│   ├── agents.md           # 给用户项目的 agents.md 模板
│   ├── package.json        # 给用户项目的 package.json 模板
│   ├── page.html
│   ├── component.html
│   └── doc.md
├── skills/                 # Kimi Skill 文档
└── agents.md               # 本文件
```

---

## 开发 Workflow

### 修改框架 Client / Templates

1. 修改 `axhost-make/client/` 或 `axhost-make/templates/` 中的源文件。
2. **立即执行**：`node axhost-make/bin/axhost-make.js update`
3. 刷新浏览器 `http://127.0.0.1:3820` 验证效果。

### 修改框架 Server

1. 修改 `axhost-make/server/` 中的文件。
2. **杀死旧进程并重启 serve**。
3. 浏览器中验证 API 行为。

### 修改 CLI（init / update）

1. 修改 `axhost-make/bin/` 中的脚本。
2. 如果是 `init.js` 或 `update.js`，修改后建议手动运行一次对应命令验证逻辑。
3. 若 `update.js` 新增了对 `templates/` 中新文件的复制逻辑，记得同时把该文件放入 `templates/` 目录。

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

## 提示

如果你在上下文中已经读取了本文件和 `axhost-make/` 下的相关源码，可直接基于已有上下文和用户的最新 Prompt 开始修改。每次改完核心代码后，**别忘了执行 `update`**。
