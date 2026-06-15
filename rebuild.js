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

console.log('=== Patching .open-next/worker.js for R2 static asset fallback ===');
const workerPath = path.join(appDir, '.open-next/worker.js');
const patchedWorker = `//@ts-expect-error: Will be resolved by wrangler build
import { handleCdnCgiImageRequest, handleImageRequest } from "./cloudflare/images.js";
//@ts-expect-error: Will be resolved by wrangler build
import { runWithCloudflareRequestContext } from "./cloudflare/init.js";
//@ts-expect-error: Will be resolved by wrangler build
import { maybeGetSkewProtectionResponse } from "./cloudflare/skew-protection.js";
// @ts-expect-error: Will be resolved by wrangler build
import { handler as middlewareHandler } from "./middleware/handler.mjs";
//@ts-expect-error: Will be resolved by wrangler build
export { DOQueueHandler } from "./.build/durable-objects/queue.js";
//@ts-expect-error: Will be resolved by wrangler build
export { DOShardedTagCache } from "./.build/durable-objects/sharded-tag-cache.js";
//@ts-expect-error: Will be resolved by wrangler build
export { BucketCachePurge } from "./.build/durable-objects/bucket-cache-purge.js";
export default {
    async fetch(request, env, ctx) {
        return runWithCloudflareRequestContext(request, env, ctx, async () => {
            const response = maybeGetSkewProtectionResponse(request);
            if (response) {
                return response;
            }
            const url = new URL(request.url);
            // Serve images in development.
            // Note: "/cdn-cgi/image/..." requests do not reach production workers.
            if (url.pathname.startsWith("/cdn-cgi/image/")) {
                return handleCdnCgiImageRequest(url, env);
            }
            // Fallback for the Next default image loader.
            if (url.pathname ===
                \`\${globalThis.__NEXT_BASE_PATH__}/_next/image\${globalThis.__TRAILING_SLASH__ ? "/" : ""}\`) {
                return await handleImageRequest(url, request.headers, env);
            }

            // INTERCEPT _next/static paths and serve from R2
            // This bypasses OpenNext's ASSETS binding issues
            if (url.pathname.startsWith("/_next/static/")) {
                const r2Key = "_next/static/" + url.pathname.substring("/_next/static/".length);

                // Try R2 first
                try {
                    const r2Obj = await env.PHOTOS_R2.get(r2Key);
                    if (r2Obj) {
                        let contentType = "application/octet-stream";
                        if (r2Key.endsWith(".css")) contentType = "text/css";
                        else if (r2Key.endsWith(".js")) contentType = "application/javascript";
                        else if (r2Key.endsWith(".json")) contentType = "application/json";
                        else if (r2Key.endsWith(".png")) contentType = "image/png";
                        else if (r2Key.endsWith(".jpg") || r2Key.endsWith(".jpeg")) contentType = "image/jpeg";
                        else if (r2Key.endsWith(".svg")) contentType = "image/svg+xml";

                        return new Response(r2Obj.body, {
                            status: 200,
                            headers: {
                                "Content-Type": contentType,
                                "Cache-Control": "public, max-age=31536000, immutable",
                                "CF-Cache-Status": "HIT"
                            }
                        });
                    }
                } catch (e) {
                    // R2 not available or file not found, fall through
                }

                // If not in R2, try middleware (ASSETS binding)
                const reqOrResp = await middlewareHandler(request, env, ctx);
                if (reqOrResp instanceof Response) {
                    return reqOrResp;
                }
                const { handler } = await import("./server-functions/default/handler.mjs");
                return handler(reqOrResp, env, ctx, request.signal);
            }

            // - \`Request\`s are handled by the Next server
            const reqOrResp = await middlewareHandler(request, env, ctx);
            if (reqOrResp instanceof Response) {
                return reqOrResp;
            }
            // @ts-expect-error: resolved by wrangler build
            const { handler } = await import("./server-functions/default/handler.mjs");
            return handler(reqOrResp, env, ctx, request.signal);
        });
    },
};
`;
fs.writeFileSync(workerPath, patchedWorker);
console.log('Worker patched successfully');

console.log('=== Copy .open-next to root ===');
fs.rmSync(path.join(root, '.open-next'), { recursive: true, force: true });
fs.cpSync(path.join(appDir, '.open-next'), path.join(root, '.open-next'), { recursive: true });

console.log('=== Deploy from apps/web (uses apps/web/wrangler.toml) ===');
// Copy .open-next from root to apps/web (OpenNext outputs to apps/web/.open-next/)
// Deploy using apps/web/wrangler.toml which correctly references .open-next/worker.js
run('npx', ['wrangler', 'deploy', '--name', 'wildphotography-new', '--config', 'wrangler.toml'], { cwd: appDir });

console.log('=== ALL DONE ===');