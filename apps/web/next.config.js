/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@wildphotography/db', '@wildphotography/search', '@wildphotography/smugmug', '@wildphotography/payments'],
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
