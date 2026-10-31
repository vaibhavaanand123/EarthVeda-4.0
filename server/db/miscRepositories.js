import crypto from 'node:crypto';
import { cleanDocument, nextSequence } from './database.js';
export function createWebhookEventRepository(db) {
  const col = db.collection('paymentEvents');
  return {
    record: async (id, provider, type, now, profile = 'primary') =>
      (
        await col.updateOne(
          { _id: `${provider}:${profile}:${id}` },
          { $setOnInsert: { provider, profile, type, receivedAt: now } },
          { upsert: true },
        )
      ).upsertedCount === 1,
  };
}
export function createSubscriberRepository(db) {
  const col = db.collection('subscribers');
  const find = async (q) => cleanDocument(await col.findOne(q));
  return {
    findByEmail: (email) => find({ email }),
    findByTokenHash: (tokenHash) => find({ tokenHash }),
    async insert({ now, ...data }) {
      await col.insertOne({
        _id: await nextSequence(db, 'subscriber'),
        ...data,
        status: 'pending',
        createdAt: now,
        confirmedAt: null,
        unsubscribedAt: null,
      });
    },
    resetPending: ({ id, now, ...data }) =>
      col.updateOne(
        { _id: id },
        { $set: { ...data, status: 'pending', createdAt: now, unsubscribedAt: null } },
      ),
    confirm: async (id, now) =>
      (
        await col.updateOne(
          { _id: id, status: 'pending' },
          { $set: { status: 'confirmed', confirmedAt: now } },
        )
      ).modifiedCount === 1,
    unsubscribe: async (id, now) =>
      (await col.updateOne({ _id: id }, { $set: { status: 'unsubscribed', unsubscribedAt: now } }))
        .modifiedCount === 1,
    remove: async (id) => (await col.deleteOne({ _id: id })).deletedCount === 1,
    async list({ status, limit = 100, offset = 0 }) {
      const q = status ? { status } : {};
      return {
        total: await col.countDocuments(q),
        subscribers: (
          await col
            .find(q, { projection: { tokenHash: 0, ipHash: 0 } })
            .sort({ _id: -1 })
            .skip(offset)
            .limit(Math.min(limit, 10000))
            .toArray()
        ).map(cleanDocument),
      };
    },
  };
}
export function createWithdrawalRepository(db) {
  const col = db.collection('withdrawals');
  return {
    async insert({ now, ...data }) {
      const doc = {
        _id: await nextSequence(db, 'withdrawal'),
        ...data,
        createdAt: now,
        handled: false,
      };
      await col.insertOne(doc);
      return cleanDocument(doc);
    },
    list: async ({ limit = 100, offset = 0 } = {}) => ({
      total: await col.countDocuments({}),
      withdrawals: (
        await col
          .find({}, { projection: { ipHash: 0 } })
          .sort({ _id: -1 })
          .skip(offset)
          .limit(limit)
          .toArray()
      ).map(cleanDocument),
    }),
    setHandled: async (id, handled) =>
      (await col.updateOne({ _id: id }, { $set: { handled } })).matchedCount === 1,
  };
}
export function createAdminRepository(db) {
  const users = db.collection('adminUsers'),
    sessions = db.collection('adminSessions');
  const find = async (q) => cleanDocument(await users.findOne(q));
  return {
    countUsers: () => users.countDocuments({}),
    findUserByEmail: (email) => find({ email }),
    findUserById: (id) => find({ _id: id }),
    listUsers: async () =>
      (
        await users
          .find({}, { projection: { passwordHash: 0, mfaSecret: 0, mfaPending: 0 } })
          .sort({ createdAt: 1 })
          .toArray()
      ).map(cleanDocument),
    insertUser: ({ id, now, ...data }) =>
      users.insertOne({
        _id: id,
        ...data,
        active: true,
        failedAttempts: 0,
        lockedUntil: null,
        mfaEnabled: false,
        createdAt: now,
        lastLoginAt: null,
      }),
    updateUser: ({ id, ...data }) => users.updateOne({ _id: id }, { $set: data }),
    setPassword: (id, passwordHash) =>
      users.updateOne(
        { _id: id },
        { $set: { passwordHash, failedAttempts: 0, lockedUntil: null } },
      ),
    loginSucceeded: (id, now) =>
      users.updateOne(
        { _id: id },
        { $set: { failedAttempts: 0, lockedUntil: null, lastLoginAt: now } },
      ),
    loginFailed: (id, lockedUntil) =>
      users.updateOne({ _id: id }, { $inc: { failedAttempts: 1 }, $set: { lockedUntil } }),
    insertSession: ({ idHash, userId, now, expiresAt, userAgent }) =>
      sessions.insertOne({
        _id: idHash,
        userId,
        createdAt: now,
        expiresAt: new Date(expiresAt),
        lastSeenAt: now,
        userAgent,
      }),
    async findSession(idHash) {
      const row = await sessions.findOne({ _id: idHash });
      if (!row) return null;
      return {
        idHash,
        expiresAt: row.expiresAt.toISOString(),
        lastSeenAt: row.lastSeenAt,
        user: await find({ _id: row.userId }),
      };
    },
    touchSession: (idHash, now, expiresAt) =>
      sessions.updateOne(
        { _id: idHash },
        { $set: { lastSeenAt: now, expiresAt: new Date(expiresAt) } },
      ),
    deleteSession: (idHash) => sessions.deleteOne({ _id: idHash }),
    deleteUserSessions: (userId) => sessions.deleteMany({ userId }),
    purgeSessions: async (now) =>
      (await sessions.deleteMany({ expiresAt: { $lt: new Date(now) } })).deletedCount,
    audit: ({ actor, action, entity, entityId, data, now }) =>
      db.collection('auditLogs').insertOne({
        _id: crypto.randomUUID(),
        actor,
        action,
        entity,
        entityId: entityId || null,
        data: data || null,
        createdAt: now,
        at: now,
      }),
    auditLog: async (limit = 100) =>
      (
        await db.collection('auditLogs').find({}).sort({ createdAt: -1 }).limit(limit).toArray()
      ).map(cleanDocument),
    setMfaPending: (id, mfaPending) => users.updateOne({ _id: id }, { $set: { mfaPending } }),
    enableMfa: (id, secret, counter) =>
      users.updateOne(
        { _id: id },
        {
          $set: { mfaSecret: secret, mfaEnabled: true, mfaCounter: counter },
          $unset: { mfaPending: '' },
        },
      ),
    consumeMfa: async (id, counter) =>
      (
        await users.updateOne(
          { _id: id, $or: [{ mfaCounter: { $lt: counter } }, { mfaCounter: { $exists: false } }] },
          { $set: { mfaCounter: counter } },
        )
      ).modifiedCount === 1,
  };
}
