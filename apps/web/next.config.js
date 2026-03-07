const withCloudflare = require('@opennextjs/cloudflare').default;

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@wildphotography/db', '@wildphotography/search', '@wildphotography/smugmug', '@wildphotography/payments'],
  // Cloudflare-specific config
  images: {
    unoptimized: true, // Required for Cloudflare Pages
  },
};

module.exports = withCloudflare(nextConfig);
