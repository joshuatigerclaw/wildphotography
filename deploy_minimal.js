#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography';
const appDir = path.join(root, 'apps/web');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { ...opts, stdio: 'inherit' });
  if (r.status !== 0) { console.error('FAILED'); process.exit(1); }
}

console.log('=== Copy .next to root ===');
fs.rmSync(path.join(root, '.next'), { recursive: true, force: true });
fs.cpSync(path.join(appDir, '.next'), path.join(root, '.next'), { recursive: true });
console.log('Done copying .next');

console.log('=== OpenNext ===');
run('node', [
  path.join(root, 'node_modules/@opennextjs/cloudflare/dist/cli/index.js'),
  'build',
  '--dangerouslyUseUnsupportedNextVersion',
  '--skipNextBuild',
  '--openNextConfigPath', path.join(appDir, 'open-next.config.ts')
], { cwd: appDir });

console.log('=== Copy .open-next to root ===');
fs.rmSync(path.join(root, '.open-next'), { recursive: true, force: true });
fs.cpSync(path.join(appDir, '.open-next'), path.join(root, '.open-next'), { recursive: true });

console.log('=== Wrangler deploy ===');
run('npx', ['wrangler', 'deploy', '--name', 'wildphotography-new', '--config', 'wrangler.toml'], { cwd: appDir });

console.log('=== ALL DONE ===');
