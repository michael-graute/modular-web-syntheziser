import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    headers: {
      // Enable SharedArrayBuffer support for AudioWorklet
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
  },
  // Ensure worklet files are served with correct MIME type
  assetsInclude: ['**/*.worklet.js'],
});
