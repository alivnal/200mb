import type { NextConfig } from 'next';

const coopCoepHeaders = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
];

const corpHeader = [{ key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }];

const nextConfig: NextConfig = {
  transpilePackages: ['@squish/i18n'],
  async headers() {
    return [
      { source: '/(.*)', headers: coopCoepHeaders },
      { source: '/wave/:path*', headers: corpHeader },
      { source: '/gym/:path*', headers: corpHeader },
      { source: '/sleep/:path*', headers: corpHeader },
      { source: '/:path*.svg', headers: corpHeader },
      {
        source: '/:path*.wasm',
        headers: [{ key: 'Content-Type', value: 'application/wasm' }, ...corpHeader],
      },
    ];
  },
};

export default nextConfig;
