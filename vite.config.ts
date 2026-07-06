import { defineConfig } from 'vite';
import { resolve } from 'path';

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
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // AudioWorkletProcessor files must be a genuine Rollup build entry,
        // not referenced via new URL(..., import.meta.url) alone — Vite only
        // gives that pattern special (bundling) treatment for new Worker()/
        // SharedWorker(), so a plain new URL() to a .ts file is otherwise
        // just copied as a raw, untranspiled static asset with its imports
        // left unresolved (works in dev only because Vite's dev server
        // transpiles every .ts request on the fly; breaks silently in a
        // production build/deploy, since AudioWorkletProcessor errors don't
        // surface outside the worklet's own isolated scope).
        'karplus-strong.worklet': resolve(__dirname, 'src/worklets/karplus-strong.worklet.ts'),
      },
      output: {
        // Keep the worklet's build output filename stable (no content hash)
        // so KarplusStrong.ts can reference it by a predictable path.
        entryFileNames: (chunk) => {
          return chunk.name === 'karplus-strong.worklet'
            ? 'assets/karplus-strong.worklet.js'
            : 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
