# Axhost-Make

本地优先、Agent 驱动的原型开发框架。Node.js 后端零外部依赖，前端原生 HTML/CSS/JS。

## 安装

需要 **Node.js >= 22** 和 **Git**。

```bash
mkdir workspace && cd workspace
git clone https://github.com/BarnettZhou/AxHost-Make.git axhost-make
node axhost-make/bin/axhost-make.js init
```

初始化后工作空间结构：

```
workspace/
├── axhost-make/      # 框架源码
├── projects/          # 原型项目存放目录
├── package.json       # npm 入口
├── start.cmd          # Windows 双击启动
└── start.sh           # Linux/macOS 启动
```

## 启动

```bash
# 开发模式（默认端口 3820）
node axhost-make/bin/axhost-make.js serve [--port 3820]

# 纯静态预览（默认端口 8080）
node axhost-make/bin/axhost-make.js preview [--port 8080]
```

Windows 下直接双击 `start.cmd` 即可启动开发模式。

服务仅绑定 `127.0.0.1`，启动后访问 `http://localhost:3820` 进入项目管理首页。

## 发布

通过 Shell 工具栏中的导出按钮可将原型打包发布到 [AxHost](https://github.com/BarnettZhou/AxHost) — 同属 AxHost 系列的原型托管系统，原本面向 Axure 原型托管，同样支持托管 Axhost-Make 产生的原型项目。
