import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig(({ command }) => ({
  // Relative base — the built site works at / (standalone) and under a
  // mounted path in the Pages artifact (serve:pages); dev serves /.
  base: command === 'build' ? './' : '/',
  // Fresh stamp per build — demo links append it as ?v=<stamp> so a stale
  // index.html document is never reused from cache.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  // ssr: true → the `vite build --ssr src/ssg.tsx` pass compiles JSX to
  // Solid's SSR output (renderToString-compatible); the client build gets
  // normal dom output.
  plugins: [solidPlugin({ ssr: true })],
  server: { port: 4185, strictPort: true },
}));
