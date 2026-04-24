# mobile-frame-spec

> 手机端原型页面的框架规范，如果当前正在绘制手机端原型，请严格遵守

## 容器规格

- 手机容器尺寸：`375px × 812px`
- 手机容器背景色：`#101218`
- 外层页面背景色：`#ebe7f3`
- 手机容器居中展示于浏览器视口

## 容器外观

- 手机容器**不加圆角**
- 手机容器需添加一层阴影：`box-shadow: 0 12px 50px rgba(0, 0, 0, 0.25);`

## 滚动条

- 手机容器内部滚动区域**禁止显示滚动条**
- 需使用以下 CSS 隐藏滚动条：

```css
scrollbar-width: none;
-ms-overflow-style: none;

&::-webkit-scrollbar {
  display: none;
}
```