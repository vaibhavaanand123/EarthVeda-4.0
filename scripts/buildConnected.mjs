import { execFileSync } from 'node:child_process';

// Cross-platform: no shell-specific environment assignment or public secrets.
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_COMMERCE_MODE: 'connected' },
});
