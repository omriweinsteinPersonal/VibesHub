import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.192'],
  devIndicators: false,
  images: {
    remotePatterns: [{ hostname: '**', protocol: 'https' }],
  },
  reactStrictMode: true,
  transpilePackages: ['@vibeshub/design-tokens'],
};

export default nextConfig;
