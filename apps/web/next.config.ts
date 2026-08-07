import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ hostname: '**', protocol: 'https' }],
  },
  reactStrictMode: true,
  transpilePackages: ['@vibeshub/design-tokens'],
};

export default nextConfig;
