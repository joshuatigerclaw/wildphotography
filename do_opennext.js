#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const cwd = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography';
const opennextPath = path.join(cwd, 'node_modules/@opennextjs/cloudflare/dist/cli/index.js');

// Check paths exist
if (!fs.existsSync(opennextPath)) {
  console.error('OpenNext CLI not found at:', opennextPath);
  process.exit(1);
}
if (!fs.existsSync(path.join(cwd, '.next/standalone'))) {
  console.error('.next/standalone not found');
  process.exit(1);
}

console.log('Starting OpenNext build...');
const child = spawn('node', [opennextPath, 'build', '--dangerouslyUseUnsupportedNextVersion'], {
  cwd,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('✅ OpenNext build complete');
    // Copy to root
    try {
      const src = path.join(cwd, 'apps/web/.open-next');
      const dst = path.join(cwd, '.open-next');
      if (fs.existsSync(dst)) {
        fs.rmSync(dst, { recursive: true });
      }
      fs.cpSync(src, dst, { recursive: true });
      console.log('✅ Copied .open-next to root');
    } catch (e) {
      console.error('Copy failed:', e.message);
    }
  } else {
    console.error('❌ OpenNext build failed:', code);
    process.exit(code);
  }
});