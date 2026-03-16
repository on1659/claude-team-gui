import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/webview',
    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, 'src/webview/sidebar/index.html'),
        panel: resolve(__dirname, 'src/webview/panel/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    cssCodeSplit: true,
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV !== 'production',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
});
