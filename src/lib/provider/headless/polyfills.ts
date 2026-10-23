import { host } from './host';
import { encodeRawBase64 } from '@/lib/data/images/imageBinary';
const global = globalThis as unknown as Record<string, unknown>;
global.TextEncoder = class {
  encode(text: string) {
    // Encode Unicode scalar values, replacing lone surrogates per Encoding Standard.
    const out: number[] = [];
    for (let i = 0; i < text.length; i++) {
      let c = text.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) {
        const low = text.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          c = 0x10000 + ((c - 0xd800) << 10) + (low - 0xdc00);
          i++;
        } else c = 0xfffd;
      } else if (c >= 0xdc00 && c <= 0xdfff) c = 0xfffd;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000)
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else
        out.push(
          0xf0 | (c >> 18),
          0x80 | ((c >> 12) & 63),
          0x80 | ((c >> 6) & 63),
          0x80 | (c & 63)
        );
    }
    return new Uint8Array(out);
  }
};
global.crypto = {
  subtle: {
    async digest(_algorithm: string, bytes: Uint8Array) {
      const { hex } = host<{ hex: string }>('crypto.sha256', {
        bytesBase64: encodeRawBase64(new Uint8Array(bytes)),
      });
      return new Uint8Array(hex.match(/../g)!.map(part => parseInt(part, 16)))
        .buffer;
    },
  },
  getRandomValues(array: Uint8Array) {
    array.set(
      host<{ bytes: number[] }>('crypto.random', { length: array.length }).bytes
    );
    return array;
  },
};
global.File = class {
  type: string;
  size: number;
  name: string;
  private bytes: Uint8Array;
  constructor(parts: Uint8Array[], name: string, options: { type: string }) {
    this.name = name;
    this.type = options.type;
    this.size = parts.reduce((n, p) => n + p.length, 0);
    this.bytes = new Uint8Array(this.size);
    let i = 0;
    for (const p of parts) {
      this.bytes.set(p, i);
      i += p.length;
    }
  }
  async arrayBuffer() {
    return this.bytes.buffer;
  }
};
