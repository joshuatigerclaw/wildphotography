// open-next.config.ts
var resolver = {
  name: "cloudflare-asset-resolver",
  async maybeGetAssetResult(event, env) {
    if (!event.rawPath.startsWith("/_next/static")) {
      return void 0;
    }
    const assets = env?.ASSETS;
    if (!assets) {
      console.log("ASSETS binding not found in env");
      return void 0;
    }
    const { method, headers } = event;
    if (method !== "GET" && method !== "HEAD") {
      return void 0;
    }
    const url = new URL(event.rawPath, "https://assets.local");
    try {
      const response = await assets.fetch(url, { headers, method });
      if (response.status === 404) {
        await response.body?.cancel();
        return void 0;
      }
      return {
        type: "core",
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: response.body,
        isBase64Encoded: false
      };
    } catch (e) {
      console.log("ASSETS fetch error:", e.message);
      return void 0;
    }
  }
};
var open_next_config_default = {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy"
    }
  },
  edgeExternals: ["node:crypto"],
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy"
    },
    assetResolver: () => resolver
  }
};
export {
  open_next_config_default as default
};
