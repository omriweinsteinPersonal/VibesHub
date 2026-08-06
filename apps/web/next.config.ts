import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@vibeshub/design-tokens'],
};

export default nextConfig;
