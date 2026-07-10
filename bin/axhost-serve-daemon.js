#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DAEMON_DIR = path.join(os.homedir(), '.axhost-make');
const PID_FILE = path.join(DAEMON_DIR, 'pid');
const META_FILE = path.join(DAEMON_DIR, 'meta.json');
const LOG_FILE = path.join(DAEMON_DIR, 'server.log');

function ensureDaemonDir() {
  if (!fs.existsSync(DAEMON_DIR)) {
    fs.mkdirSync(DAEMON_DIR, { recursive: true });
  }
}

function getWorkspaceRoot() {
  let root = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(root, 'axhost-make'))) {
      return root;
    }
    const parent = path.dirname(root);
    if (parent === root) {
      break;
    }
    root = parent;
  }
  return process.cwd();
}

function readPid() {
  try {
    const text = fs.readFileSync(PID_FILE, 'utf8').trim();
    const pid = parseInt(text, 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function isAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanFiles() {
  try { fs.unlinkSync(PID_FILE); } catch {}
  try { fs.unlinkSync(META_FILE); } catch {}
}

function formatUptime(isoTime) {
  const start = new Date(isoTime).getTime();
  if (Number.isNaN(start)) return 'unknown';
  const diff = Math.floor((Date.now() - start) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `${h}h ${m}m`;
}

function showStatus() {
  const pid = readPid();
  const meta = readMeta();
  if (!pid) {
    console.log('No background Axhost-Make server is running.');
    return;
  }

  const alive = isAlive(pid);
  console.log('Axhost-Make background server');
  console.log(`  Status:    ${alive ? 'running' : 'not running'}`);
  console.log(`  PID:       ${pid}`);

  if (meta) {
    console.log(`  Workspace: ${meta.cwd || '-'}`);
    const host = meta.access === 'lan' ? '0.0.0.0' : '127.0.0.1';
    console.log(`  URL:       http://${host}:${meta.port || 3820}`);
    console.log(`  Started:   ${meta.startedAt || '-'}`);
    if (alive && meta.startedAt) {
      console.log(`  Uptime:    ${formatUptime(meta.startedAt)}`);
    }
    console.log(`  Log:       ${meta.log || LOG_FILE}`);
  }

  if (!alive) {
    console.log('');
    console.log('The PID file refers to a dead process. Run `npm run stop` to clean it up.');
  }
}

async function stopDaemon() {
  const pid = readPid();
  if (!pid) {
    console.log('No background Axhost-Make server is running.');
    return;
  }

  if (!isAlive(pid)) {
    console.log(`PID ${pid} is not running.`);
    cleanFiles();
    return;
  }

  console.log(`Stopping background server (PID ${pid})...`);

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', detached: true }).unref();
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch (err) {
    console.error(`Failed to stop process: ${err.message}`);
  }

  let stopped = false;
  for (let i = 0; i < 50; i++) {
    if (!isAlive(pid)) {
      stopped = true;
      break;
    }
    await sleep(100);
  }

  if (!stopped && process.platform !== 'win32') {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // ignore
    }
  }

  cleanFiles();
  console.log('Background server stopped.');
}

async function startDaemon(serveArgs) {
  ensureDaemonDir();

  const existingPid = readPid();
  if (existingPid && isAlive(existingPid)) {
    console.error(`A background server is already running (PID ${existingPid}).`);
    console.error('Run `npm run status` to view it or `npm run stop` to stop it first.');
    process.exit(1);
  }

  const workspaceRoot = getWorkspaceRoot();
  const axhostMakePath = path.join(workspaceRoot, 'axhost-make', 'bin', 'axhost-make.js');

  if (!fs.existsSync(axhostMakePath)) {
    console.error(`Axhost-Make entry not found: ${axhostMakePath}`);
    process.exit(1);
  }

  // Parse metadata helpers from the filtered arguments
  let port = 3820;
  let access = 'local';
  const portIndex = serveArgs.indexOf('--port');
  if (portIndex !== -1 && serveArgs[portIndex + 1]) {
    const parsed = parseInt(serveArgs[portIndex + 1], 10);
    if (!Number.isNaN(parsed)) port = parsed;
  }
  const accessIndex = serveArgs.indexOf('--access');
  if (accessIndex !== -1 && serveArgs[accessIndex + 1]) {
    const value = serveArgs[accessIndex + 1].toLowerCase();
    if (value === 'lan' || value === 'local') access = value;
  }

  const out = fs.openSync(LOG_FILE, 'a');
  const err = fs.openSync(LOG_FILE, 'a');

  const child = spawn(process.execPath, [axhostMakePath, 'serve', ...serveArgs], {
    detached: true,
    stdio: ['ignore', out, err],
    cwd: workspaceRoot,
    env: process.env,
  });

  child.on('error', (errEvent) => {
    console.error(`Failed to start background server: ${errEvent.message}`);
    cleanFiles();
    process.exit(1);
  });

  child.unref();

  fs.writeFileSync(PID_FILE, String(child.pid));
  fs.writeFileSync(
    META_FILE,
    JSON.stringify(
      {
        pid: child.pid,
        cwd: workspaceRoot,
        port,
        access,
        log: LOG_FILE,
        startedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log(`Axhost-Make server started in background (PID ${child.pid}).`);
  console.log(`  Log: ${LOG_FILE}`);
}

async function startForeground(serveArgs) {
  const workspaceRoot = getWorkspaceRoot();
  const axhostMakePath = path.join(workspaceRoot, 'axhost-make', 'bin', 'axhost-make.js');

  if (!fs.existsSync(axhostMakePath)) {
    console.error(`Axhost-Make entry not found: ${axhostMakePath}`);
    process.exit(1);
  }

  const child = spawn(process.execPath, [axhostMakePath, 'serve', ...serveArgs], {
    stdio: 'inherit',
    cwd: workspaceRoot,
    env: process.env,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'serve';

  if (command === 'status') {
    showStatus();
    return;
  }

  if (command === 'stop') {
    await stopDaemon();
    return;
  }

  if (command === 'serve') {
    const serveArgs = args.slice(1);
    const daemon = serveArgs.includes('-d') || serveArgs.includes('--daemon');
    const filteredArgs = serveArgs.filter((a) => a !== '-d' && a !== '--daemon');

    if (daemon) {
      await startDaemon(filteredArgs);
      return;
    }

    await startForeground(filteredArgs);
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error('Usage: serve [-d] [--port <port>] [--access local|lan]');
  console.error('       status');
  console.error('       stop');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
