import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// The desktop renderer is the v4 web app; only the compression layer is swapped
// for the native FFmpeg bridge in src/native-compress.ts.
const web = fileURLToPath(new URL('../../../v4/apps/web/', import.meta.url));
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Next serves app/icon.svg at /icon.svg; the browser-only FFmpeg WASM bundle in
// public/ffmpeg is not needed next to the native encoder.
function webPublicAssets(): Plugin {
  let outDir = '';
  return {
    name: 'squik-web-public-assets',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use('/icon.svg', (_req, res) => {
        res.setHeader('Content-Type', 'image/svg+xml');
        void import('node:fs').then(({ createReadStream }) =>
          createReadStream(`${web}app/icon.svg`).pipe(res),
        );
      });
    },
    async writeBundle() {
      await copyFile(`${web}app/icon.svg`, `${outDir}/icon.svg`);
      await rm(`${outDir}/ffmpeg`, { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  base: '/',
  publicDir: `${web}public`,
  plugins: [react(), tailwindcss(), webPublicAssets()],
  resolve: {
    alias: [
      { find: '@/lib/compress-wasm', replacement: local('./src/native-compress.ts') },
      { find: '@/lib/platform', replacement: local('./src/platform.ts') },
      { find: 'next/link', replacement: local('./src/shims/next-link.tsx') },
      { find: 'next/dynamic', replacement: local('./src/shims/next-dynamic.tsx') },
      { find: '@squish/i18n/react', replacement: `${web}lib/i18n/react.tsx` },
      { find: '@squish/i18n', replacement: `${web}lib/i18n/index.ts` },
      { find: /^@\//, replacement: web },
    ],
  },
  server: {
    port: 3000,
    strictPort: true,
    // The page runs at squik://app, so point the HMR socket at the dev server.
    hmr: { host: 'localhost', port: 3000 },
    fs: { allow: [local('../../..')] },
    watch: {
      ignored: ['**/release/**'],
    },
  },
});
