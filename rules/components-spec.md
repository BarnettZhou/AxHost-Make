# 组件复用规范

> 本规范由 Agent 阅读，用于开发和复用 `prototype/components/` 下的组件时遵循

## 1. 组件目录定位

本项目使用 Axhost-Make 框架，`prototype/components/` 下的每个目录是一个**独立组件包**。组件有两种用途：

- **独立预览**：通过开发模式/预览模式左侧目录树打开，展示组件的完整效果和交互。
- **被页面复用**：组件的样式（CSS）和逻辑（JS）可以被 `prototype/pages/` 下的页面引用。

## 2. 组件设计原则（创建 component 时遵循）

### 2.1 分离「组件本体」与「演示外壳」

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

### 2.2 组件 CSS/JS 纯净原则

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

### 2.3 资源引用分层

| 资源类型 | 放置位置 | 引用方式 |
|---------|---------|---------|
| **项目级公共资源**（如 Toast、图标加载器） | `prototype/resources/` | `../../resources/xxx` |
| **组件私有资源**（组件专属样式/逻辑） | `components/xx/resources/` | `resources/xxx`（组件内） |

**规则**：
- 如果某个功能（如 Toast）可能在多个组件/页面中使用，**必须**将其 CSS/JS 提取到 `prototype/resources/` 下。
- 组件自身独有的样式和逻辑，保留在组件的 `resources/` 目录下。

### 2.4 组件化方案选择

根据组件复杂度，选择合适的实现方式：

#### 方案 A：Web Components（推荐）

使用浏览器原生 Custom Elements API，**不需要 build**，支持声明式标签 `<ax-xxx>`。

**推荐写法**：

```js
// components/xx/resources/js/main.js
class AxToolbarRow1 extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="toolbar-wrap">...</div>
    `;
    this.initInteractions();
  }
  initInteractions() {
    // 使用 this.querySelector() 绑定事件，避免全局 ID 冲突
    const btn = this.querySelector('.my-btn');
    btn.addEventListener('click', () => { ... });
  }
}
customElements.define('ax-toolbar-row1', AxToolbarRow1);
```

**关键原则**：
- 采用 **light DOM** 模式（不使用 Shadow DOM），页面级 CSS 完全透传生效
- 事件绑定使用 `this.querySelector()`，避免与页面其他元素 ID 冲突
- 交互逻辑自包含在组件类中，页面无需额外初始化代码
- 通用功能（如横向滚动按钮）也内聚在组件内部

#### 方案 B：函数式初始化（备选）

对于简单 UI 片段或需要精细控制初始化时机的场景，暴露 `init()` 函数。

```js
window.AxComponents = window.AxComponents || {};
window.AxComponents.DatePicker = {
  init: function(container, options) { ... }
};
```

> **注意**：组件 JS 文件**不应**包含自动初始化代码。演示模式的初始化放在 `index.html` 的内联 `<script>` 中（见 2.2 节）。

## 3. 页面复用组件原则（创建 page 时遵循）

### 3.1 复用优先于重写

在创建新 page 之前，Agent **必须**检查 `prototype/components/` 下是否已有功能相似的组件。

检查步骤：
1. 读取 `prototype/sitemap.js` 中的 `components` 列表，了解已有组件。
2. 如果 page 需要的功能已有对应组件，**优先复用**该组件的资源，禁止重新实现相同功能。

### 3.2 复用方式

根据组件类型，选择合适的复用方式：

| 组件类型 | 复用方式 | 示例 |
|---------|---------|------|
| **全局工具类**（Toast、Loading 等） | 引用公共资源 | `<script src="../../resources/js/toast.js">` |
| **Web Components**（toolbar、卡片等 UI 区块） | 引用组件 JS + 使用自定义标签 | `<script src="../../components/xx/resources/js/main.js"></script>` + `<ax-toolbar-row1></ax-toolbar-row1>` |
| **UI 片段类**（弹窗、筛选器、表单等） | 引用组件资源 + copy HTML 结构 | 引用 `components/xx/resources/css/style.css`，从组件 `index.html` 中提取 `.ax-component` 片段 |
| **布局框架类**（页面通用结构） | 以已有 page 为蓝本复制修改 | 参考同项目下已有的模板页面 |

### 3.3 引用路径规范

假设 page 位于 `pages/xxxxx/index.html`，component 位于 `components/yyyyy/index.html`：

```html
<!-- 引用组件私有样式 -->
<link rel="stylesheet" href="../../components/yyyyy/resources/css/style.css">

<!-- 引用组件私有逻辑 -->
<script src="../../components/yyyyy/resources/js/main.js"></script>

