# 导入 HTML 包到 AxHost-Make 项目

本提示词用于指导 AI Agent 将用户提供的 HTML 包（单 HTML 文件、多文件 HTML+CSS+JS 包、或目录结构）转换为 AxHost-Make 项目中的页面和资源。

---

## 第0步：创建新项目（必须首先执行）

**本任务必须在全新的空项目中执行，严禁在已有项目中原位修改文件。**

你应自行创建新项目，不要依赖用户手动操作。

### 0.0 检测当前 Shell 环境

在执行任何命令之前，必须明确当前运行环境。不同环境的命令语法、引号规则和字符编码处理方式不同，用错会导致 JSON 解析失败或中文乱码。

#### 检测方法

执行以下命令判断环境类型：

```bash
# 方法 1：查看 SHELL 环境变量（Linux/macOS/Git Bash）
echo "$SHELL"

# 方法 2：Windows 专用检测
echo "$PSVersionTable"   # 仅 PowerShell 能执行
echo %COMSPEC%           # 仅 cmd 能执行
```

#### 五种常见环境及特征

| 环境 | 判定依据 | 变量语法 | curl 可用性 | 字符编码 |
|------|---------|---------|------------|---------|
| **bash (Linux)** | `$SHELL` = `/bin/bash` 且 `uname` = `Linux` | `$VAR` | ✅ 原生支持 | UTF-8 默认 |
| **zsh (macOS)** | `$SHELL` = `/bin/zsh` 且 `uname` = `Darwin` | `$VAR` | ✅ 原生支持 | UTF-8 默认 |
| **Git Bash (Windows)** | `$SHELL` 含 `bash` 且 `uname` 含 `MINGW` | `$VAR` | ✅ 通常可用 | UTF-8，注意路径转换 |
| **PowerShell (Windows)** | `$PSVersionTable` 可执行 | `$env:VAR` | ⚠️ `curl` 是 `Invoke-WebRequest` 别名 | UTF-8，`>` 输出默认 UTF-16 LE |
| **cmd (Windows)** | `%COMSPEC%` 含 `cmd.exe` 且无 `$SHELL` | `%VAR%` | ⚠️ curl 可能不可用 | GBK/CP936 默认 |

#### 命令适配规则

**bash / zsh / Git Bash**（三类环境语法基本一致）：

所有 curl 命令使用**单引号**包裹 JSON body，内部 JSON 键值用双引号，**无需转义**：

```bash
curl -s -X POST "$API_BASE/api/projects" \
  -H 'Content-Type: application/json' \
  -d '{"name":"我的项目"}'
```

**PowerShell**：

- curl 是 `Invoke-WebRequest` 的别名，参数不同。建议使用 `curl.exe` 调用真正的 curl，或改用 `Invoke-RestMethod`。
- 若必须用 `curl` 别名，注意 `-d` 无效，需用 `-Body`。
- JSON 体内的双引号需转义为 `` `" `` 或使用 here-string。
- **推荐写法**（使用 curl.exe，与 bash 语法一致，最可靠）：

```powershell
curl.exe -s -X POST "$env:API_BASE/api/projects" `
  -H 'Content-Type: application/json' `
  -d '{"name":"我的项目"}'
