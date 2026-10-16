import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@squish/core': path.resolve(__dirname, 'packages/squish-core/src/index.ts'),
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
