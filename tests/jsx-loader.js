// Node 24 test-only JSX loader. It never starts a preview server or a browser.
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const root = new URL('../', import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith(root + 'src/')) {
      const candidate = new URL(specifier, context.parentURL);
      if (!/\.[a-z]+$/i.test(candidate.pathname)) {
        for (const extension of ['.js', '.jsx']) {
          const resolved = new URL(candidate.href + extension);
          if (existsSync(fileURLToPath(resolved))) return next(resolved.href, context);
        }
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root + 'src/') && /\.jsx?$/.test(url)) {
      return {
        format: 'module',
        shortCircuit: true,
        source: transformSync(readFileSync(fileURLToPath(url), 'utf8'), {
          loader: 'jsx',
          format: 'esm',
          jsx: 'automatic',
          define: {
            'import.meta.env': JSON.stringify({ DEV: false, VITE_COMMERCE_MODE: 'preview' }),
          },
        }).code,
      };
    }
    return next(url, context);
  },
});
