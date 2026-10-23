import { host } from './host';
export function nanoid(size = 21): string {
  const alphabet =
    '_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return host<{ bytes: number[] }>('crypto.random', { length: size })
    .bytes.map(byte => alphabet[byte & 63])
    .join('');
}
