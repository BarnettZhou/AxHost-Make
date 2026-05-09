# 系统规则概述

本目录存放 **Axhost-Make** 框架的系统规则与开发规范，供 Agent 在开发原型页面时阅读与遵循。

---

## 文件清单

| 文件 | 说明 | 适用场景 |
|------|------|----------|
| [`dev-spec.md`](./dev-spec.md) | 开发规范 | 所有原型页面开发 |
| [`components-spec.md`](./components-spec.md) | 组件复用规范 | 创建/复用组件 |
| [`mobile-frame-spec.md`](./mobile-frame-spec.md) | 手机端框架规范 | 手机端 / 小程序原型开发 |

---

## `dev-spec.md` — 开发规范

涵盖原型页面开发中的通用技术约定：

- **图标加载规范**
  - Shell 与原型页面使用独立的图标加载器（`icons.js` vs `icon-loader.js`），确保解耦。
  - `icon-loader.js` 需使用原生 JS 实现，支持异步加载、重复加载防护、降级兼容。
  - 图标 CDN 的选择与接入方式需在规范中同步记录，保持项目一致性。

- **页面跳转规范**
  - 开发模式（Serve）和预览模式（Preview）下，页面均运行在 iframe 中。
  - 页面跳转**禁止**直接使用 `window.location.href`，应通过 `postMessage` 通知父页面统一导航，确保左侧目录树同步高亮。
  - 框架已对兜底场景做兼容，但仍强烈建议采用 `postMessage` 方案。

---

## `components-spec.md` — 组件复用规范

创建和维护 `prototype/components/` 下的组件时必须遵循的规范：

- **组件设计原则**
  - 分离「组件本体」与「演示外壳」，`ax-component` 标记可复用核心 DOM。
  - 组件 CSS/JS 纯净原则：严禁在组件资源中写入全局重置、页面级样式、演示容器或自动初始化代码。
  - 资源引用分层：项目级公共资源放 `prototype/resources/`，组件私有资源放组件 `resources/` 下。
  - 组件化方案选择：支持 **Web Components**（原生 Custom Elements，声明式标签 `<ax-xxx>`）和 **函数式初始化**（暴露 `init()` API）两种模式，根据组件复杂度灵活选择。

- **页面复用组件原则**
  - 复用优先于重写：创建 page 前先检查已有组件。
  - 明确复用方式：全局工具类引用公共资源，Web Components 引用组件 JS + 使用自定义标签，UI 片段类引用组件资源 + copy HTML 结构。
  - Web Components 采用 light DOM（无 Shadow DOM），页面级 CSS 直接生效，组件内部使用 `this.querySelector()` 避免全局 ID 冲突。
  - 函数式组件注意 `init()` 会接管容器 innerHTML，自定义内容应与组件容器分离。

- **组件文档要求**
  - 每个组件的 `docs/readme.md` 应包含「复用指南」章节。
  - 项目应在 `rules/resources.md` 中维护公共资源清单。

---

## `mobile-frame-spec.md` — 手机端框架规范

当绘制手机端原型（含小程序）时，必须遵守的容器与外壳规范：

- **容器规格**
  - 手机容器固定尺寸 `375px × 812px`，居中展示，外层背景色 `#ebe7f3`。
  - 容器不加圆角，需添加阴影 `0 12px 50px rgba(0, 0, 0, 0.25)`。
  - 内部滚动区域禁止显示滚动条。

- **Class 命名规范**
  - 统一使用 `.phone`、`.status-bar`、`.mini-program-bar`、`.page-content`、`.home-indicator` 等命名。
  - 弹窗 / 遮罩必须放置在 `.phone` 内部，使用 `position: absolute`，确保只覆盖手机容器区域。

- **微信小程序外壳（Mini Program Shell）**
  - 由状态栏（`44px`）、小程序导航栏（`44px`）、页面内容区、Home Indicator（`34px`）四层组成。
  - 状态栏包含时间、灵动岛、信号与电量图标；导航栏包含标题与胶囊按钮（更多 / 关闭）。
  - 所有具体业务内容必须写在页面内容区内，禁止写在外壳区域。
  - 外壳配色需跟随页面主题（暗黑 / 亮色模式），保持视觉统一。

---

## 使用指引

1. **开发任何原型页面前**，先阅读 [`dev-spec.md`](./dev-spec.md) 了解通用规范。
2. **若涉及组件的创建或复用**，阅读 [`components-spec.md`](./components-spec.md)。
3. **若当前需求为手机端 / 小程序原型**，额外阅读 [`mobile-frame-spec.md`](./mobile-frame-spec.md) 并严格遵守容器与外壳规范。
4. 规范与代码需保持一致；切换或升级技术方案时，同步更新对应的规则文件。
