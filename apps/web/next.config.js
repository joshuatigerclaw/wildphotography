const { defineCloudflareConfig } = require('@opennextjs/cloudflare');

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@wildphotography/db', '@wildphotography/search', '@wildphotography/smugmug', '@wildphotography/payments'],
  images: {
    unoptimized: true,
  },
  output: 'standalone',
};

module.exports = defineCloudflareConfig(nextConfig);
