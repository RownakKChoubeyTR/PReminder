import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone mode for Docker builds
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,

  // SCSS support
  sassOptions: {
    includePaths: ['./src/styles'],
  },

  // Security headers
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
      ],
    },
  ],

  // Image domains (GitHub avatars)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
    ],
  },

  // Disable telemetry
  experimental: {
    serverSourceMaps: true,
  },
};

export default nextConfig;
