// @ts-expect-error: Will be resolved by wrangler build
import { handleCdnCgiImageRequest, handleImageRequest } from "./cloudflare/images.js";
// @ts-expect-error: Will be resolved by wrangler build
import { runWithCloudflareRequestContext } from "./cloudflare/init.js";
// @ts-expect-error: Will be resolved by wrangler build
import { maybeGetSkewProtectionResponse } from "./cloudflare/skew-protection.js";
// @ts-expect-error: Will be resolved by wrangler build
import { handler as middlewareHandler } from "./middleware/handler.mjs";
// @ts-expect-error: Will be resolved by wrangler build
export { DOQueueHandler } from "./.build/durable-objects/queue.js";
// @ts-expect-error: Will be resolved by wrangler build
export { DOShardedTagCache } from "./.build/durable-objects/sharded-tag-cache.js";
// @ts-expect-error: Will be resolved by wrangler build
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
          `${globalThis.__NEXT_BASE_PATH__}/_next/image${globalThis.__TRAILING_SLASH__ ? "/" : ""}`) {
        return await handleImageRequest(url, request.headers, env);
      }

      // Intercept _next/static requests and serve from R2 directly
      // This bypasses the OpenNext middleware asset resolution which has issues with env.ASSETS
      if (url.pathname.startsWith("/_next/static/")) {
        const r2Key = "_next/static/" + url.pathname.substring("/_next/static/".length);
        
        // First try to get from R2
        try {
          const r2Obj = await env.PHOTOS_R2.get(r2Key);
          if (r2Obj) {
            // Determine content type based on file extension
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
          // R2 get failed, continue to middleware
        }
        
        // If R2 doesn't have it, try the middleware (ASSETS binding)
        const reqOrResp = await middlewareHandler(request, env, ctx);
        if (reqOrResp instanceof Response) {
          return reqOrResp;
        }
        const { handler } = await import("./server-functions/default/handler.mjs");
        return handler(reqOrResp, env, ctx, request.signal);
      }

      // - `Request`s are handled by the Next server
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
