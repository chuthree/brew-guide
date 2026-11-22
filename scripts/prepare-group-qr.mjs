import { stat, readFile } from 'node:fs/promises';
import { parseISO } from 'date-fns';
import sharp from 'sharp';
import {
  MAX_QR_DATA_URL_LENGTH,
  validateGroupQr,
} from '../edge-functions/api/group-qr.js';

try {
  const [file, expiry] = process.argv.slice(2);
  if (!file || !expiry) {
    throw new Error(
      '用法: node scripts/prepare-group-qr.mjs <已裁切群码.png 或 .jpg> <到期时间，例如 2026-12-01T00:00:00+08:00>'
    );
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(expiry)
  ) {
    throw new Error('到期时间须使用带时区的 ISO 8601 格式。');
  }
  const { size } = await stat(file);
  if (size > Math.floor((MAX_QR_DATA_URL_LENGTH - 32) * 0.75)) {
    throw new Error('图片过大，请先裁切，仅保留二维码和白边。');
  }
  const bytes = await readFile(file);
  const image = sharp(bytes, { failOn: 'warning' });
  const { format } = await image.metadata();
  if (format !== 'png' && format !== 'jpeg') {
    throw new Error('群码图片须使用 PNG 或 JPEG 格式。');
  }
  // Decode pixels before publishing so a truncated file cannot replace the group code.
  await image.stats();
  const record = validateGroupQr({
    imageDataUrl: `data:image/${format};base64,${bytes.toString('base64')}`,
    expiresAt: parseISO(expiry).getTime(),
  });
  if (!record) {
    throw new Error('需要 PNG/JPEG 图片，到期时间须在未来 7 天内。');
  }
  process.stdout.write(JSON.stringify(record));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
