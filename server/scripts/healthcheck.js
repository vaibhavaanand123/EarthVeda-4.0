import { loadConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
const config = loadConfig();
if (process.argv[2] === 'worker') {
  const db = await openDatabase(config.mongodbUri, config.mongodbDatabase);
  try {
    const row = await db.collection('settings').findOne({ _id: '_worker' });
    if (!row || Date.now() - Date.parse(row.value.lastSuccessAt) > 120000)
      throw new Error('Worker heartbeat is stale');
  } finally {
    await db.close();
  }
} else {
  const r = await fetch(`http://127.0.0.1:${config.port}/api/ready`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error('API is not ready');
}
