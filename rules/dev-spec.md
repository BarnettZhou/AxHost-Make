# 开发规范

> 所有原型页面开发时遵循。

## 图标加载

### Shell 与页面分离

- **Shell**（`prototype/index.html`）使用 `resources/js/icons.js`。
- **原型页面**（`pages/`、`components/`）使用 `resources/js/icon-loader.js`，禁止引用 Shell 的 `icons.js`，确保解耦。

### icon-loader.js 要求

- 原生 JavaScript，无外部依赖。
- 通过动态创建 `<script>` 标签异步加载图标 CDN。
- 注入前检查是否已存在相同标识的脚本，避免重复加载。
- 若 CDN 提供 ES5/ES2019 双版本，通过全局标志控制加载版本，默认加载现代版本。
- `document.currentScript` 不可用时回退到 `document.head.appendChild`。

### 引用方式

```html
<script src="../../resources/js/icon-loader.js"></script>
```

禁止 `/prototype/` 绝对路径。图标 CDN 选型和接入方式维护在项目 `rules/dev-spec.md` 中。

## 页面跳转

### 环境

页面运行在 iframe 中（开发模式 Shell / 预览模式 Preview），**禁止**直接使用 `window.location.href` 进行跳转，否则父页面无法感知导航、左侧目录树不同步。

### 正确方式

通过 `postMessage` 通知父页面统一导航：

```js
window.parent.postMessage(
  { type: 'axhost-navigate', path: '目标hash', tab: 'pages' },
  '*'
);
```

`tab` 可选 `pages` 或 `components`。

框架已对 `window.location.href` 跳转做兜底兼容（iframe `load` 事件监听），但仍强烈建议使用 `postMessage` 以获得即时可靠的导航体验。
