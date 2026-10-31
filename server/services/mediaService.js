import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { badRequest } from '../lib/errors.js';
const MAX_BYTES = 3 * 1024 * 1024;
export function createMediaService({ uploadDir, db }) {
  return {
    MAX_BYTES,
    async saveImage(buffer) {
      if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_BYTES)
        throw badRequest('invalid_image', 'Upload an image under 3 MB.');
      let encoded;
      try {
        const image = sharp(buffer, {
          limitInputPixels: 16000000,
          animated: false,
          failOn: 'warning',
        });
        const meta = await image.metadata();
        if (!['jpeg', 'png', 'webp'].includes(meta.format) || meta.pages > 1)
          throw new Error('Unsupported image');
        encoded = await image
          .rotate()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        throw badRequest('invalid_image', 'Upload a valid, single-frame JPEG, PNG or WebP image.');
      }
      const hash = crypto.createHash('sha256').update(encoded).digest('hex'),
        name = `${hash}.webp`;
      await fs.mkdir(uploadDir, { recursive: true });
      await fs
        .writeFile(path.join(uploadDir, name), encoded, { flag: 'wx', mode: 0o640 })
        .catch((e) => {
          if (e.code !== 'EEXIST') throw e;
        });
      await db.collection('media').updateOne(
        { _id: hash },
        {
          $setOnInsert: {
            url: `/uploads/${name}`,
            bytes: encoded.length,
            createdAt: new Date().toISOString(),
          },
        },
        { upsert: true },
      );
      return { url: `/uploads/${name}`, bytes: encoded.length };
    },
  };
}
