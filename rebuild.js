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

console.log('=== Next.js build ===');
run('npx', ['next', 'build'], { cwd: appDir });

console.log('=== Create standalone mock dirs (OpenNext workaround) ===');
// OpenNext hardcodes .next/standalone/apps/web/.next/server/ paths.
// Create the minimum viable stub so it doesn't crash looking for these.
const stubDir = path.join(appDir, '.next/standalone/apps/web/.next/server');
fs.mkdirSync(stubDir, { recursive: true });
// Copy actual manifest files into the stub
for (const f of ['pages-manifest.json', 'middleware-manifest.json']) {
  const src = path.join(appDir, '.next/server', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(stubDir, f));
}
// Also create pages/ and app/ stub dirs
fs.mkdirSync(path.join(stubDir, '../pages'), { recursive: true });
fs.mkdirSync(path.join(stubDir, '../app'), { recursive: true });

console.log('=== Copy .next to root ===');
fs.rmSync(path.join(root, '.next'), { recursive: true, force: true });
fs.cpSync(path.join(appDir, '.next'), path.join(root, '.next'), { recursive: true });
console.log('Done copying .next');

console.log('=== OpenNext from apps/web (with config in apps/web) ===');
run('node', [
  path.join(root, 'node_modules/@opennextjs/cloudflare/dist/cli/index.js'), 'build',
  '--dangerouslyUseUnsupportedNextVersion', '--skipNextBuild',
  '--openNextConfigPath', path.join(appDir, 'open-next.config.ts')
], { cwd: appDir });

console.log('=== Copy .open-next to root ===');
fs.rmSync(path.join(root, '.open-next'), { recursive: true, force: true });
fs.cpSync(path.join(appDir, '.open-next'), path.join(root, '.open-next'), { recursive: true });

console.log('=== Deploy from apps/web (uses apps/web/wrangler.toml) ===');
// Copy .open-next from root to apps/web (OpenNext outputs to apps/web/.open-next/)
// Deploy using apps/web/wrangler.toml which correctly references .open-next/worker.js
run('npx', ['wrangler', 'deploy', '--name', 'wildphotography-new', '--config', 'wrangler.toml'], { cwd: appDir });

console.log('=== ALL DONE ===');