<!-- 引用项目公共资源 -->
<link rel="stylesheet" href="../../resources/css/toast.css">
<script src="../../resources/js/toast.js"></script>
```

### 3.4 LLM 复用组件的工作流

当 page 需要用到某个组件时，Agent 应按以下步骤操作：

#### 方式一：Web Components 组件（推荐）

1. **读取组件源码**：打开 `components/xx/index.html` 和 `components/xx/resources/js/main.js`。
2. **引入组件脚本**：在 page 的 `index.html` 中添加 `<script src="../../components/xx/resources/js/main.js"></script>`。
3. **使用自定义标签**：在需要的位置插入 `<ax-xxx></ax-xxx>`。
4. **确保样式生效**：由于采用 light DOM，组件依赖页面级 CSS。检查 page 的 CSS 中是否已包含组件所需的样式类。
5. **控制组件显隐（如需要）**：通过 `document.getElementById('xxx').style.display` 或组件暴露的属性控制。

> **⚠️ 注意：Web Components 使用 light DOM**
>
> 组件通过 `this.innerHTML = ...` 渲染内容到 light DOM 中，页面级 CSS 直接生效，无需额外引入组件样式文件。
>
> 但这也意味着：
> - 组件**不**自带样式隔离，依赖页面提供必要的 CSS 类。
> - 组件内部的 ID 在页面全局命名空间中，应避免与页面其他元素 ID 冲突（组件内部推荐使用 `this.querySelector('.class')` 而非 `document.getElementById`）。

#### 方式二：函数式组件（传统方式）

1. **读取组件源码**：打开 `components/xx/index.html` 和 `components/xx/resources/` 下的文件。
2. **提取可复用片段**：从 `index.html` 的 `<body>` 中提取 `.ax-component` 部分（排除 `.demo-controls` 等演示代码）。
3. **修正路径**：将组件内部相对路径修正为相对于 page 的路径。
4. **初始化为 page 场景**：在 page 的 `main.js` 中调用组件暴露的 `init()` 函数，传入 page 内的实际容器。
5. **补充文档**：如果复用过程中发现组件缺少必要的 API 或结构不通用，先修改组件（提升其通用性），再完成 page。

> **⚠️ 注意：`init()` 会接管容器的 innerHTML**
>
> 传给 `init()` 的容器必须是**空容器**（或 page 不关心其内容被覆盖）。

## 4. 组件文档要求

每个组件的 `docs/readme.md` 应包含「复用指南」章节，说明：

- 该组件提供了哪些可复用资源（CSS/JS 文件路径）
- 组件的功能说明和交互说明
- 如何在 page 中引入和调用
- 是否依赖项目公共资源或页面级 CSS

### Web Components 组件的复用指南示例

```markdown
## 复用指南

### 1. 引入脚本

在页面 HTML 的 `</body>` 前添加：

```html
<script src="../../components/97bc28e4/resources/js/main.js"></script>
```

路径需根据当前文件位置调整。例如从 `pages/xxx/index.html` 引入时为 `../../components/...`。

### 2. 使用组件标签

在需要放置组件的位置插入：

```html
<ax-toolbar-row1></ax-toolbar-row1>
```

### 3. 样式依赖

组件采用 **light DOM** 模式（无 Shadow DOM），依赖页面级 CSS。请确保页面已引入组件所需的样式类。

### 4. 交互说明

| 元素 | 交互 |
|------|------|
| 按钮 A | 点击触发 xxx |
| 按钮 B | 点击触发 yyy |
```

### 函数式组件的复用指南示例

```markdown
## 复用指南

### 可复用资源
- CSS: `resources/css/style.css`
- JS: `resources/js/main.js`

### 在 Page 中使用

```html
<link rel="stylesheet" href="../../components/97bc28e4/resources/css/style.css">
<div class="filter-popup" id="myFilter"></div>
<script src="../../components/97bc28e4/resources/js/main.js"></script>
```

```js
AxComponents.Filter.init(document.getElementById('myFilter'));
```

## 5. 公共资源清单

每个项目应在 `rules/resources.md` 中维护**本项目特有的公共资源清单**，记录已沉淀的可复用资源（如 Toast、Loading、通用弹窗、公共 CSS 变量等）。

框架默认提供的公共资源（如 `resources/js/icon-loader.js`、`resources/css/shell.css`、`resources/js/marked.min.js` 等）无需重复记录。

**规则**：
- 当某个功能在多个组件或页面中出现时，应将其 CSS/JS 提取到 `prototype/resources/` 下。
- 提取后，必须同步更新 `rules/resources.md`，补充该资源的路径、用途和引用方式。
- Agent 在创建新 page/component 前，应先查阅 `rules/resources.md`，优先引用已有公共资源，禁止重复实现。
