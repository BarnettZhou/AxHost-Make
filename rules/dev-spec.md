# 开发规范（Dev Spec）

> 本开发规范由 Agent 阅读，用于开发原型页面时使用

## 组件复用规范

### 1. 组件目录定位

本项目使用 Axhost-Make 框架，`prototype/components/` 下的每个目录是一个**独立组件包**。组件有两种用途：

- **独立预览**：通过开发模式/预览模式左侧目录树打开，展示组件的完整效果和交互。
- **被页面复用**：组件的样式（CSS）和逻辑（JS）可以被 `prototype/pages/` 下的页面引用。

### 2. 组件设计原则（创建 component 时遵循）

#### 2.1 分离「组件本体」与「演示外壳」

组件的 `index.html` 应该清晰区分**可复用的核心 DOM**和**仅供演示的触发代码**。

推荐结构：

```html
<body>
  <!-- ========== 组件本体（可被 page 复用）========== -->
  <div class="ax-component" id="toast-container">
    <!-- 组件真正的 HTML 结构 -->
  </div>

  <!-- ========== 演示外壳（仅用于独立预览）========== -->
  <div class="demo-controls">
    <button onclick="showToast()">触发 Toast</button>
  </div>
</body>
```

> **说明**：`ax-component` 类名不是强制要求，但建议用作标记，方便 LLM 在复用时快速识别组件本体。

#### 2.2 组件 CSS/JS 纯净原则

组件的 `resources/css/style.css` 和 `resources/js/main.js` **只能包含组件功能本身**的样式和逻辑，**严禁**写入以下演示专用内容：

| 禁止写入组件 CSS/JS 的内容 | 原因 | 应该放在哪里 |
|---|---|---|
| `* { margin:0; padding:0; box-sizing:border-box }` | 全局重置，会污染引用页面的所有元素 | `index.html` 内联 `<style>` |
| `html, body { ... }` | 页面级样式，会覆盖引用页面的 body 背景色和布局 | `index.html` 内联 `<style>` |
| `.component-wrapper { ... }` | 手机壳演示容器，引用页面有自己的壳（`.phone`） | `index.html` 内联 `<style>` |
| `.demo-title`、`.demo-desc` 等 | 演示说明文字 | `index.html` 内联 `<style>` |
| 组件 demo 自动初始化代码 | 引用页面需要自己控制初始化时机和参数 | `index.html` 内联 `<script>` |

**正确示例**：

```
components/xxx/
├── index.html              ← 演示页（含内联 <style> 和 <script>）
├── resources/
│   ├── css/style.css       ← 仅组件功能样式（弹窗、列表、按钮等）
│   └── js/main.js          ← 仅组件逻辑（AxComponents.Xxx = {...}）
└── docs/readme.md
```

组件 CSS 文件应该从第一个组件类名开始，组件 JS 文件以 IIFE 收尾，不含演示初始化：

```css
/* ✅ 正确：resources/css/style.css —— 纯组件样式 */
.date-picker-trigger { ... }
.date-picker-mask { ... }
.date-picker-popup { ... }
```

```js
// ✅ 正确：resources/js/main.js —— 纯组件逻辑，不含 auto-init
(function() {
  'use strict';
  window.AxComponents = window.AxComponents || {};
  window.AxComponents.DatePicker = {
    init: function(container, options) { ... }
  };
})();
```

```html
<!-- ✅ 正确：index.html —— 演示专属样式和初始化放在内联 -->
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { ... }
  .component-wrapper { ... }
  .demo-title { ... }
</style>
<script>
  // 演示模式自动初始化
  AxComponents.DatePicker.init(document.getElementById('datePickerDemo'), { ... });
</script>
```

> **原则**：假设一个 page 引用了组件的 CSS/JS，它应该只获得弹窗/选择器等**功能**，而不会被篡改背景色、不会多出一个手机壳、不会自动弹出 demo。

#### 2.3 资源引用分层

| 资源类型 | 放置位置 | 引用方式 |
|---------|---------|---------|
| **项目级公共资源**（如 Toast、图标加载器） | `prototype/resources/` | `../../resources/xxx` |
| **组件私有资源**（组件专属样式/逻辑） | `components/xx/resources/` | `resources/xxx`（组件内） |

**规则**：
- 如果某个功能（如 Toast）可能在多个组件/页面中使用，**必须**将其 CSS/JS 提取到 `prototype/resources/` 下。
- 组件自身独有的样式和逻辑，保留在组件的 `resources/` 目录下。

#### 2.4 组件初始化函数化

组件的 JS 应该暴露一个**可重复调用的初始化函数**，而不是在页面加载时立即执行。这样 page 可以按需初始化。

**推荐写法**：

