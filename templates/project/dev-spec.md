# 开发规范（Dev Spec）

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
