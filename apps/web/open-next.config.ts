// Cloudflare Assets binding resolver for static files
// Serves /_next/static/* files from ASSETS binding using env.ASSETS

const resolver = {
  name: "cloudflare-asset-resolver",
  async maybeGetAssetResult(event: any, env: any) {
    // Only handle _next/static paths
    if (!event.rawPath.startsWith('/_next/static')) {
      return undefined;
    }
    
    // Access ASSETS from env (Cloudflare Workers binding)
    const assets = env?.ASSETS;
    if (!assets) {
      console.log('ASSETS binding not found in env');
      return undefined;
    }
    
    const { method, headers } = event;
    if (method !== 'GET' && method !== 'HEAD') {
      return undefined;
    }
    
    const url = new URL(event.rawPath, 'https://assets.local');
    try {
      const response = await assets.fetch(url, { headers, method });
      if (response.status === 404) {
        await response.body?.cancel();
        return undefined;
      }
      return {
        type: 'core',
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: response.body,
        isBase64Encoded: false,
      };
    } catch (e: any) {
      console.log('ASSETS fetch error:', e.message);
      return undefined;
    }
  },
};

export default {
  default: {
    override: {
      wrapper: 'cloudflare-node',
      converter: 'edge',
      proxyExternalRequest: 'fetch',
      incrementalCache: 'dummy',
      tagCache: 'dummy',
      queue: 'dummy',
    },
  },
  edgeExternals: ['node:crypto'],
  middleware: {
    external: true,
    override: {
      wrapper: 'cloudflare-edge',
      converter: 'edge',
      proxyExternalRequest: 'fetch',
      incrementalCache: 'dummy',
      tagCache: 'dummy',
      queue: 'dummy',
    },
    assetResolver: () => resolver,
  },
};
