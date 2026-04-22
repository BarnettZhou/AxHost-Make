# Axhost-Make CLI 快捷命令

本 Skill 介绍 `axhost-make` 提供的 Agent 快捷命令，用于在无需启动开发服务器的情况下直接修改项目结构。

所有命令均需在项目根目录（即包含 `prototype/` 的目录）下执行。

---

## 通用约定

- **名称校验**：页面、目录、组件、文档的名称均只能包含字母、数字、下划线、连字符和中文字符，不可使用空格或特殊符号。
- **路径格式**：
  - **完整路径**：以 `pages/` 或 `components/` 开头，例如 `pages/85a10724`
  - **Hash 值**：8 位十六进制字符串（页面/组件在 `.axhost-meta.json` 中注册的唯一 ID），例如 `6e3d21e9`
- **执行方式**：
  - 通过主 CLI：`node axhost-make/bin/axhost-make.js <command> [args]`
  - 或直接执行脚本：`node axhost-make/bin/<script> [args]`

---

## 1. 新增页面

### 命令
```bash
node axhost-make/bin/axhost-make.js add-page <name> [--parent <path-or-hash>]
```

### 说明
- 在 `prototype/pages/` 下创建新页面。
- 若不指定 `--parent`，页面将放在 `prototype/pages/` 根目录。
- `--parent` 支持完整路径或 hash 值。逻辑层级由 `.axhost-meta.json` 中的 `parentId` 描述。
- 自动初始化：
  - `{hash}/index.html`
  - `{hash}/resources/css/style.css`
  - `{hash}/resources/js/main.js`
  - `{hash}/docs/readme.md`
  - 更新 `sitemap.js`

### 示例
```bash
# 在根目录下创建页面
node axhost-make/bin/axhost-make.js add-page 用户中心

# 在指定页面下创建子页面（使用完整路径）
node axhost-make/bin/axhost-make.js add-page 签到记录 --parent pages/85a10724

# 使用 hash 指定上级
node axhost-make/bin/axhost-make.js add-page 签到记录 --parent 6e3d21e9
```

---

## 2. 新增组件

### 命令
```bash
node axhost-make/bin/axhost-make.js add-component <name> [--parent <path-or-hash>]
```

### 说明
- 在 `prototype/components/` 下创建新组件。
- 逻辑与 `add-page` 相同，仅归属目录不同。
- 自动初始化结构与页面一致，并更新 `sitemap.js`。

### 示例
```bash
# 在根目录下创建组件
node axhost-make/bin/axhost-make.js add-component 按钮组

# 在指定目录下创建组件
node axhost-make/bin/axhost-make.js add-component 卡片头 --parent components/基础组件
```

---

## 3. 新增目录

### 命令
```bash
node axhost-make/bin/axhost-make.js add-folder <name> [--parent <path-or-hash>] [-t pages|components]
```

### 说明
- 在 `prototype/pages/` 或 `prototype/components/` 下创建目录。
- 默认归属 `pages`，可通过 `-t components` 指定到组件侧。
- 逻辑层级由 `.axhost-meta.json` 中的 `parentId` 描述，所有目录物理平级。
- 更新 `sitemap.js`。

### 示例
```bash
# 在 pages 根目录创建目录
node axhost-make/bin/axhost-make.js add-folder 营销活动

# 在 components 下创建目录
node axhost-make/bin/axhost-make.js add-folder 表单组件 -t components

# 在指定目录下创建子目录
node axhost-make/bin/axhost-make.js add-folder 春节活动 --parent pages/85a10724
```

---

## 4. 新增文档

### 命令
```bash
node axhost-make/bin/axhost-make.js add-doc <name> --to <path-or-hash>
```

### 说明
- 为指定页面或组件新增 Markdown 文档。
- `--to` 为必填项，用于指定归属的页面或组件（支持完整路径或 hash）。
- 文档名称不需要 `.md` 后缀，脚本会自动补全。
- 若同名文档已存在，命令会报错并退出。

### 示例
```bash
# 为页面新增文档（使用完整路径）
node axhost-make/bin/axhost-make.js add-doc 需求变更 --to pages/85a10724

# 为组件新增文档（使用 hash）
node axhost-make/bin/axhost-make.js add-doc API说明 --to 6e3d21e9
```

---

## 错误处理

所有命令在失败时会返回非零退出码，并在 stderr 输出错误原因。常见错误包括：
- 名称包含非法字符
- 指定的 parent 路径或 hash 不存在
- 目标已存在（页面/目录/组件/文档重名）
