export function createSettingsRepository(db) {
  const col = db.collection('settings');
  return {
    all: async () =>
      Object.fromEntries(
        (await col.find({ _id: { $not: /^_/ } }).toArray()).map((r) => [r._id, r.value]),
      ),
    set: (key, value, actor, now) =>
      col.updateOne(
        { _id: key },
        { $set: { value, updatedBy: actor, updatedAt: now } },
        { upsert: true },
      ),
  };
}
