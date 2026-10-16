import type { NextConfig } from 'next';

const coopCoepHeaders = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
];

const corpHeader = [{ key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }];

// Long-lived immutable assets (versioned by filename).
const immutableCache = [
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@squish/i18n'],
  async headers() {
    return [
      // COOP/COEP required for SharedArrayBuffer (FFmpeg.wasm threads).
      { source: '/(.*)', headers: coopCoepHeaders },

      // Mascot / animation assets — same-origin required for COEP.
      { source: '/wave/:path*', headers: corpHeader },
      { source: '/gym/:path*', headers: corpHeader },
      { source: '/sleep/:path*', headers: corpHeader },
      { source: '/:path*.svg', headers: corpHeader },
      { source: '/:path*.gif', headers: corpHeader },

      // FFmpeg WASM bundle — large, immutable, content-addressed by version.
      {
        source: '/ffmpeg/:path*',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
          ...corpHeader,
          ...immutableCache,
        ],
      },
      // Override Content-Type for the JS loader specifically.
      {
        source: '/ffmpeg/ffmpeg-core.js',
        headers: [
          { key: 'Content-Type', value: 'text/javascript' },
          ...corpHeader,
          ...immutableCache,
        ],
      },
    ];
  },
};

export default nextConfig;
