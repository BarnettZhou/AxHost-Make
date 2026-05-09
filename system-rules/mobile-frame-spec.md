# 手机端框架规范

> 手机端/小程序原型开发时遵循。**模板为第一手规范**，本文件补充模板无法表达的约定。

## 模板选择

框架提供两个模板，通过 CLI 创建时自动生成完整 HTML+CSS：

| 模板 | 使用场景 | 创建命令 |
|------|---------|---------|
| `templates/project/pages/mobile.html` + `mobile.css` | 手机端页面（状态栏 + 内容 + Home Indicator） | `add-page`（手机端） |
| `templates/project/pages/mini-program.html` + `mini-program.css` | 小程序页面（状态栏 + 导航栏 + 内容 + Home Indicator） | `add-page`（小程序） |

模板 CSS 已覆盖：容器规格（375×812）、阴影、滚动条隐藏、状态栏、灵动岛、信号/电量图标、胶囊按钮、Home Indicator 等全部外壳样式。**Agent 开发时以模板 CSS 中的实际值为准，本文件不再逐像素复述。**

## Class 命名约定

模板中已预置以下 class，页面内容区内新增元素应保持一致的命名：

| 元素 | class |
|------|-------|
| 手机容器 | `.phone` |
| 状态栏 | `.status-bar` |
| 小程序导航栏 | `.mini-program-bar` |
| 页面内容区 | `.page-content`（手机）/ `.mini-program-content`（小程序） |
| Home Indicator | `.home-indicator` |

## 弹窗/遮罩定位

- 所有弹窗、遮罩、Modal **必须**放在 `.phone` 容器内部。
- 使用 `position: absolute`（非 `fixed`），确保只覆盖手机区域。
- `.phone` 设置 `position: relative` 作为定位基准（模板 CSS 已设置）。

## 内容边界

- **所有业务内容必须写在内容区**（`.page-content` 或 `.mini-program-content`）内。
- 禁止在状态栏、导航栏、Home Indicator 区域添加业务内容。
- 小程序外壳结构由模板 HTML 定义，Agent 只替换内容区占位内容。

## 配色

外壳颜色需跟随页面主题。模板 CSS 默认提供亮色模式，暗黑模式需自行调整：

| 模式 | 外壳背景 | 文字/图标 | 胶囊按钮背景 | 胶囊边框 |
|------|---------|----------|------------|---------|
| 亮色（默认） | `#fff` | `#000` | 透明 | `rgba(0,0,0,0.15)` |
| 暗黑 | 深色（如 `#101218`） | 亮色（白/浅灰） | 略浅深色 | 半透明浅灰 |

灵动岛始终纯黑 `#000`。外壳元素与页面背景需保持高对比度。
