# Skill: 基于已有 HTML 项目安装并启动 Axhost-Make

## 描述

帮助用户在已有 HTML 项目的基础上，安装 Axhost-Make 框架并整理目录结构，使其转变为标准的 Axhost-Make 项目，同时启动开发服务器。

## 适用范围

- 当前工作目录下已存在一个现有的 HTML 项目
- 希望将已有的静态页面项目迁移到 Axhost-Make 框架中进行管理和迭代

## 前置条件

- 当前目录**非空**，且**有且仅有一个子目录**（该子目录即为现有的 HTML 项目根目录）
- 该子目录内必须包含 `index.html` 作为项目入口文件
- 系统已联网（需要从 GitHub 克隆仓库）
- 推荐使用全英文字符路径

## 执行步骤

### 步骤 1：检查并安装 Node.js（>= 22）

检查本机是否已安装 Node.js，且版本 >= 22：

```bash
node --version
```

- **若未安装或版本不足**：根据操作系统帮助用户安装：
  - **Windows**：`winget install OpenJS.NodeJS`
  - **macOS**：`brew install node`
  - **Linux**：`sudo apt update && sudo apt install nodejs npm`
- **安装后**：重新验证 `node --version`。

### 步骤 2：检查并安装 Git

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

### 步骤 3：检查目录状态

检查当前工作目录的结构：

```bash
ls -A
```

- **若当前目录为空目录**：停止任务，告知用户当前目录为空，应使用《从零安装并启动 Axhost-Make》流程。
- **若当前目录下有多个子目录或文件**：停止任务，告知用户本 Skill 仅支持"当前目录下有且仅有一个 HTML 项目子目录"的场景，请先整理好项目结构。
- **若当前目录下有且仅有一个子目录**：进入该子目录，检查是否存在 `index.html`。
  - **若不存在 `index.html`**：停止任务，告知用户该子目录缺少入口文件 `index.html`，无法识别为 HTML 项目。
  - **若存在 `index.html`**：继续下一步。

### 步骤 4：将 HTML 项目目录重命名为 `prototype`

如果该子目录的名称不是 `prototype`，则将其重命名：

```bash
mv <原目录名> prototype
```

> 如果目录名已经是 `prototype`，则跳过此步骤。

### 步骤 5：将原有 `index.html` 迁移为页面，并整理目录结构

**关键概念**：在 Axhost-Make 中，`prototype/index.html` 是**开发工作台入口**（包含左侧目录树、中间 iframe 预览、右侧文档面板），它由框架通过 `update` 命令自动生成，**本身不是一个原型页面**。因此，原项目中存在的 `index.html` 应当被视为一个**原型页面**，需要被移入 `prototype/pages/` 目录下，否则后续执行 `update` 时会覆盖掉你的真实页面内容。

进入 `prototype` 目录，执行以下整理：

```bash
cd prototype
ls -A
```

#### 5.0 检测是否已经是 Axhost-Make 项目

首先检查 `prototype` 目录下是否存在 `sitemap.js`：

```bash
cat sitemap.js 2>/dev/null || echo "NO_SITEMAP"
```

- 如果文件存在且内容中包含 `generatedBy` 字段且值为 `"axhost-make"`，说明该项目**已经是标准的 Axhost-Make 项目**（之前通过 `init` 或 `update` 生成）。
  - **无需执行后续的页面迁移和目录整理**（5.1 ~ 5.5）。
  - 直接跳到**步骤 6**（克隆核心代码），后续执行 `update` 即可完成环境搭建。
- 如果不包含该字段（或文件不存在）：说明这是一个普通的 HTML 项目，继续执行下面的迁移步骤。

#### 5.1 迁移 `index.html`

创建 `pages/` 目录（如不存在），并将原 `index.html` 移入其中。推荐路径为 `pages/home/index.html` 或 `pages/首页/index.html`：

```bash
mkdir -p pages/home
mv index.html pages/home/
```

> 如果项目中还有其他 `.html` 文件，也建议一并移入 `pages/` 下的相应子目录中（如 `pages/about/index.html`）。

#### 5.2 检查并修正相对路径

迁移页面后，页面内部的相对引用路径可能失效。请检查已迁移的 HTML 文件中引用的 CSS、JS、图片等路径，并根据新的目录层级进行调整。

**示例**：
- 迁移前 `index.html` 在 `prototype/index.html`，引用 `./css/style.css`。
- 迁移后在 `prototype/pages/home/index.html`，若 CSS 被统一放到 `prototype/resources/css/style.css`，则引用路径应改为 `../../resources/css/style.css`。

#### 5.3 整理公共资源

创建标准的 `components/` 和 `resources/` 目录：

```bash
mkdir -p components resources/js resources/css resources/images
```

将原项目中平铺的公共资源（如 `css/`、`js/`、`img/`、`images/` 等）移动到 `resources/` 下：

```bash
mv css/* resources/css/ 2>/dev/null || true
mv js/* resources/js/ 2>/dev/null || true
mv img/* resources/images/ 2>/dev/null || true
mv images/* resources/images/ 2>/dev/null || true
```

