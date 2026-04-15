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

### 步骤 5：初始化项目

执行 `init` 命令创建标准目录结构：

```bash
node axhost-make/bin/axhost-make.js init
```

此命令会自动生成：
- `prototype/`（含 `pages/`、`components/`、`resources/`）
- `rules/`、`wiki/`、`changelog/`
- `agents.md`、`readme.md`、`package.json`
- `prototype/index.html`、`prototype/start.html`、`prototype/sitemap.js`

### 步骤 6：启动开发服务器

执行 `serve` 命令启动开发环境：

```bash
node axhost-make/bin/axhost-make.js serve --port 3820
```

- 默认端口为 **3820**，仅绑定 `127.0.0.1`。
- 启动成功后，控制台会输出：`Axhost-Make server running at http://127.0.0.1:3820`

> **重要提示**：通过 Agent 启动的后台服务通常存在**超时限制**（默认 60~3600 秒）。如果服务因超时被终止，浏览器将无法继续访问。因此，**强烈建议用户在自己的本地终端中手动运行上述命令**，以保持服务长期稳定运行。

### 步骤 7：告知用户访问地址

服务启动后，告知用户可以在浏览器中打开以下地址：

```
http://127.0.0.1:3820
```

并说明：
- `serve` 模式提供完整的开发工作台（目录树、iframe 预览、文档面板）。
- 如果 3820 端口被占用，可以换端口启动：`node axhost-make/bin/axhost-make.js serve --port 3821`

## 注意事项

1. **必须在空目录执行**：`init` 命令不会覆盖已有文件（如 `agents.md`、`readme.md`），但为了避免混淆，强烈建议在全新空目录中安装。
2. **路径不要有中文或特殊字符**：虽然框架本身支持中文路径，但部分工具链（如 Git、Node 模块）在中文路径下可能出现异常，推荐全英文目录名。
3. **端口占用处理**：如果启动时提示 `EADDRINUSE`，先查找并结束占用端口的 Node 进程，或更换端口重新启动。
4. **后台服务超时**：Agent 启动的后台任务有超时风险，开发过程中请尽量使用用户本地终端手动运行 `serve`。

## 示例：完整安装流程

```bash
# 1. 进入空目录
cd my-prototype-project

# 2. 安装 Node.js 和 Git（如未安装）
node --version
git --version

# 3. 克隆框架
git clone https://github.com/BarnettZhou/AxHost-Make.git axhost-make

# 4. 初始化项目
node axhost-make/bin/axhost-make.js init

# 5. 启动开发服务
node axhost-make/bin/axhost-make.js serve --port 3820
```

安装完成后，在浏览器中访问 `http://127.0.0.1:3820` 即可开始开发。