```

- 写入文件内容时，PowerShell 的 `Out-File` / `>` 默认使用 UTF-16 LE 编码。若需直接写入文件（非通过 API），使用 `Set-Content -Encoding UTF8`。

**cmd**：

- 不支持单引号包裹字符串，JSON 内双引号必须转义为 `\"`。
- 不支持 `\` 换行续行。
- 变量使用 `%VAR%`。
- **不推荐**在 cmd 中执行复杂 curl 命令。若检测到 cmd 环境，建议提示用户改用 Git Bash 或 PowerShell，或使用以下写法：

```cmd
curl.exe -s -X POST "%API_BASE%/api/projects" -H "Content-Type: application/json" -d "{\"name\":\"我的项目\"}"
```

#### 文件写入编码注意事项

- 通过 API (`POST /api/file`) 写入文件时，JSON body 自动处理编码，**无需**担心环境编码差异。
- 若某些步骤必须用 shell 直接写文件（如 `echo` > 文件）：
  - **bash/zsh/macOS**：默认 UTF-8，无问题。
  - **PowerShell**：`Set-Content -Encoding UTF8` 避免 BOM；`Out-File -Encoding utf8` 会产生 BOM。
  - **cmd**：`chcp 65001` 切换到 UTF-8 代码页后再操作。
- 所有 HTML/CSS/JS/MD 文件内容必须使用 **UTF-8 无 BOM** 编码。中文内容不应出现乱码。

#### 检测后必须明确声明

确定环境后，在回复中明确告知用户当前检测到的环境，例如：

> **检测到环境：zsh (macOS)** — 以下所有命令将使用 bash/zsh 兼容语法。

这确保用户知道你在用什么语法执行命令。

### 获取路径信息

用户给出的 prompt 末尾有「**目录指引**」段落，包含以下关键信息：

- **AxHost-Make 工作目录**（下文简称 `$WORKSPACE`）
- **AxHost-Make 框架目录**（下文简称 `$FRAMEWORK`）
- **API 地址**（下文简称 `$API_BASE`，如 `http://127.0.0.1:3820`）

首先从 prompt 中提取这三项，后续所有操作都基于它们。

### 创建项目

```bash
curl -s -X POST "$API_BASE/api/projects" \
  -H 'Content-Type: application/json' \
  -d '{"name":"<用户指定的项目名称>"}'
```

返回：`{"code":0,"data":{"id":"a1b2c3d4","name":"我的项目"}}`

记下返回的项目 `id`（8 位 hash），下文简称 `$PROJECT`。后续所有 API 调用都需要带上 `?project=$PROJECT` 参数。

### 进入新项目目录

```bash
cd $WORKSPACE/projects/$PROJECT
```

### 验证

确认当前目录下存在 `prototype/`、`AGENTS.md` 等文件，且 `prototype/pages/` 下仅有空目录（无 hash 子目录）。

> **导入 HTML 包会创建多个页面、提取公共资源、修改项目索引文件。必须在新项目中执行，严禁污染已有项目。**

---

## API 速查表

后续所有操作通过 `$API_BASE` 的 HTTP API 完成，不再依赖 `node` CLI。以下为常用 API：

| 操作 | API |
|------|-----|
| 创建页面 | `POST $API_BASE/api/create?project=$PROJECT` `{"parentPath":"prototype/pages","name":"名称","kind":"page"}` |
| 创建组件 | `POST $API_BASE/api/create?project=$PROJECT` `{"parentPath":"prototype/components","name":"名称","kind":"component"}` |
| 创建目录 | `POST $API_BASE/api/create?project=$PROJECT` `{"parentPath":"prototype/pages/<hash>","name":"名称","kind":"folder"}` |
| 读取文件 | `GET $API_BASE/api/file?project=$PROJECT&path=prototype/pages/<hash>/index.html` |
| 写入文件 | `POST $API_BASE/api/file?project=$PROJECT` `{"path":"prototype/pages/<hash>/index.html","content":"..."}` |
| 读取 sitemap | `GET $API_BASE/api/sitemap?project=$PROJECT` |
| 移动/重命名 | `POST $API_BASE/api/move?project=$PROJECT` `{"srcPath":"...","destPath":"..."}` |

> **注意**：parentPath 中如需指定父级，在路径末尾追加父级 hash，如 `prototype/pages/a1b2c3d4`。创建顶级页面则用 `prototype/pages`。

---

## 任务目标

用户提供了一个 HTML 包，可能包含以下形式之一：

- **单 HTML 文件**：一个包含内联 `<style>` 和 `<script>` 的 `.html` 文件
- **多文件包**：多个 `.html` 文件 + `.css` + `.js` + 图片等资源文件
- **目录结构**：一个包含 `index.html` + `css/` + `js/` + `images/` 等子目录的文件夹

