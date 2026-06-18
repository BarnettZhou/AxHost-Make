#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FRAMEWORK_DIR = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf-8', cwd: FRAMEWORK_DIR, stdio: 'pipe', ...opts }).trim();
}

function hasGit() {
  try {
    execSync('git --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function promptYesNo(question) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question + ' [Y/n] ', answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() !== 'n');
    });
  });
}

async function upgrade() {
  // 1. Check git
  if (!hasGit()) {
    console.error('❌ 错误：未找到 git 命令，请先安装 git');
    process.exit(1);
  }

  console.log('🔍 检查框架版本...');

  // 2. Fetch and compare
  try {
    run('git fetch origin');
  } catch (err) {
    console.error('❌ 无法连接远程仓库：' + err.message);
    process.exit(1);
  }

  let localHash, remoteHash;
  try {
    localHash = run('git rev-parse HEAD');
    remoteHash = run('git rev-parse origin/master');
  } catch (err) {
    console.error('❌ 获取版本信息失败：' + err.message);
    process.exit(1);
  }

  if (localHash === remoteHash) {
    console.log('✅ 当前已是最新版本，无需升级');
    process.exit(0);
  }

  console.log('📦 发现新版本，准备升级...');

  // 3. Check local changes
  const hasChanges = run('git status --porcelain').length > 0;

  if (hasChanges) {
    const confirmed = await promptYesNo('⚠️  本地框架代码有修改，是否使用线上版本覆盖？');
    if (!confirmed) {
      console.log('ℹ️  已取消。请前往框架目录处理本地修改后再尝试升级：');
      console.log('   ' + FRAMEWORK_DIR);
      process.exit(0);
    }
    // Discard local changes
    console.log('🔄 丢弃本地修改...');
    run('git checkout -- .');
    run('git clean -fd');
  }

  // 4. Pull
  console.log('⬇️  拉取最新代码...');
  try {
    run('git pull origin master');
  } catch (err) {
    console.error('❌ 拉取更新失败：' + err.message);
    process.exit(1);
  }

  // 5. Run update --all
  console.log('🔄 更新项目模板...');
  try {
    const { update } = require('./axhost-update.js');
    const workspaceRoot = path.dirname(FRAMEWORK_DIR);
    update(workspaceRoot, { all: true });
  } catch (err) {
    console.error('⚠️  模板更新失败：' + err.message);
    console.log('   可手动执行：axhost-make update --all');
  }

  console.log('');
  console.log('✅ 升级完成！');
}

module.exports = { upgrade };
