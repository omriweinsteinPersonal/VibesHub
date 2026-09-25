import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.192'],
  devIndicators: false,
  images: {
    remotePatterns: [{ hostname: '**', protocol: 'https' }],
  },
  reactStrictMode: true,
  transpilePackages: ['@vibeshub/design-tokens'],
  async redirects() {
    return [
      {
        source: '/account/saved',
        destination: '/discover',
        permanent: false,
      },
      {
        source: '/account/following',
        destination: '/creators',
        permanent: false,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'vibes-hub-web.vercel.app',
          },
        ],
        destination: 'https://swavii.com/:path*',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    return [
      ...(supabaseUrl && new URL(supabaseUrl).pathname === '/supabase'
        ? [
            {
              source: '/supabase/:path*',
              destination: 'http://127.0.0.1:55321/:path*',
            },
          ]
        : []),
      ...(apiUrl && new URL(apiUrl).pathname === '/api-proxy'
        ? [
            {
              source: '/api-proxy/:path*',
              destination: 'http://127.0.0.1:4000/:path*',
            },
          ]
        : []),
    ];
  },
};

export default nextConfig;
