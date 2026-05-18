# 关键工作流

## 开发修改流程

### 修改 Client/Templates
```
1. 编辑 client/ 或 templates/ 源文件
2. 如果修改了 preview-index.html | shell.css | icon-loader-shell.js | preview-app.js | md-renderer.js | zoom-control.js | touch-emulation.js:
   node axhost-make/bin/axhost-make.js build
3. node axhost-make/bin/axhost-make.js update --all
4. 刷新浏览器验证
```

### 修改 Server
```
1. 编辑 server/ 文件
2. 杀死旧 Node 进程
3. node axhost-make/bin/axhost-make.js serve --port 3820
4. 验证 API 行为
```

### 修改 CLI
```
1. 编辑 bin/ 脚本
2. 直接运行对应命令验证逻辑
3. 如果是 update.js，同时确保 templates/ 里的新文件就绪
```

## Tree Nav 交互流程

```
用户点击树节点
  → tree-nav.js: label click handler
    → 检查 doc-panel isEditing（提示保存）
    → 更新 selectedPath
    → location.hash = '#' + node.id
    → 重新渲染树（高亮新选中项）
    → shell.loadPage(type, node.path)
      → 设置 previewFrame.src
      → 更新 window.__axhostState.currentPage
      → docPanel.load(type, node.path)
        → API 获取文档列表 + 内容
        → 渲染 tabs 和 content
      → 更新 prompt-context 文本

iframe 加载完成
  → treeNav.syncTreeFromIframe()
    → 解析 iframe URL 中的 hash
    → 同步 currentTab 和 selectedPath
    → 自动展开祖先路径
    → 重新渲染树
```

### 拖拽排序
```
dragstart → 记录 draggedItem, draggedParentUl
dragover  → 计算 drop-before/after/into 指示器
drop      → apiClient.postMove({ type, sourcePath, targetPath, position? })
         → loadTree() 刷新
```

## 文档面板流程

### 阅读模式
```
docPanel.load(type, pagePath)
  → GET /api/docs?path=... → 获取文档列表（已排序）
  → 遍历列表 GET /api/file?path=... → 获取每个文档内容
  → renderContent() → mdRenderer.renderMarkdown(content) → innerHTML
```

### 编辑模式（分屏）
```
点击「编辑」
  → isEditMode = true
  → 创建 textarea（左）+ preview div（右）
  → textarea input 事件 → 实时更新 preview
  → 绑定 doc link autocomplete
```

### 文档链接自动补全
```
输入 `](@` 或 `](#`
  → Stage 1: 从 scan 数据中搜索页面/组件
    → 显示 name + breadcrumb 下拉
    → 选择后插入 `@hash/` 或 `#hash/`
  → Stage 2: 从选中页面/组件的 docs 列表中搜索文档
    → 显示文档名下拉
    → 选择后插入文档名
```

### 跨页面文档导航
```
点击文档链接（cross-page 类型）
  → 设置 window.__axhostPendingDoc = docName
  → shell.loadPage(targetType, targetPath)
    → docPanel.load(type, path)
      → 检测 __axhostPendingDoc
      → 在文档列表中查找匹配的文档
      → 激活对应 tab
      → 清除 __axhostPendingDoc
```

## 导出/发布流程

### 本地导出
```
打开导出弹窗 → 加载 sitemap → 渲染树形勾选界面
  → 用户选择 pages/components/flowcharts
  → 选择目标目录
  → doExport() → POST /api/export
    → Server: filterTree() 过滤 sitemap
    → 复制 prototype 资源 + 选中的页面/组件目录
    → 写入筛选后的 sitemap.js
```

### 远程发布
```
打开导出弹窗 → 切换到「线上发布」tab
  → 校验: axhost-server-url, axhost-token, 托管项目是否已关联
  → 选择 pages/components/flowcharts
  → doPublish() → POST /api/export/publish
    → Server: 导出到临时 cache 目录
    → tar/zip 打包
    → fetch upload 到 AxHost: POST /api/projects/{id}/update-file
    → 清理 cache
```

## 跨 Frame 主题同步

```
home.js: 主题切换
  → document.documentElement.setAttribute('data-theme', theme)
  → localStorage.setItem('axhost-theme', theme)
  → 遍历所有 shell iframe → postMessage({ type: 'axhost-theme', theme })

shell.js: 接收主题消息
  → iframe.contentWindow.postMessage({ type: 'axhost-theme', theme })

preview-app.js / prototype page: 接收主题消息
  → window.addEventListener('message', ...)
  → document.documentElement.setAttribute('data-theme', theme)
```

## Rule Mode（规则查看模式）

```
点击 Rules 面板中的文件
  → shell.loadRuleFile(name, itemEl)
    → API 获取文件内容
    → mdRenderer.renderMarkdown(content)
    → enterRuleMode()
      → 隐藏 iframeWrapper
      → 显示 ruleViewer
      → 禁用 inspect 和 docs 按钮
    → exitRuleMode() 恢复
```

## Home 页面 Tab 管理

```
打开项目 → openTab(projectId, projectName)
  → 如果已有 tab: switchToTab()
  → 否则: push 到 tabs[], 创建 shell iframe
  → 更新 localStorage('axhost-tabs')
  → renderTabs() 显示 tab 标签

Tab 释放（软回收）:
  → 每 60s 检查非活跃 tab 的 lastActiveAt
  → 超过 10 分钟 → iframe.src = 'about:blank' → released = true
  → 切换回该 tab 时重新加载 iframe

关闭 Tab → closeTab(projectId)
  → 从 tabs[] 移除
  → 移除 iframe DOM
  → 如果无剩余 tab，返回项目列表
  → 更新 localStorage
```
