import { stat, readFile } from 'node:fs/promises';
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
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(expiry)
  ) {
    throw new Error('到期时间须使用带时区的 ISO 8601 格式。');
  }
  const { size } = await stat(file);
  if (size > Math.floor((MAX_QR_DATA_URL_LENGTH - 32) * 0.75)) {
    throw new Error('图片过大，请先裁切，仅保留二维码和白边。');
  }
  const bytes = await readFile(file);
  const data = bytes.toString('base64');
  const mediaType =
    bytes.subarray(0, 4).toString('hex') === '89504e47' ? 'png' : 'jpeg';
  const record = validateGroupQr({
    imageDataUrl: `data:image/${mediaType};base64,${data}`,
    expiresAt: Date.parse(expiry),
  });
  if (!record) {
    throw new Error('需要 PNG/JPEG 图片，到期时间须在未来 7 天内。');
  }
  process.stdout.write(JSON.stringify(record));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
