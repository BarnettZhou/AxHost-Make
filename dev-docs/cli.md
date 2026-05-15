# CLI 设计

## 命令分发

**`bin/axhost-make.js`** 是唯一入口，通过 `process.argv[2]` 判断命令：

```
node axhost-make/bin/axhost-make.js <command> [args...]
```

| 命令 | 实现方式 | 说明 |
|---|---|---|
| `init` | 直接调用 `initWorkspace(cwd)` | 同步函数 |
| `update --all \| --id <h>` | 直接调用 `update(cwd, { all, id })` | 同步函数 |
| `build` | 直接调用 `build(cwd)` | 同步函数 |
| `serve [--port N]` | 直接调用 `startServer()` | 常驻进程 |
| `preview [--port N]` | 直接调用 `startPreviewServer()` | 常驻进程 |
| `migrate` | 动态 `require('./axhost-migrate.js')` | async |
| `add-page/component/folder/doc` | `child_process.spawn` 到 `axhost-add-*.js` | 子进程 |
| `list/info/search/path/copy` | `child_process.spawn` 到 `axhost-query.js` | 子进程 |

**serve 命令特殊行为：** 自动向上遍历目录树寻找包含 `axhost-make/` 的目录作为 `workspaceRoot`。

## init 流程（axhost-init.js）

```
initWorkspace(currentDir)
  ├── 验证当前目录包含 axhost-make/
  ├── syncStartScripts(workspaceRoot)     → 复制 start.sh/.ps1/.cmd
  ├── 创建 projects/ 目录
  ├── 创建 projects/.projects.json        → { projects: [] }
  ├── 创建 package.json                    → 含 npm scripts
  └── 非交互模式下直接退出，否则询问是否启动服务器
```

`init(projectRoot)` — 初始化单个项目（目录结构 + sitemap.js + 模板文件），被 `projects.js` API 的 POST 调用。

## update 流程（axhost-update.js）

```
update(currentDir, { all: true })
  └── 遍历 projects/ 下的每个项目
        └── updateSingleProject(projectRoot)
              ├── 复制 templates/preview/index.html → prototype/index.html
              ├── 复制 templates/preview/start.html → prototype/start.html（如果缺失）
              ├── 复制 client/assets/marked.min.js → prototype/resources/js/
              ├── 条件复制 mermaid.min.js（有 flowchart 则复制，无则删除）
              ├── 复制 client/js/icons.js → prototype/resources/js/
              ├── 复制 client/css/shell.css → prototype/resources/css/
              ├── 复制 client/js/preview-app.js → prototype/resources/js/
              ├── 复制 client/icon.svg → prototype/
              ├── 复制 AGENTS.md, CLAUDE.md（覆盖）
              ├── 复制 rules/design.md（如果缺失）
              └── ensurePageResources() → 确保每个页面/组件有 style.css 和 main.js

syncStartScripts(workspaceRoot)  # 外部也在每次 update 时调用
```

**为什么需要 update：** 框架的模板和资源文件（`templates/` 和 `client/`）更新后，需要同步到每个项目目录的 `prototype/` 下，项目才能使用最新的 Shell UI 和预览入口。

## build 流程（axhost-build.js）

```
build(projectRoot)
  ├── 读取 client/preview-index.html
  ├── 路径替换：
  │   ├── window.__axhostBasePath = '/prototype/' → './'
  │   ├── /client/css/ → ./resources/css/
  │   ├── /client/js/  → ./resources/js/
  │   ├── /client/icon.svg → ./icon.svg
  │   └── /prototype/ → ./
  ├── 写入 templates/preview/index.html
  ├── 复制 shell.css → templates/preview/resources/css/
  ├── 复制 icons.js  → templates/preview/resources/js/
  └── 复制 preview-app.js → templates/preview/resources/js/
```

**触发条件：** 修改了 `preview-index.html`、`shell.css`、`icons.js`、`preview-app.js` 中任意一个后执行。build 是 update 的前置步骤。

## 脚手架命令（add-*）

四个 add 命令共享共同模式：
1. `resolveParent(projectRoot, parentInput, tab)` 解析父路径（支持 hash / full path / 空）
2. 调用 `server/api/create.js` 的 `createItem(projectRoot, parentPath, name, kind, template)`
3. 重新生成 sitemap.js

| 命令 | kind | 目标目录 |
|---|---|---|
| `add-page <n> [--parent p]` | page | prototype/pages/ |
| `add-component <n> [--parent p] [--type t]` | component | prototype/components/ |
| `add-folder <n> [-t tab] [--parent p]` | folder | 仅 sitemap 节点 |
| `add-doc <n> --to <path-or-hash>` | — | {tab}/{hash}/docs/{n}.md |

## 查询命令（axhost-query.js）

| 命令 | 输出 |
|---|---|
| `list` | 列出所有页面和组件 ID + 名称 + 路径 |
| `info <hash>` | 打印 ID/名称/类型/路径/文档 |
| `search <keyword>` | 名称模糊搜索 |
| `path <hash> [doc]` | 输出绝对文件路径 |
| `copy <hash> <new-name> [--parent p]` | 复制节点（新建 + 递归复制文件） |

这些命令通过 `_map` 查找表获取节点信息。

## CLI 共享库（bin/lib/helpers.js）

```js
readMap(projectRoot)                              // 解析 sitemap._map
resolveByHash(projectRoot, hash)                  // hash → { tab, relPath }
resolveParent(projectRoot, parentInput, tab)      // 多种引用格式 → 绝对路径
resolvePageOrComponent(projectRoot, input)        // 解析页面/组件引用 → { tab, relPath }
```

## 迁移命令

### axhost-migrate.js — 将传统命名目录转换为 hash 目录
1. 读取旧 `.axhost-ids.json` → 扫描未迁移目录 → 分配 hash
2. 按深度降序处理（先迁移深层节点，避免父路径失效）
3. 复制目录到 hash 名、写 `.axhost-meta.json`、更新 `.axhost-order.json` 引用、删除旧目录
4. 删除 `.axhost-ids.json`，重新生成 sitemap

### migrate-flat.js — 将嵌套目录展平
独立的扁平化迁移（不连接到主 CLI），将嵌套的物理目录移动到 tab 根目录，更新资源路径。