你需要将这个包**完整、准确地**导入到新创建的 AxHost-Make 项目中，生成符合框架规范的原型页面和资源。

---

## 工作流程

### 第1步：分析输入

1. **了解包的结构**：列出所有文件，识别 HTML 页面、CSS 样式、JS 脚本、图片资源。
2. **确认页面数量**：有几个 `.html` 文件就是几个页面（排除 `index.html` 可能的主入口歧义，所有 HTML 都应视为独立页面）。
3. **识别资源依赖关系**：HTML 中 `link`/`script`/`img` 等标签引用了哪些外部资源。
4. **阅读项目现有资源**：先查阅 `RESOURCES.md`、`COMPONENTS.md`、`rules/design.md`，了解已有的公共样式和组件，优先复用。

### 第2步：创建页面骨架

对每个 HTML 页面，使用 API 创建页面：

```bash
curl -s -X POST "$API_BASE/api/create?project=$PROJECT" \
  -H 'Content-Type: application/json' \
  -d '{"parentPath":"prototype/pages","name":"<页面名称>","kind":"page"}'
```

返回：`{"code":0,"data":{"id":"a1b2c3d4","name":"页面名称","path":"a1b2c3d4","kind":"page"}}`

- **页面命名**：根据 HTML 的 `<title>` 或文件名推断有意义的中文名称。若无法推断，让用户确认后再操作。
- **层级关系**：若多个 HTML 之间有层级关系（如列表页 → 详情页），将子页面的 `parentPath` 设置为 `prototype/pages/<父级hash>`。
- 创建后你会得到每个页面的 8 位 hash。记录「页面名称 → hash」的映射表，后续步骤会用到。

### 第3步：处理 CSS

#### 3.1 嵌入式样式（`<style>` 标签内）

- 将 `<style>` 标签内的 CSS 通过 API 写入页面私有样式文件。
- 在 `index.html` 中将 `<style>` 替换为 `<link rel="stylesheet" href="resources/css/style.css">`

```bash
curl -s -X POST "$API_BASE/api/file?project=$PROJECT" \
  -H 'Content-Type: application/json' \
  -d '{"path":"prototype/pages/<hash>/resources/css/style.css","content":"<CSS 内容>"}'
```

#### 3.2 外部样式文件（`.css` 文件）

按以下优先级判断放置位置：

| 场景 | 放置位置 | 页面引用路径 |
|------|---------|------------|
| 仅一个页面使用 | `pages/{hash}/resources/css/` | `resources/css/xxx.css` |
| 多个页面共用（如公共主题、按钮库） | `prototype/resources/css/` | `../../resources/css/xxx.css` |
| 已是项目公共样式（与现有 `resources/css/` 中文件功能重叠） | 合并到已有文件 | 引用已有文件 |

#### 3.3 样式适配

- 检查 CSS 中的选择器是否使用了过于宽泛的全局选择器（`*`、`html`、`body`）。若有，将它们限定在页面容器内，或提取到页面内联 `<style>` 作为演示外壳样式。
- 若 CSS 中包含绝对 URL（如 CDN 字体、图标），保留不变。
- 若 CSS 中使用 `url()` 引用了图片，确保图片路径在迁移后依然正确。

### 第4步：处理 JavaScript

#### 4.1 内嵌脚本（`<script>` 标签内，非外部引用）

- 将 `<script>` 标签内的 JS 通过 API 写入 `pages/{hash}/resources/js/main.js`
- 在 `index.html` 中将 `<script>` 替换为 `<script src="resources/js/main.js"></script>`
- 保持脚本在 HTML 中的位置不变（`<body>` 底部 vs `<head>` 中）

#### 4.2 外部脚本文件（`.js` 文件）

