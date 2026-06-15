import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.HOME + '/.openclaw/workspace/wildphotography';

const p = spawn('node', [
  'node_modules/@opennextjs/cloudflare/dist/cli/index.js',
  'build',
  '--dangerouslyUseUnsupportedNextVersion'
], { cwd: root, stdio: 'inherit' });

p.on('exit', (code) => process.exit(code || 0));
