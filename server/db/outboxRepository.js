import crypto from 'node:crypto';
import { cleanDocument } from './database.js';
export function createOutboxRepository(db, collection = 'notifications') {
  const col = db.collection(collection);
  return {
    async enqueue({ dedupeKey = null, channel, template, recipient, payload, now }) {
      const doc = {
        channel,
        template,
        recipient,
        payload,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: now,
        leaseUntil: null,
        createdAt: now,
        sentAt: null,
        lastError: null,
        dedupeKey,
      };
      if (dedupeKey)
        await col.updateOne(
          { dedupeKey },
          { $setOnInsert: { _id: crypto.randomUUID(), ...doc } },
          { upsert: true },
        );
      else await col.insertOne({ _id: crypto.randomUUID(), ...doc });
    },
    async claimNext(now = new Date().toISOString()) {
      const token = crypto.randomUUID();
      const doc = await col.findOneAndUpdate(
        {
          $or: [
            { status: 'pending', nextAttemptAt: { $lte: now } },
            { status: 'sending', leaseUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            status: 'sending',
            leaseToken: token,
            leaseUntil: new Date(new Date(now).getTime() + 120000).toISOString(),
          },
          $inc: { attempts: 1 },
        },
        { sort: { nextAttemptAt: 1, _id: 1 }, returnDocument: 'after' },
      );
      return cleanDocument(doc);
    },
    markSent: (id, token, now, result) =>
      col.updateOne(
        { _id: id, status: 'sending', leaseToken: token },
        {
          $set: {
            status: 'sent',
            sentAt: now,
            lastError: null,
            result: result || null,
            deleteAt:
              collection === 'notifications' ? new Date(Date.parse(now) + 90 * 86400000) : null,
          },
          $unset: { leaseToken: '', leaseUntil: '' },
        },
      ),
    markRetry: (id, token, nextAt, error) =>
      col.updateOne(
        { _id: id, status: 'sending', leaseToken: token },
        {
          $set: {
            status: 'pending',
            nextAttemptAt: nextAt,
            lastError: String(error).slice(0, 300),
          },
          $unset: { leaseToken: '', leaseUntil: '' },
        },
      ),
    markFailed: (id, token, error) =>
      col.updateOne(
        { _id: id, status: 'sending', leaseToken: token },
        {
          $set: { status: 'failed', lastError: String(error).slice(0, 300) },
          $unset: { leaseToken: '', leaseUntil: '' },
        },
      ),
    markSkipped: (id, token, reason) =>
      col.updateOne(
        { _id: id, status: 'sending', leaseToken: token },
        {
          $set: { status: 'skipped', lastError: reason },
          $unset: { leaseToken: '', leaseUntil: '' },
        },
      ),
    recent: async (limit = 100) =>
      (
        await col
          .find({}, { projection: { payload: 0, leaseToken: 0 } })
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray()
      ).map(cleanDocument),
    retryFailed: async (id, now) =>
      (
        await col.updateOne(
          { _id: id, status: { $in: ['failed', 'skipped'] } },
          {
            $set: { status: 'pending', nextAttemptAt: now, attempts: 0 },
            $unset: { deleteAt: '' },
          },
        )
      ).modifiedCount === 1,
  };
}