```js
// components/xx/resources/js/main.js
window.AxComponents = window.AxComponents || {};
window.AxComponents.Toast = {
  init: function(container) {
    // 在 container 内初始化组件
    // 返回组件实例或控制接口
  },
  show: function(message) {
    // 公共 API
  }
};
```

> **注意**：组件 JS 文件**不应**包含自动初始化代码。演示模式的初始化放在 `index.html` 的内联 `<script>` 中（见 2.2 节）。

### 3. 页面复用组件原则（创建 page 时遵循）

#### 3.1 复用优先于重写

在创建新 page 之前，Agent **必须**检查 `prototype/components/` 下是否已有功能相似的组件。

检查步骤：
1. 读取 `prototype/sitemap.js` 中的 `components` 列表，了解已有组件。
2. 如果 page 需要的功能已有对应组件，**优先复用**该组件的资源，禁止重新实现相同功能。

#### 3.2 复用方式

根据组件类型，选择合适的复用方式：

| 组件类型 | 复用方式 | 示例 |
|---------|---------|------|
| **全局工具类**（Toast、Loading 等） | 引用公共资源 | `<script src="../../resources/js/toast.js">` |
| **UI 片段类**（弹窗、筛选器、表单等） | 引用组件资源 + copy HTML 结构 | 引用 `components/xx/resources/css/style.css`，从组件 `index.html` 中提取 `.ax-component` 片段 |
| **布局框架类**（页面通用结构） | 以已有 page 为蓝本复制修改 | 参考同项目下已有的模板页面 |

#### 3.3 引用路径规范

假设 page 位于 `pages/xxxxx/index.html`，component 位于 `components/yyyyy/index.html`：

```html
<!-- 引用组件私有样式 -->
<link rel="stylesheet" href="../components/yyyyy/resources/css/style.css">

<!-- 引用组件私有逻辑 -->
<script src="../components/yyyyy/resources/js/main.js"></script>

<!-- 引用项目公共资源 -->
<link rel="stylesheet" href="../../resources/css/toast.css">
<script src="../../resources/js/toast.js"></script>
```

#### 3.4 LLM 复用组件的工作流

当 page 需要用到某个组件时，Agent 应按以下步骤操作：

1. **读取组件源码**：打开 `components/xx/index.html` 和 `components/xx/resources/` 下的文件。
2. **提取可复用片段**：从 `index.html` 的 `<body>` 中提取 `.ax-component` 部分（排除 `.demo-controls` 等演示代码）。
3. **修正路径**：将组件内部相对路径（如 `resources/css/style.css`）修正为相对于 page 的路径（如 `../components/xx/resources/css/style.css`）。
4. **初始化为 page 场景**：在 page 的 `main.js` 中调用组件暴露的 `init()` 函数，传入 page 内的实际容器。
5. **补充文档**：如果复用过程中发现组件缺少必要的 API 或结构不通用，先修改组件（提升其通用性），再完成 page。

### 4. 组件文档要求

每个组件的 `docs/readme.md` 应包含「复用指南」章节，说明：

- 该组件提供了哪些可复用资源（CSS/JS 文件路径）
- 组件本体的 HTML 结构示例
- 如何在 page 中初始化和调用
- 是否依赖项目公共资源

示例：

```markdown
## 复用指南

### 可复用资源
- CSS: `resources/css/style.css`
- JS: `resources/js/main.js`

### 在 Page 中使用

```html
<link rel="stylesheet" href="../components/97bc28e4/resources/css/style.css">
<div class="filter-popup" id="myFilter">
  <!-- 组件结构 -->
