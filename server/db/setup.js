import { SEED_PRODUCTS, SEED_SETTINGS } from '../../shared/seed.js';
const number = { bsonType: ['int', 'long', 'double'], minimum: 0, multipleOf: 1 };
const validators = {
  products: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'sku', 'slug', 'price', 'version', 'i18n'],
      properties: {
        _id: { bsonType: 'string' },
        sku: { bsonType: 'string' },
        slug: { bsonType: 'string' },
        price: number,
        version: number,
      },
    },
  },
  inventory: {
    $and: [
      {
        $jsonSchema: {
          bsonType: 'object',
          required: ['_id', 'productId', 'country', 'onHand', 'reserved', 'version'],
          properties: {
            _id: { bsonType: 'string' },
            onHand: number,
            reserved: number,
            version: number,
          },
        },
      },
      { $expr: { $lte: ['$reserved', '$onHand'] } },
    ],
  },
  orders: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        '_id',
        'orderNumber',
        'idempotencyKey',
        'country',
        'currency',
        'total',
        'lines',
        'status',
      ],
      properties: {
        _id: { bsonType: 'string' },
        total: number,
        amountRefunded: number,
        currency: { enum: ['EUR'] },
        country: { enum: ['DE', 'GB'] },
        lines: { bsonType: 'array', minItems: 1 },
      },
    },
  },
};
const indexes = {
  products: [
    [{ sku: 1 }, { unique: true }],
    [{ slug: 1 }, { unique: true }],
    [{ active: 1, archivedAt: 1, sortOrder: 1 }, {}],
  ],
  inventory: [[{ productId: 1, country: 1 }, { unique: true }]],
  stockMovements: [[{ operationId: 1, productId: 1, country: 1 }, { unique: true }]],
  orders: [
    [{ orderNumber: 1 }, { unique: true }],
    [{ idempotencyKey: 1 }, { unique: true }],
    [
      { 'payment.profileId': 1, 'payment.sessionId': 1 },
      { unique: true, partialFilterExpression: { 'payment.sessionId': { $type: 'string' } } },
    ],
    [{ status: 1, createdAt: -1 }, {}],
    [{ 'customer.email': 1 }, {}],
    [{ reservationState: 1, reservationExpiresAt: 1 }, {}],
  ],
  adminUsers: [[{ email: 1 }, { unique: true }]],
  adminSessions: [
    [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
    [{ userId: 1 }, {}],
  ],
  subscribers: [
    [{ email: 1 }, { unique: true }],
    [{ tokenHash: 1 }, { unique: true }],
  ],
  notifications: [
    [
      { dedupeKey: 1 },
      { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
    ],
    [{ status: 1, nextAttemptAt: 1, leaseUntil: 1 }, {}],
    [{ deleteAt: 1 }, { expireAfterSeconds: 0 }],
  ],
  jobs: [
    [{ dedupeKey: 1 }, { unique: true }],
    [{ status: 1, nextAttemptAt: 1, leaseUntil: 1 }, {}],
  ],
  rateLimits: [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
  auditLogs: [
    [{ createdAt: -1 }, {}],
    [{ entity: 1, entityId: 1, createdAt: -1 }, {}],
  ],
};
export async function setupDatabase(db, { seed = false, demoStock = 0, production = false } = {}) {
  const names = new Set((await db.database.listCollections().toArray()).map((c) => c.name));
  const all = new Set([
    ...Object.keys(indexes),
    ...Object.keys(validators),
    'settings',
    'counters',
    'paymentEvents',
    'withdrawals',
    'media',
  ]);
  for (const name of all) {
    if (!names.has(name))
      await db.database.createCollection(
        name,
        validators[name] ? { validator: validators[name], validationLevel: 'strict' } : {},
      );
    else if (validators[name])
      await db.database.command({
        collMod: name,
        validator: validators[name],
        validationLevel: 'strict',
      });
    for (const [keys, options] of indexes[name] || [])
      await db.database.collection(name).createIndex(keys, options);
  }
  if (seed) {
    const now = new Date().toISOString();
    for (const p of SEED_PRODUCTS) {
      await db.collection('products').updateOne(
        { _id: p.id },
        {
          $setOnInsert: {
            ...p,
            active: production ? false : p.active,
            version: 1,
            archivedAt: null,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
      for (const country of ['DE', 'GB'])
        await db.collection('inventory').updateOne(
          { _id: `${country}:${p.id}` },
          {
            $setOnInsert: {
              productId: p.id,
              country,
              onHand: production ? 0 : demoStock,
              reserved: 0,
              version: 1,
              updatedAt: now,
            },
          },
          { upsert: true },
        );
    }
    for (const [key, value] of Object.entries(SEED_SETTINGS))
      await db
        .collection('settings')
        .updateOne(
          { _id: key },
          { $setOnInsert: { value, updatedAt: now, updatedBy: 'seed' } },
          { upsert: true },
        );
  }
  await db
    .collection('settings')
    .updateOne(
      { _id: '_schema' },
      { $set: { value: 1, updatedAt: new Date().toISOString() } },
      { upsert: true },
    );
}
