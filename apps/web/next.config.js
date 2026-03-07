/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@wildphotography/db', '@wildphotography/search', '@wildphotography/smugmug', '@wildphotography/payments'],
  output: 'export',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
