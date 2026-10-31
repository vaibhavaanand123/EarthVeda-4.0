import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { createLogger } from './lib/logger.js';
const config = loadConfig(),
  logger = createLogger({ level: config.logLevel, base: { service: 'earthveda-worker' } });
const db = await openDatabase(config.mongodbUri, config.mongodbDatabase);
if ((await db.collection('settings').findOne({ _id: '_schema' }))?.value !== 1)
  throw new Error('Run db:setup first.');
const { services, dispatcher, jobDispatcher } = await createApp({ config, db, logger });
let running = false,
  stopping = false;
async function reconcile() {
  if (running || stopping) return;
  running = true;
  try {
    await services.catalogService.refresh(true);
    await services.orderService.reconcile();
    await services.authService.purgeExpired();
    await db
      .collection('settings')
      .updateOne(
        { _id: '_worker' },
        { $set: { value: { lastSuccessAt: new Date().toISOString() } } },
        { upsert: true },
      );
  } catch (e) {
    logger.error('worker reconciliation failed', { errorType: e.name });
  } finally {
    running = false;
  }
}
dispatcher.start();
jobDispatcher.start();
await reconcile();
const timer = setInterval(reconcile, 30000);
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  setTimeout(() => process.exit(1), 30000).unref();
  await dispatcher.stop();
  await jobDispatcher.stop();
  while (running) await new Promise((r) => setTimeout(r, 50));
  await db.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
