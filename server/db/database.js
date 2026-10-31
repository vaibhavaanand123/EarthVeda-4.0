import { MongoClient } from 'mongodb';
import { AsyncLocalStorage } from 'node:async_hooks';

/** Repositories automatically join the current transaction session. */
export async function openDatabase(uri, name = 'earthveda') {
  const client = new MongoClient(uri, {
    maxPoolSize: 20,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    retryWrites: true,
  });
  await client.connect();
  const database = client.db(name);
  const hello = await database.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    await client.close();
    throw new Error(
      'MongoDB must be a replica set or Atlas cluster. Start the local replica set before db:setup.',
    );
  }
  const context = new AsyncLocalStorage();
  const collections = new Map();
  const optionIndex = {
    find: 1,
    findOne: 1,
    findOneAndUpdate: 2,
    insertOne: 1,
    insertMany: 1,
    updateOne: 2,
    updateMany: 2,
    replaceOne: 2,
    deleteOne: 1,
    deleteMany: 1,
    countDocuments: 1,
    aggregate: 1,
    bulkWrite: 1,
  };
  const store = {
    client,
    database,
    collection(name) {
      if (!collections.has(name)) {
        const col = database.collection(name);
        collections.set(
          name,
          new Proxy(col, {
            get(target, property) {
              const value = target[property];
              if (typeof value !== 'function') return value;
              if (!(property in optionIndex)) return value.bind(target);
              return (...args) => {
                const session = context.getStore();
                if (session) {
                  const i = optionIndex[property];
                  args[i] = { ...args[i], session };
                }
                return value.apply(target, args);
              };
            },
          }),
        );
      }
      return collections.get(name);
    },
    async transaction(fn) {
      if (context.getStore()) return fn();
      const session = client.startSession();
      try {
        return await session.withTransaction(() => context.run(session, fn), {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          maxCommitTimeMS: 10000,
        });
      } finally {
        await session.endSession();
      }
    },
    ping: () => database.command({ ping: 1 }),
    close: () => client.close(),
  };
  return store;
}
export const transaction = (db, fn) => db.transaction(fn);
export const cleanDocument = (record) => {
  if (!record) return null;
  const { _id, ...fields } = record;
  return { id: _id, ...fields };
};
export async function nextSequence(db, name) {
  const row = await db
    .collection('counters')
    .findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
  return row.value;
}
