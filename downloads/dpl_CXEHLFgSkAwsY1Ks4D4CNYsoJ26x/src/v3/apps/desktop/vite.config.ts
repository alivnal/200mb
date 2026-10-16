import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@squish/core': path.resolve(__dirname, '../../packages/squish-core/src/index.ts'),
      // More specific i18n subpath must come before the package root alias.
      '@squish/i18n/react': path.resolve(__dirname, '../../packages/i18n/src/react.tsx'),
      '@squish/i18n': path.resolve(__dirname, '../../packages/i18n/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    watch: {
      ignored: ['**/release/**'],
    },
  },
});