| 场景 | 放置位置 | 页面引用路径 |
|------|---------|------------|
| 仅一个页面使用 | `pages/{hash}/resources/js/` | `resources/js/xxx.js` |
| 多个页面共用（如工具库、图表库） | `prototype/resources/js/` | `../../resources/js/xxx.js` |

#### 4.3 脚本适配

- 若脚本中有 `window.location.href` 跳转，**必须**改为 `window.parent.postMessage({ type: 'axhost-navigate', path: '目标hash', tab: 'pages' }, '*')`。参考 `$FRAMEWORK/system-rules/dev-spec.md`。
- 若脚本依赖全局变量（如 `$`），在页面中添加对应的 CDN 引用或确保公共 JS 已加载。
- 若脚本包含自动初始化（DOMContentLoaded 中自动执行），保留在页面内联 `<script>` 而非提取到 `main.js`（遵循组件纯净原则）。

### 第5步：处理图片和其他静态资源

#### 5.1 图片

- **页面私有图片**（仅该页面使用）→ `pages/{hash}/resources/images/`，引用路径 `resources/images/xxx.png`
- **公共图片**（多页面使用）→ `prototype/images/`，引用路径 `../../images/xxx.png`
- 若图片已通过图片管理器上传（base64 方式），记录其 hash 并在文档中引用 `$hash.ext` 格式。

#### 5.2 字体文件

- 放在 `prototype/resources/fonts/`（如目录不存在则创建）
- 更新 CSS 中的 `@font-face` `url()` 路径

### 第6步：组装页面 HTML

通过 API 读取页面当前的 `index.html`，将 `<body>` 内容替换为原 HTML 包中对应页面的 body 内容，然后通过 API 写回。每个页面最终结构：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面名称</title>
  <!-- 图标加载器（所有页面必须引入） -->
  <script src="../../resources/js/icon-loader.js"></script>
  <!-- 公共样式 -->
  <link rel="stylesheet" href="../../resources/css/xxx.css">
  <!-- 页面私有样式 -->
  <link rel="stylesheet" href="resources/css/style.css">
</head>
<body>
  <!-- 页面内容（从原 HTML <body> 中提取） -->

  <!-- 公共脚本 -->
  <script src="../../resources/js/navigate.js"></script>
  <script src="../../resources/js/xxx.js"></script>
  <!-- 页面私有脚本 -->
  <script src="resources/js/main.js"></script>
</body>
</html>
```

**关键规则**：

- 所有资源路径使用**相对路径**，**禁止** `/prototype/` 绝对路径。
- 必须引入 `../../resources/js/icon-loader.js` 和 `../../resources/js/navigate.js`。
- 若页面中有图标（`<iconpark-icon>`），确保 icon-loader.js 已正确配置加载 CDN。
- `<meta charset="UTF-8">` 和 `<meta name="viewport">` 必须保留。
- 语言设置为 `zh-CN`。

### 第7步：编写页面文档

通过 API 为每个页面写入 `docs/readme.md`：

```bash
curl -s -X POST "$API_BASE/api/file?project=$PROJECT" \
  -H 'Content-Type: application/json' \
  -d '{"path":"prototype/pages/<hash>/docs/readme.md","content":"<文档内容>"}'
```

文档内容参考结构：

```markdown
# 页面名称

## 功能描述
（简要说明页面功能，1-2 句话）

## 页面结构
（描述主要区块和布局）

## 资源依赖
- `resources/css/style.css` — 页面私有样式
- `resources/js/main.js` — 页面交互逻辑
- `../../resources/css/xxx.css` — （如有公共依赖，列出）
- `../../resources/js/xxx.js` — （如有公共依赖，列出）