#### 5.4 补充 `start.html`

如果 `prototype` 目录下没有 `start.html`，则创建一个自动跳转到开发工作台入口的文件：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=./index.html">
  <title>Loading...</title>
</head>
<body>
  <p>正在跳转...</p>
</body>
</html>
```

> 此处的 `./index.html` 在执行 `update` 后即为框架生成的开发工作台入口。

#### 5.5 生成 `sitemap.js`（可选）

`update` 命令会自动扫描 `pages/` 和 `components/` 并生成 `sitemap.js`。如果你希望提前创建，可以使用如下最小化模板：

```javascript
window.__axhostSitemap = {
  name: "My Project",
  pages: [
    { name: "首页", path: "pages/home/index.html" }
    // 根据实际页面补充
  ],
  components: []
};
```

### 步骤 6：克隆 Axhost-Make 核心代码

回到项目根目录，从 GitHub 克隆框架源码到 `axhost-make` 子目录：

```bash
cd ..
git clone https://github.com/BarnettZhou/AxHost-Make.git axhost-make
```

- **若克隆失败**（网络、权限、仓库不存在等）：分析错误原因，给出解决建议（如检查网络、使用代理、手动下载 ZIP 等），并**停止任务**。

### 步骤 7：执行 update 更新项目

执行 `update` 命令，将框架最新的入口模板、样式和脚本同步到当前项目中，并重新生成 `sitemap.js`：

```bash
node axhost-make/bin/axhost-make.js update
```

此命令会：
- 在 `prototype/` 根目录下生成**开发工作台入口** `index.html`（含左侧导航、iframe 预览、文档面板）
- 同步框架提供的公共资源（如 `shell.css`、`marked.min.js` 等）
- 重新扫描 `prototype/pages/` 和 `prototype/components/`，生成最新的 `sitemap.js`
- **保留已设置的项目名称**

> 因为原项目的真实页面已提前移入 `pages/`，所以执行 `update` 不会覆盖你的实际页面内容。

### 步骤 8：启动开发服务器

执行 `serve` 命令启动开发环境：

```bash
node axhost-make/bin/axhost-make.js serve --port 3820
```

- 默认端口为 **3820**，仅绑定 `127.0.0.1`。
- 启动成功后，控制台会输出：`Axhost-Make server running at http://127.0.0.1:3820`

> **重要提示**：通过 Agent 启动的后台服务通常存在**超时限制**（默认 60~3600 秒）。如果服务因超时被终止，浏览器将无法继续访问。因此，**强烈建议用户在自己的本地终端中手动运行上述命令**，以保持服务长期稳定运行。

### 步骤 9：告知用户访问地址

服务启动后，告知用户可以在浏览器中打开以下地址：

```
http://127.0.0.1:3820
```

并说明：
- `serve` 模式提供完整的开发工作台（目录树、iframe 预览、文档面板）。
- 如果 3820 端口被占用，可以换端口启动：`node axhost-make/bin/axhost-make.js serve --port 3821`

## 注意事项

1. **必须先将原 `index.html` 移入 `pages/` 后再执行 `update`**：这是最关键的一步。`update` 会在 `prototype/` 根目录生成开发工作台入口 `index.html`，如果原页面未提前迁移，将被覆盖。
2. **修正相对路径**：迁移页面后，务必检查页面内引用的 CSS、JS、图片路径是否正确，必要时手动调整。
3. **路径不要有中文或特殊字符**：虽然框架本身支持中文路径，但部分工具链（如 Git、Node 模块）在中文路径下可能出现异常，推荐全英文目录名。
4. **端口占用处理**：如果启动时提示 `EADDRINUSE`，先查找并结束占用端口的 Node 进程，或更换端口重新启动。
5. **后台服务超时**：Agent 启动的后台任务有超时风险，开发过程中请尽量使用用户本地终端手动运行 `serve`。

## 示例：完整迁移流程

假设当前目录结构如下：

```
my-old-project/
└── website/
    ├── index.html
    ├── about.html
    ├── css/
    └── js/
```

执行步骤：

```bash
# 1. 进入项目目录
cd my-old-project

# 2. 检查 Node.js 和 Git
node --version
git --version

# 3. 重命名目录为 prototype
mv website prototype

# 4. 进入 prototype 整理目录
cd prototype
mkdir -p pages/home pages/about components resources/js resources/css
mv index.html pages/home/
mv about.html pages/about/
mv css/* resources/css/ 2>/dev/null || true
mv js/* resources/js/ 2>/dev/null || true

# 补充 start.html（如缺失）
cat > start.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=./index.html">
  <title>Loading...</title>
</head>
<body>
  <p>正在跳转...</p>
</body>
</html>
EOF

cd ..

# 5. 克隆框架
git clone https://github.com/BarnettZhou/AxHost-Make.git axhost-make

# 6. 更新项目
node axhost-make/bin/axhost-make.js update

# 7. 启动开发服务
node axhost-make/bin/axhost-make.js serve --port 3820
```

启动完成后，在浏览器中访问 `http://127.0.0.1:3820` 即可开始基于 Axhost-Make 进行开发。
