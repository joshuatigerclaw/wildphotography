const { execSync } = require('child_process');

try {
  const result = execSync(
    'node /Users/joshuatenbrink/.openclaw/workspace/wildphotography/node_modules/@opennextjs/cloudflare/dist/cli/index.js build',
    {
      cwd: '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/apps/web',
      stdio: 'inherit',
      timeout: 180000,
      env: { ...process.env }
    }
  );
} catch (e) {
  process.exit(e.status || 1);
}
