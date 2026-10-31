import fs from 'node:fs/promises';
import path from 'node:path';

/** A frontend demo must never accidentally become a production checkout. */
export async function assertConnectedBuild(staticDir) {
  let info;
  try {
    info = JSON.parse(await fs.readFile(path.join(staticDir, 'build-info.json'), 'utf8'));
  } catch {
    throw new Error(
      'Storefront build metadata is missing. Rebuild with VITE_COMMERCE_MODE=connected.',
    );
  }
  if (info.commerceMode !== 'connected')
    throw new Error(
      'Production cannot serve a preview checkout. Rebuild with VITE_COMMERCE_MODE=connected.',
    );
  await fs.access(path.join(staticDir, 'index.html'));
}