## 页面间导航
（描述从哪些页面可跳转到此页面，以及从此页面可跳转到哪些页面）
```

### 第8步：更新项目索引

1. **更新 `RESOURCES.md`**：若新增了 `prototype/resources/` 下的公共 CSS/JS/字体/图片，记录新增内容及用途。
2. **更新 `COMPONENTS.md`**：若从包中提取了可复用组件（放入 `prototype/components/`），记录组件信息和复用方式。
3. **验证 sitemap**：调用 `GET $API_BASE/api/sitemap?project=$PROJECT` 确认所有新增页面已注册，层级关系正确。

---

## 适配对照表

| 原始写法 | AxHost-Make 写法 |
|---------|-----------------|
| `<a href="page2.html">` | `<a onclick="window.parent.postMessage({type:'axhost-navigate',path:'目标hash',tab:'pages'},'*')">` |
| `window.location.href = 'xxx'` | `window.parent.postMessage({ type: 'axhost-navigate', path: '目标hash', tab: 'pages' }, '*')` |
| `<link href="/css/style.css">` | `<link href="resources/css/style.css">`（相对路径） |
| `<script src="/js/app.js">` | `<script src="resources/js/main.js">`（相对路径） |
| `<img src="/images/logo.png">` | `<img src="resources/images/logo.png">`（相对路径） |
| `<i class="fa fa-home">` | `<iconpark-icon icon-id="home" size="14">`（改用图标组件） |
| CSS `background: url(/img/bg.png)` | CSS `background: url(../images/bg.png)`（相对路径） |

---

## 特殊情况处理

### 单 HTML 文件（无外部 CSS/JS）

1. 创建页面：`POST /api/create` `{"kind":"page"}`
2. 将 `<style>` 内容 → `resources/css/style.css`（通过 `/api/file` 写入）
3. 将 `<script>` 内容 → `resources/js/main.js`（通过 `/api/file` 写入）
4. 将 `<body>` 内容 → 读取 `index.html` 后替换 body 内容，通过 `/api/file` 写回
5. 添加必要的 meta 标签和资源引用

### 多个 HTML 共享同一套 CSS/JS

1. 公共 CSS → `prototype/resources/css/<包名>.css`（通过 `/api/file` 写入）
2. 公共 JS → `prototype/resources/js/<包名>.js`（通过 `/api/file` 写入）
3. 每个 HTML 创建独立页面，引用公共资源
4. 各页面私有样式/脚本放在各自的 `resources/` 下

### HTML 包中包含 index.html 入口

如果包中有一个 `index.html` 作为主入口，其他 HTML 为子页面：
1. `index.html` → 创建为根页面（`parentPath` 为 `prototype/pages`）
2. 子页面 → `parentPath` 设为 `prototype/pages/<主页hash>`
3. 更新主页中的链接为 `postMessage` 导航

### 响应式/移动端页面

若检测到页面包含移动端适配（viewport 为 device-width、触摸事件、手机尺寸样式）：
- 创建页面时添加 `"template":"mobile"` 参数
- 参考 `$FRAMEWORK/system-rules/mobile-frame-spec.md`

---

## 完成后检查清单

- [ ] 所有 HTML 页面已创建，`index.html` 内容正确
- [ ] 所有资源路径使用相对路径（无 `/prototype/` 绝对路径）
- [ ] 每个页面引入了 `icon-loader.js` 和 `navigate.js`
- [ ] 页面间的链接/跳转已改为 `postMessage` 方式
- [ ] 公共资源已提取到 `prototype/resources/` 并更新 `RESOURCES.md`
- [ ] 页面文档 `docs/readme.md` 已编写
- [ ] sitemap 包含所有新增页面，可通过 API 验证
- [ ] 在浏览器中打开各页面，确认样式正常、脚本无报错
- [ ] 图片/字体等静态资源可正常加载

---

## 注意事项

- **绝对不要**修改 `$FRAMEWORK` 下的框架源码。
- **绝对不要**使用 `/prototype/` 开头的绝对路径。
- **禁止**引入 Vue/React/Angular 等框架（除非用户明确要求且仅限单页面）。
- 所有代码使用原生 HTML/CSS/JS（ES6）。
- 注释和文案保持中文。
- 所有文件读写通过 API 完成，不依赖 `node` CLI。
- 操作前先向用户确认页面命名和层级结构，获得同意后再执行。
