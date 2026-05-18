# 组件复用规范

> 用于开发 `prototype/components/` 下的组件，以及页面复用组件时遵循。

## 1. 组件定位

`prototype/components/{hash}/` 下每个目录是一个独立组件包，有两种用途：
- **独立预览**：通过开发模式左侧目录树打开，展示完整效果和交互。
- **被页面复用**：组件的 CSS/JS 可被 `prototype/pages/` 下的页面引用。

## 2. 模板选择

创建组件时提供两种模板：

| 模板 | 使用场景 | 对应文件 |
|------|---------|---------|
| 默认 | 桌面端组件，居中 `demo-container` 上中下三区结构 | `templates/project/components/component.html` |
| 手机 | 手机端组件，手机外壳 + 右侧控制面板 | `templates/project/components/component-mobile.html` |

两种模板的演示外壳 CSS 均内联在 `<style>` 中，`resources/css/style.css` 保持空白，由 Agent 填充组件本身样式。

> **开发前检查**：创建组件前，必须先查阅项目 `rules/design.md`，了解已有的公共样式、配色方案和可复用组件，优先引用而非重写。

## 3. 组件设计原则

### 3.1 分离「组件本体」与「演示外壳」

组件的 `index.html` 应清晰区分核心 DOM 和演示代码。

**默认模板结构**（`demo-container` 1200×720 max，页面背景 `#ebe7f3`）：

```html
<body>
  <div class="demo-container">
    <div class="demo-header">
      <h2>组件名称</h2>            <!-- 演示：标题 -->
    </div>
    <div class="demo-body">
      <!-- ========== 组件本体（可被 page 复用）========== -->
      <div class="ax-component">
        <!-- 组件真正的 HTML 结构 -->
      </div>
    </div>
    <div class="demo-footer demo-controls">
      <!-- 演示：触发按钮 -->
    </div>
  </div>
</body>
```

**手机模板结构**（手机外壳 375×812 + 右侧控制面板 280×812，页面背景 `#ebe7f3`）：

```html
<body>
  <div class="phone">               <!-- 手机外壳（状态栏 + 内容 + Home Indicator）-->
    <div class="phone-content">
      <div class="ax-component">
        <!-- 组件真正的 HTML 结构 -->
      </div>
    </div>
  </div>
  <div class="control-panel">       <!-- 右侧控制面板 -->
    <div class="control-panel-header">
      <h2>组件名称</h2>            <!-- 演示：标题 -->
    </div>
    <div class="control-panel-body demo-controls">
      <!-- 演示：触发按钮 -->
    </div>
  </div>
</body>
```

`ax-component` 类名用于标记可复用核心 DOM，方便 LLM 快速识别。
`demo-controls` 类名用于标记演示交互区域，Agent 添加触发按钮时应放在此处。

### 3.1.1 遮罩层限定规则

若组件示例中包含唤起 modal/drawer 的场景（含遮罩层），遮罩层**必须限定在 `.demo-body` 内**，不得覆盖全局页面。

- `.demo-body` 需设置 `position: relative`，作为遮罩层和弹窗的定位锚点。
- 遮罩层使用 `position: absolute`（**禁止 `fixed`**），确保其只覆盖 `.demo-body` 区域。
- modal/drawer 弹窗本体同样使用 `position: absolute`，定位在 `.demo-body` 内。

**原则**：demo 的一切交互效果限定在 `demo-container` 内。

### 3.2 CSS/JS 纯净原则

组件 `resources/css/style.css` 和 `resources/js/main.js` **只能包含组件功能本身**的样式和逻辑，**严禁**写入以下内容：

| 禁止内容 | 原因 | 应放在哪里 |
|---------|------|-----------|
| `* { margin:0; ... }` | 全局重置会污染引用页面 | `index.html` 内联 `<style>` |
| `html, body { ... }` | 页面级样式会覆盖引用页面 | `index.html` 内联 `<style>` |
| `.component-wrapper { ... }` | 演示容器，引用页面有自己的壳 | `index.html` 内联 `<style>` |
| 组件 demo 自动初始化 | 引用页面需自己控制时机和参数 | `index.html` 内联 `<script>` |

**正确示例**：

```css
/* resources/css/style.css —— 纯组件样式，从第一个组件类名开始 */
.date-picker-trigger { ... }
.date-picker-mask { ... }
.date-picker-popup { ... }
```

