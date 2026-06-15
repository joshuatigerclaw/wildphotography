/**
 * Post-build patch: set globalThis.__env = env in the OpenNext Cloudflare worker.js
 * Run AFTER `npx opennextjs-cloudflare build`.
 *
 * The OpenNext Cloudflare init.js stores env in AsyncLocalStorage but does NOT
 * expose it as globalThis.__env, so Next.js route handlers cannot access Cloudflare
 * bindings (queues, R2, etc.) directly.
 *
 * This script patches .open-next/worker.js AFTER each OpenNext build to expose
 * env bindings via globalThis.__env = env at the top of the runWithCloudflareRequestContext
 * callback, ensuring all route handlers can access Cloudflare bindings.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerPath = resolve(__dirname, '..', '.open-next', 'worker.js');

function patchWorker() {
  let content = readFileSync(workerPath, 'utf8');

  if (content.includes('globalThis.__env = env')) {
    console.log('[patch-env] Already patched, skipping');
    return;
  }

  // Find: return runWithCloudflareRequestContext(request, env, ctx, async () => {
  // and inject globalThis.__env = env right after the opening {
  const pattern = /return runWithCloudflareRequestContext\(request, env, ctx, async \(\) => \{/;

  if (!pattern.test(content)) {
    console.warn('[patch-env] Could not find runWithCloudflareRequestContext pattern!');
    return;
  }

  const patched = content.replace(pattern, (m) => m + '\n            globalThis.__env = env;');

  writeFileSync(workerPath, patched, 'utf8');
  console.log('[patch-env] Patched: globalThis.__env = env set at top of request context callback');
}

patchWorker();