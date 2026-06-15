//@ts-expect-error: Will be resolved by wrangler build
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
          `${globalThis.__NEXT_BASE_PATH__}/_next/image${globalThis.__TRAILING_SLASH__ ? "/" : ""}`) {
        return await handleImageRequest(url, request.headers, env);
      }
      
      // Handle _next/static files - try R2 directly as fallback
      if (url.pathname.startsWith("/_next/static/")) {
        // Try the middleware first (which uses ASSETS binding)
        const reqOrResp = await middlewareHandler(request, env, ctx);
        if (reqOrResp instanceof Response) {
          // If middleware returns a valid asset (not 404), return it
          if (reqOrResp.status !== 404) {
            return reqOrResp;
          }
          // If 404, try R2 as fallback
          const r2Key = url.pathname.substring(1); // remove leading /
          try {
            const r2Response = await env.PHOTOS_R2.head(r2Key);
            if (r2Response) {
              const r2Obj = await env.PHOTOS_R2.get(r2Key);
              if (r2Obj) {
                return new Response(r2Obj.body, {
                  headers: {
                    "Content-Type": r2Obj.httpMetadata?.contentType || "application/octet-stream",
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "CF-Cache-Status": "HIT"
                  }
                });
              }
            }
          } catch (e) {
            // R2 not available or file not found
          }
          return reqOrResp;
        }
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
