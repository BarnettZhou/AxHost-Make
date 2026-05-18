#!/usr/bin/env node
// build 命令已简化：框架资源由 /client/ 统一提供，不再需要编译到 templates/preview/
// 导出时的路径重写逻辑已移至 server/api/export.js 的 prepareExportDir()

async function build() {
  console.log('Build: 框架资源由 /client/ 统一提供，无需编译。');
  console.log('导出时路径重写由 export API 自动处理。');
}

module.exports = { build };

if (require.main === module) {
  build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
  });
}
