import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { createLogger } from './lib/logger.js';
import { assertConnectedBuild } from './lib/buildReadiness.js';
const config = loadConfig();
if (config.isProduction) await assertConnectedBuild(config.staticDir);
const logger = createLogger({ level: config.logLevel, base: { service: 'earthveda-api' } });
const db = await openDatabase(config.mongodbUri, config.mongodbDatabase);
const schema = await db.collection('settings').findOne({ _id: '_schema' });
if (schema?.value !== 1) {
  await db.close();
  throw new Error('Run npm run db:setup before starting the API.');
}
const { app } = await createApp({ config, db, logger });
const server = app.listen(config.port, config.host, () =>
  logger.info('API listening', { port: config.port, env: config.env }),
);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 30000;
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
