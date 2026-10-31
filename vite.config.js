import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const connected = env.VITE_COMMERCE_MODE === 'connected';
  return {
    plugins: [
      react(),
      {
        name: 'commerce-build-info',
        transformIndexHtml(html) {
          if (!connected) return html;
          return html
            .replace('content="noindex, nofollow"', 'content="index, follow"')
            .replace(
              'Shop-Vorschau für Deutschland und Großbritannien.',
              'Für deine kleinen Rituale.',
            );
        },
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'build-info.json',
            source: JSON.stringify({ commerceMode: connected ? 'connected' : 'preview' }),
          });
        },
      },
    ],
    server: {
      host: '0.0.0.0',
      allowedHosts: ['terminal.local'],
      // `npm run dev:api` serves the order API on :8787 during development.
      proxy: connected
        ? { '/api': 'http://localhost:8787', '/uploads': 'http://localhost:8787' }
        : undefined,
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      rollupOptions: {
        output: {
          // Stable vendor chunk: framework code stays cached across storefront releases.
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-dom/client', 'react-router', 'react-router-dom'],
          },
        },
      },
    },
  };
});