```js
// resources/js/main.js —— 纯组件逻辑，不含 auto-init
(function() {
  'use strict';
  window.AxComponents = window.AxComponents || {};
  window.AxComponents.DatePicker = {
    init: function(container, options) { ... }
  };
})();
```

演示专属样式和初始化代码放在 `index.html` 的内联 `<style>` 和 `<script>` 中。

### 3.3 资源引用分层

| 资源类型 | 放置位置 | 引用方式 |
|---------|---------|---------|
| 项目级公共资源 | `prototype/resources/` | `../../resources/xxx` |
| 组件私有资源 | `components/{hash}/resources/` | `resources/xxx`（组件内） |

如果某个功能可能在多个组件/页面中使用，**必须**将其提取到 `prototype/resources/` 下。

### 3.4 组件化方案

#### 方案 A：Web Components（推荐）

使用原生 Custom Elements API，light DOM 模式（不使用 Shadow DOM），页面级 CSS 直接透传：

```js
class AxToolbarRow1 extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<div class="toolbar-wrap">...</div>`;
    this.initInteractions();
  }
  initInteractions() {
    const btn = this.querySelector('.my-btn');
    btn.addEventListener('click', () => { ... });
  }
}
customElements.define('ax-toolbar-row1', AxToolbarRow1);
```

- 事件绑定使用 `this.querySelector()` 避免全局 ID 冲突。
- 交互逻辑自包含，页面无需额外初始化代码。

#### 方案 B：函数式初始化

适用于需精细控制初始化时机的场景：

```js
window.AxComponents = window.AxComponents || {};
window.AxComponents.DatePicker = {
  init: function(container, options) { ... }
};
```

组件 JS **不应**包含自动初始化代码。演示初始化放在 `index.html` 内联 `<script>` 中。

## 4. 页面复用组件

### 4.1 复用优先于重写

创建新 page 前，**必须**检查 `prototype/components/` 下是否已有功能相似的组件。通过 `prototype/sitemap.js` 的 components 列表了解已有组件。

### 4.2 复用方式

| 组件类型 | 复用方式 |
|---------|---------|
| 全局工具类（Toast、Loading） | 引用公共资源：`<script src="../../resources/js/toast.js">` |
| Web Components | 引用组件 JS + 使用自定义标签 `<ax-xxx>` |
| UI 片段类（弹窗、筛选器等） | 引用组件 CSS + 从组件 `index.html` 提取 `.ax-component` 片段 |

### 4.3 引用路径

page 位于 `pages/{hash}/`，component 位于 `components/{hash}/`：

```html
<!-- 组件私有资源 -->
<link rel="stylesheet" href="../../components/{hash}/resources/css/style.css">
<script src="../../components/{hash}/resources/js/main.js"></script>

<!-- 项目公共资源 -->
<link rel="stylesheet" href="../../resources/css/toast.css">
```

### 4.4 Web Components 复用流程

1. 在 page 中添加 `<script src="../../components/{hash}/resources/js/main.js"></script>`
2. 在需要的位置插入 `<ax-xxx></ax-xxx>`
3. 确保页面 CSS 包含组件所需样式类（light DOM 模式依赖页面级 CSS）
4. 通过 `element.style.display` 或组件暴露的属性控制显隐

> Web Components 使用 light DOM，页面级 CSS 直接生效。组件内部避免使用可能冲突的全局 ID。

### 4.5 函数式组件复用流程

1. 从组件 `index.html` 提取 `.ax-component` 片段（排除 `.demo-controls`）
2. 修正资源路径为相对于 page 的路径
3. 在 page 的 JS 中调用组件暴露的 `init()` 函数
4. 传给 `init()` 的容器必须是空容器（`init()` 会接管 innerHTML）

## 5. 组件文档

每个组件的 `docs/readme.md` 应包含「复用指南」章节，说明：
- 可复用资源（CSS/JS 文件路径）
- 功能与交互说明
- 页面引入和调用方式
- 是否依赖项目公共资源或页面级 CSS

## 6. 公共资源清单

项目应在 `rules/resources.md` 中维护公共资源清单。当某功能在多个组件/页面中出现时，提取到 `prototype/resources/` 并更新清单。Agent 创建新 page/component 前应查阅清单，优先引用已有资源。
