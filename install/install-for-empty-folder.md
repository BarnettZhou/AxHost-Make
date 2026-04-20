# Skill: 从零安装并启动 Axhost-Make

## 描述

帮助用户在空目录中完成 Axhost-Make 框架的完整安装、项目初始化，并启动开发服务器。

## 适用范围

- 首次使用 Axhost-Make 的新项目
- 需要重新拉取框架源码并初始化目录结构的场景
- 安装后需要立即启动本地开发环境（`serve`）

## 前置条件

- 一个**空目录**（且推荐使用全英文字符路径）
- 系统已联网（需要从 GitHub 克隆仓库）

## 执行步骤

### 步骤 1：检查目录状态

检查当前工作目录是否为空目录（不包含任何文件或子目录）。

- **若非空目录**：停止任务，明确告知用户必须在一个全新的空目录下执行安装，避免污染已有项目。
- **若为空目录**：继续下一步。

### 步骤 2：检查并安装 Node.js（>= 22）

检查本机是否已安装 Node.js，且版本 >= 22：

```bash
node --version
```

- **若未安装或版本不足**：根据操作系统帮助用户安装：
  - **Windows**：`winget install OpenJS.NodeJS`
  - **macOS**：`brew install node`
  - **Linux**：`sudo apt update && sudo apt install nodejs npm`
- **安装后**：重新验证 `node --version`。

### 步骤 3：检查并安装 Git

检查本机是否已安装 Git：

```bash
git --version
```

- **若未安装**：根据操作系统帮助用户安装：
  - **Windows**：`winget install Git.Git`
  - **macOS**：`brew install git`
  - **Linux**：`sudo apt update && sudo apt install git`
- **安装后**：重新验证 `git --version`。

> **错误处理**：如果 Node.js 或 Git 安装失败，分析原因（网络超时、权限不足、包管理器未安装等），给出具体解决方案，并**停止任务**。

### 步骤 4：克隆 Axhost-Make 核心代码

从 GitHub 克隆框架源码到当前目录的 `axhost-make` 子目录：

```bash
git clone https://github.com/BarnettZhou/AxHost-Make.git axhost-make
```

- **若克隆失败**（网络、权限、仓库不存在等）：分析错误原因，给出解决建议（如检查网络、使用代理、手动下载 ZIP 等），并**停止任务**。

### 步骤 5：初始化工作空间

执行 `init` 命令初始化多项目工作空间：

```bash
node axhost-make/bin/axhost-make.js init --non-interactive
```

> **注意**：`init` 初始化的是**工作空间**（workspace），而非单个项目。工作空间是多项目架构的容器，所有项目都托管在 `projects/` 目录下。

此命令会自动生成：
- `projects/` —— 项目容器目录（所有原型项目存放于此）
- `projects/.projects.json` —— 项目索引文件
- `package.json` —— 工作空间级 npm 脚本（含 `serve`、`build`、`update`、`preview`）
- `start.ps1` / `start.cmd` / `start.sh` —— 快捷启动脚本（如有模板）

`init` 会检查以下约束：
- 必须在包含 `axhost-make` 目录的文件夹中运行（即工作空间根目录）。
- 工作空间根目录下除 `axhost-make` 外不应有其他目录，否则初始化会失败。

如果你通过 Agent 执行并希望跳过交互式确认，请加上 `--non-interactive` 参数。否则命令结束后会询问是否立即启动开发服务。

### 步骤 6：创建第一个项目（可选）

工作空间初始化后，你可以通过开发工作台（Web UI）或 API 在 `projects/` 下创建新的原型项目。每个项目会独立生成：
- `prototype/`（含 `pages/`、`components/`、`resources/`）
- `rules/`、`wiki/`、`changelog/`
- `agents.md`、`readme.md`
- `prototype/index.html`、`prototype/start.html`、`prototype/sitemap.js`

> **注意**：`init` 命令本身不会自动创建第一个项目。你需要在浏览器中打开工作台后，通过界面创建项目，或者使用 CLI 的 `add-page` / `add-component` 等命令。

### 步骤 7：启动开发服务器

执行 `serve` 命令启动开发环境：

```bash
node axhost-make/bin/axhost-make.js serve --port 3820
```

- 默认端口为 **3820**，仅绑定 `127.0.0.1`。
- 启动成功后，控制台会输出：`Axhost-Make server running at http://127.0.0.1:3820`

> **重要提示**：通过 Agent 启动的后台服务通常存在**超时限制**（默认 60~3600 秒）。如果服务因超时被终止，浏览器将无法继续访问。因此，**强烈建议用户在自己的本地终端中手动运行上述命令**，以保持服务长期稳定运行。

### 步骤 8：告知用户访问地址

服务启动后，告知用户可以在浏览器中打开以下地址：

```
http://127.0.0.1:3820
```

并说明：
- `serve` 模式提供完整的开发工作台（目录树、iframe 预览、文档面板、项目管理）。
- 如果 3820 端口被占用，可以换端口启动：`node axhost-make/bin/axhost-make.js serve --port 3821`

## 注意事项

1. **必须在空目录执行克隆**：克隆前当前目录应为空，仅允许克隆后存在 `axhost-make/` 目录。`init` 命令会检查工作空间下是否仅有 `axhost-make` 一个目录，否则初始化失败。
2. **区分工作空间和项目**：`init` 初始化的是工作空间（生成 `projects/`、`package.json`），项目（含 `prototype/` 等）需在工作台或后续步骤中单独创建。
3. **路径不要有中文或特殊字符**：虽然框架本身支持中文路径，但部分工具链（如 Git、Node 模块）在中文路径下可能出现异常，推荐全英文目录名。
4. **端口占用处理**：如果启动时提示 `EADDRINUSE`，先查找并结束占用端口的 Node 进程，或更换端口重新启动。
5. **后台服务超时**：Agent 启动的后台任务有超时风险，开发过程中请尽量使用用户本地终端手动运行 `serve`。

## 示例：完整安装流程

```bash
# 1. 进入空目录
cd my-workspace

# 2. 安装 Node.js 和 Git（如未安装）
node --version
git --version

# 3. 克隆框架
git clone https://github.com/BarnettZhou/AxHost-Make.git axhost-make

# 4. 初始化工作空间（跳过交互式确认）
node axhost-make/bin/axhost-make.js init --non-interactive

# 5. 启动开发服务
node axhost-make/bin/axhost-make.js serve --port 3820
```

安装完成后，在浏览器中访问 `http://127.0.0.1:3820` 即可进入开发工作台，随后可在界面中创建你的第一个原型项目。
