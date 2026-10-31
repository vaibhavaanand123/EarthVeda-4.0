// Emergency offline recovery by an operator with server and database access.
import { loadConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { createAdminRepository } from '../db/miscRepositories.js';
if (!process.argv.includes('--offline-recovery') || !process.env.RECOVERY_EMAIL)
  throw new Error('Stop the API/worker. Set RECOVERY_EMAIL and pass --offline-recovery.');
const config = loadConfig(),
  db = await openDatabase(config.mongodbUri, config.mongodbDatabase);
try {
  const repo = createAdminRepository(db),
    user = await repo.findUserByEmail(process.env.RECOVERY_EMAIL.toLowerCase());
  if (!user) throw new Error('User not found');
  await db.transaction(async () => {
    await db
      .collection('adminUsers')
      .updateOne(
        { _id: user.id },
        { $set: { mfaEnabled: false }, $unset: { mfaSecret: '', mfaPending: '', mfaCounter: '' } },
      );
    await repo.deleteUserSessions(user.id);
    await repo.audit({
      actor: 'offline-recovery',
      action: 'auth.mfa.reset',
      entity: 'user',
      entityId: user.id,
      now: new Date().toISOString(),
    });
  });
  console.log('MFA reset; next login is limited to MFA enrollment.');
} finally {
  await db.close();
}
