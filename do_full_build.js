#!/usr/bin/env node
// Build script: Next.js build + OpenNext bundle
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const root = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography';
const appDir = path.join(root, 'apps/web');

// Step 1: Next.js build
console.log('Running Next.js build...');
const nextResult = spawnSync('npx', ['next', 'build'], {
  cwd: appDir,
  stdio: 'inherit',
  env: { ...process.env }
});
if (nextResult.status !== 0) {
  console.error('Next.js build failed');
  process.exit(nextResult.status);
}
console.log('Next.js build done');

// Step 2: Create .next/server/ compat files for OpenNext
// OpenNext 1.17.1 looks for .next/server/middleware-manifest.json at process.cwd()
const serverDir = path.join(appDir, '.next/server');
const compatServerDir = path.join(root, '.next/server');
if (!fs.existsSync(compatServerDir)) {
  fs.mkdirSync(compatServerDir, { recursive: true });
}
// Copy just the manifest files OpenNext needs
const neededFiles = ['middleware-manifest.json', 'pages-manifest.json', 'functions-config-manifest.json'];
neededFiles.forEach(f => {
  const src = path.join(serverDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(compatServerDir, f));
    console.log('Copied', f);
  }
});

// Step 3: Run OpenNext from apps/web (so .next is at apps/web/.next)
console.log('Running OpenNext...');
const opennextPath = path.join(root, 'node_modules/@opennextjs/cloudflare/dist/cli/index.js');
const onResult = spawnSync('node', [opennextPath, 'build', '--dangerouslyUseUnsupportedNextVersion', '--skipNextBuild'], {
  cwd: appDir,
  stdio: 'inherit',
  env: { ...process.env }
});
if (onResult.status !== 0) {
  console.error('OpenNext build failed');
  process.exit(onResult.status);
}

// Step 4: Copy .open-next from apps/web to root
const src = path.join(appDir, '.open-next');
const dst = path.join(root, '.open-next');
if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true });
fs.cpSync(src, dst, { recursive: true });
console.log('✅ Deployed to:', dst);

// Step 5: Deploy to Cloudflare
console.log('Deploying to Cloudflare...');
const wranglerPath = path.join(root, 'node_modules/.bin/wrangler');
const deployResult = spawnSync(wranglerPath, ['deploy', '--name', 'wildphotography-new'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
});
if (deployResult.status !== 0) {
  console.error('Deploy failed');
  process.exit(deployResult.status);
}
console.log('✅ Deployed!');