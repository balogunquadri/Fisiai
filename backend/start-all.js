const { spawn } = require('child_process');

const commands = [
  { name: 'server', command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['run', 'dev'] },
  { name: 'worker', command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['run', 'worker:webhook'] },
];

const children = [];
let shuttingDown = false;

function spawnProcess({ name, command, args }) {
  const child = spawn(command, args, {
    cwd: __dirname,
    env: process.env,
    stdio: 'inherit',
  });

  children.push(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const reason = signal || code;
    console.log(`\n[${name}] exited with ${reason}`);
    shutdown(reason);
  });

  child.on('error', (error) => {
    console.error(`\n[${name}] failed to start:`, error.message || error);
    shutdown(error);
  });
}

function shutdown(exitReason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nShutting down all processes...');

  children.forEach((child) => {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  });

  setTimeout(() => {
    process.exit(typeof exitReason === 'number' ? exitReason : 0);
  }, 500);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

commands.forEach(spawnProcess);