</div>
<script src="../components/97bc28e4/resources/js/main.js"></script>
```

```js
AxComponents.Filter.init(document.getElementById('myFilter'));
```

### 5. 公共资源清单

每个项目应在 `rules/resources.md` 中维护**本项目特有的公共资源清单**，记录已沉淀的可复用资源（如 Toast、Loading、通用弹窗、公共 CSS 变量等）。

框架默认提供的公共资源（如 `resources/js/icon-loader.js`、`resources/css/shell.css`、`resources/js/marked.min.js` 等）无需重复记录。

**规则**：
- 当某个功能在多个组件或页面中出现时，应将其 CSS/JS 提取到 `prototype/resources/` 下。
- 提取后，必须同步更新 `rules/resources.md`，补充该资源的路径、用途和引用方式。
- Agent 在创建新 page/component 前，应先查阅 `rules/resources.md`，优先引用已有公共资源，禁止重复实现。

---

## 图标加载规范

### 1. Shell 与原型页面分离
- **Shell（`prototype/index.html`）** 使用独立的图标加载器：`resources/js/icons.js`。
- **原型页面（`prototype/pages/` 与 `prototype/components/`）** 必须使用专用的图标加载器：`resources/js/icon-loader.js`，禁止直接引用 Shell 的 `icons.js`，以确保两者解耦、可独立升级。

### 2. icon-loader 使用方式
在原型页面 HTML 的 `<body>` 底部（`main.js` 之前）引入：

```html
<!-- 页面/组件内使用相对路径引用全局资源 -->
<script src="../../resources/js/icon-loader.js"></script>
```

> **注意**：项目可能部署在子目录中，**禁止**使用 `/prototype/resources/...` 这种绝对路径，否则会导致 404。

### 3. 图标 CDN 说明
原型项目的图标由独立的 CDN 服务提供。Agent 在实现 `icon-loader.js` 时，应遵循以下原则：

- **优先使用项目当前已指定的 CDN 服务**：查阅 `rules/dev-spec.md` 中记录的 CDN 服务商、接入文档及使用规范。
- **若项目中未指定 CDN**：根据页面需求选择合适的图标方案（如 IconPark、FontAwesome、阿里巴巴 Iconfont 等），并将所选 CDN 的接入信息补充到 `rules/dev-spec.md` 中，确保后续迭代有一致性依据。
- **Loader 实现方式**：`icon-loader.js` 负责异步加载图标脚本。Agent 应根据所选 CDN 的官方接入文档，生成对应的脚本注入逻辑（如 `defer/async`、ES5/ES2019 分支、重复加载防护等）。
- **规范同步**：一旦切换或升级 CDN 服务，必须同步更新 `rules/dev-spec.md`，使规范与代码保持一致。

### 4. icon-loader.js 实现要求
Agent 在生成 `prototype/resources/js/icon-loader.js` 时，应满足以下技术约束：

- **无外部依赖**：使用原生 JavaScript（ES5/ES6）编写，不依赖任何框架或库。
- **异步加载**：通过动态创建 `<script>` 标签加载图标 CDN，推荐使用 `defer` 或 `async`。
- **重复加载防护**：在注入脚本前检查页面中是否已存在相同标识的脚本（如 `data-iconpark-proto` 等自定义属性），避免重复请求。
- **降级兼容（可选）**：若 CDN 提供 ES5 与 ES2019+ 两个版本，可通过全局标志（如 `window.__protoIconParkES5`）控制加载哪个版本，默认加载现代版本。
- **容错处理**：若 `document.currentScript` 不可用，应回退到 `document.head.appendChild(script)`。

### 5. 图标使用方式
图标的具体使用方式取决于所选 CDN 服务。常见形式包括：

- 自定义元素（如 `<iconpark-icon icon-id="..." size="16" color="currentColor"></iconpark-icon>`）
- CSS 类名（如 `<i class="icon icon-chart-line"></i>`）
- SVG 直接引用

Agent 在引入图标时，应参考对应 CDN 的官方文档，选择最符合当前页面技术栈的用法，并在 `rules/dev-spec.md` 中记录该项目的默认用法，以便统一维护。

---

## 页面跳转规范

### 1. 两种运行环境
原型页面可能在两种环境下运行，跳转方式需做区分：

| 环境 | 说明 | 推荐跳转方式 |
|------|------|-------------|
| **开发模式（Serve）** | 页面运行在 iframe 中，由 Shell 框架包裹 | `window.parent.postMessage` |
| **预览模式（Preview）** | 页面运行在 iframe 中，由 Preview 框架包裹 | `window.parent.postMessage` |

### 2. 开发模式（Serve）下的跳转
在开发模式下，页面被加载在 `preview-frame` iframe 中。**禁止**在 iframe 内直接使用 `window.location.href` 进行绝对路径跳转，原因：
- 父页面（Shell）感知不到 iframe 内的导航，左侧目录树不会同步高亮
- 绝对路径可能因部署目录变化而失效

**正确做法**：通过 `postMessage` 通知父页面统一导航。

```js
function navigateTo(targetHash, tab = 'pages') {
  // 开发模式和预览模式均通过 postMessage 通知父页面统一导航
  window.parent.postMessage({ type: 'axhost-navigate', path: targetHash, tab }, '*');
}

// 使用示例：从登录页跳转到首页
navigateTo('313becb1', 'pages');
```

> `targetHash` 为目标页面的 8 位 hash 目录名（如 `313becb1`），`tab` 可选值为 `pages` 或 `components`。

### 3. 预览模式（Preview）下的跳转
预览模式下页面同样运行在 iframe 中（由 Preview 框架包裹），**同样使用 `postMessage` 通知父页面导航**，左侧目录树会自动同步高亮。

```js
window.parent.postMessage({ type: 'axhost-navigate', path: '目标hash', tab: 'pages' }, '*');
```

### 4. 兜底兼容
框架已添加 iframe `load` 事件监听，即使页面直接使用 `window.location.href` 跳转，左侧目录树也会在 iframe 加载完成后自动同步。但仍强烈建议采用 `postMessage` 方案，以获得更即时、更可靠的导航体验。
