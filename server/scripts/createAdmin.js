import { loadConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { createAdminRepository } from '../db/miscRepositories.js';
import { createAuthService } from '../services/authService.js';
import { createLogger } from '../lib/logger.js';
import { passwordSchema } from '../services/schemas.js';
const config = loadConfig();
passwordSchema.parse(config.bootstrapAdmin.password);
if (!config.bootstrapAdmin.email)
  throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in your private environment file.');
const db = await openDatabase(config.mongodbUri, config.mongodbDatabase);
try {
  const auth = createAuthService({
    config,
    adminRepository: createAdminRepository(db),
    logger: createLogger({ level: 'info' }),
  });
  const created = await auth.bootstrap(config.bootstrapAdmin);
  if (!created) throw new Error('An admin already exists; use the owner panel to manage accounts.');
} finally {
  await db.close();
}
