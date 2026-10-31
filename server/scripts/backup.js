// Logical backup. Stop API, worker and other writers first. Use Atlas PITR for
// continuous production backups; this script is not a snapshot under writes.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../config.js';
if (!process.argv.includes('--writers-stopped'))
  throw new Error(
    'Stop all writers, then pass --writers-stopped. For online backup use Atlas PITR.',
  );
const config = loadConfig(),
  dir = path.resolve(process.env.BACKUP_DIR || './backups');
await fs.mkdir(dir, { recursive: true, mode: 0o700 });
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'earthveda-backup-'));
const target = path.join(
  dir,
  `earthveda-${new Date().toISOString().replace(/[:.]/g, '-')}.archive.gz`,
);
try {
  const secret = path.join(temp, 'config.yaml');
  await fs.writeFile(secret, `uri: ${JSON.stringify(config.mongodbUri)}\n`, { mode: 0o600 });
  await new Promise((resolve, reject) => {
    const child = spawn(
      'mongodump',
      [`--config=${secret}`, `--db=${config.mongodbDatabase}`, `--archive=${target}`, '--gzip'],
      { stdio: 'ignore' },
    );
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error('mongodump failed. Check access and MongoDB Database Tools installation.'),
          ),
    );
  });
  await fs.chmod(target, 0o600);
  console.log(`Backup created: ${target}. Encrypt it and store a verified copy off the server.`);
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
