import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getRecordsMock } = vi.hoisted(() => ({
  getRecordsMock: vi.fn(),
}));

vi.mock('@/lib/data/repositories', () => ({
  coffeeBeanImageRepository: { getRecords: getRecordsMock },
}));

import {
  createCoffeeBeanSharePackage,
  readCoffeeBeanSharePackage,
} from './beanSharePackage';

async function openZip(blob: Blob) {
  const { default: JSZip } = await import('jszip');
  return JSZip.loadAsync(await blob.arrayBuffer());
}

async function makePackage(
  manifest: unknown,
  files: Record<string, Uint8Array> = {}
): Promise<File> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest));
  for (const [path, bytes] of Object.entries(files)) zip.file(path, bytes);
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'beans.brewbeans.zip', { type: 'application/zip' });
}

const v2Manifest = (beans: unknown[]) => ({
  type: 'brew-guide/coffee-beans-package',
  version: 2,
  exportedAt: '2026-09-26T00:00:00.000Z',
  beans,
});

describe('CoffeeBean share package v2', () => {
  beforeEach(() => {
    getRecordsMock.mockReset();
    getRecordsMock.mockResolvedValue([]);
  });

  it('exports file images with exact MIME metadata and raw archive bytes', async () => {
    getRecordsMock.mockResolvedValue([
      {
        beanId: 'bean-1',
        image: 'data:IMAGE/SVG+XML;base64,PHN2Zz4=',
        updatedAt: 1,
      },
    ]);

    const result = await createCoffeeBeanSharePackage(
      [{ id: 'bean-1', timestamp: 1, name: 'Ethiopia' }],
      ['bean-1']
    );
    const zip = await openZip(result.blob);
    const manifest = JSON.parse(
      (await zip.file('manifest.json')?.async('string')) ?? '{}'
    );
    const imagePath = 'images/bean-1-front.bin';

    expect(manifest.version).toBe(2);
    expect(manifest.beans[0].image).toEqual({
      kind: 'file',
      path: imagePath,
      mimeType: 'IMAGE/SVG+XML',
    });
    await expect(zip.file(imagePath)?.async('base64')).resolves.toBe(
      'PHN2Zz4='
    );
  });

  it('exports external image references without fetching or archiving them', async () => {
    const frontUrl = 'https://Example.COM/a%2Fb?b=2&a=1#Frag';
    const backUrl = 'http://example.com/back.jpg?sig=fake#back';
    getRecordsMock.mockResolvedValue([
      {
        beanId: 'bean-2',
        image: frontUrl,
        backImage: backUrl,
        updatedAt: 2,
      },
    ]);

    const result = await createCoffeeBeanSharePackage(
      [{ id: 'bean-2', timestamp: 2, name: 'Kenya' }],
      ['bean-2']
    );
    const zip = await openZip(result.blob);
    const manifest = JSON.parse(
      (await zip.file('manifest.json')?.async('string')) ?? '{}'
    );

    expect(manifest.beans[0].image).toEqual({
      kind: 'external',
      url: frontUrl,
    });
    expect(manifest.beans[0].backImage).toEqual({
      kind: 'external',
      url: backUrl,
    });
    expect(Object.keys(zip.files).sort()).toEqual(['manifest.json']);
    await expect(
      readCoffeeBeanSharePackage(
        new File([result.blob], 'external.brewbeans.zip')
      )
    ).resolves.toEqual([
      {
        name: 'Kenya',
        image: frontUrl,
        backImage: backUrl,
      },
    ]);
  });

  it('imports v2 file MIME from the manifest and preserves external URLs', async () => {
    const externalUrl = 'http://example.com/back.jpg?sig=fake#preview';
    const file = await makePackage(
      {
        type: 'brew-guide/coffee-beans-package',
        version: 2,
        exportedAt: '2026-09-26T00:00:00.000Z',
        beans: [
          {
            name: 'Colombia',
            image: {
              kind: 'file',
              path: 'images/front.bin',
              mimeType: 'IMAGE/SVG+XML',
            },
            backImage: { kind: 'external', url: externalUrl },
          },
        ],
      },
      { 'images/front.bin': new Uint8Array([60, 115, 118, 103, 62]) }
    );

    await expect(readCoffeeBeanSharePackage(file)).resolves.toEqual([
      {
        name: 'Colombia',
        image: 'data:IMAGE/SVG+XML;base64,PHN2Zz4=',
        backImage: externalUrl,
      },
    ]);
  });

  it('round-trips front embedded and back external sources', async () => {
    const backUrl = 'https://example.com/back.jpg?signature=fake';
    getRecordsMock.mockResolvedValue([
      {
        beanId: 'bean-front-embedded',
        image: 'data:image/png;base64,AAECAw==',
        backImage: backUrl,
        updatedAt: 8,
      },
    ]);

    const result = await createCoffeeBeanSharePackage(
      [
        {
          id: 'bean-front-embedded',
          timestamp: 8,
          name: 'Front embedded',
        },
      ],
      ['bean-front-embedded']
    );
    const zip = await openZip(result.blob);
    const manifest = JSON.parse(
      (await zip.file('manifest.json')?.async('string')) ?? '{}'
    );
    expect(manifest.beans[0].image).toMatchObject({
      kind: 'file',
      mimeType: 'image/png',
    });
    expect(manifest.beans[0].backImage).toEqual({
      kind: 'external',
      url: backUrl,
    });

    await expect(
      readCoffeeBeanSharePackage(
        new File([result.blob], 'front-embedded.brewbeans.zip')
      )
    ).resolves.toEqual([
      {
        name: 'Front embedded',
        image: 'data:image/png;base64,AAECAw==',
        backImage: backUrl,
      },
    ]);
  });

  it('continues to import v1 packages using their legacy extension-based MIME', async () => {
    const file = await makePackage(
      {
        type: 'brew-guide/coffee-beans-package',
        version: 1,
        exportedAt: '2026-09-26T00:00:00.000Z',
        beans: [
          {
            name: 'Guatemala',
            imageFile: 'images/bean-1-front.png',
          },
        ],
      },
      { 'images/bean-1-front.png': new Uint8Array([1, 2, 3]) }
    );

    await expect(readCoffeeBeanSharePackage(file)).resolves.toEqual([
      { name: 'Guatemala', image: 'data:image/png;base64,AQID' },
    ]);
  });

  it.each([
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['heic', 'image/heic'],
    ['heif', 'image/heif'],
  ])(
    'keeps the historical v1 .%s MIME mapping',
    async (extension, mimeType) => {
      const imagePath = `images/legacy.${extension}`;
      const file = await makePackage(
        {
          type: 'brew-guide/coffee-beans-package',
          version: 1,
          exportedAt: '2026-09-26T00:00:00.000Z',
          beans: [{ name: 'Legacy', imageFile: imagePath }],
        },
        { [imagePath]: new Uint8Array([1, 2, 3]) }
      );

      await expect(readCoffeeBeanSharePackage(file)).resolves.toEqual([
        {
          name: 'Legacy',
          image: `data:${mimeType};base64,AQID`,
        },
      ]);
    }
  );

  it.each([
    ['JPEG', new Uint8Array([0xff, 0xd8, 0xff, 0x01]), 'image/jpeg'],
    [
      'PNG',
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'image/png',
    ],
    ['GIF87a', new TextEncoder().encode('GIF87a'), 'image/gif'],
    ['GIF89a', new TextEncoder().encode('GIF89a'), 'image/gif'],
    [
      'WebP',
      new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]),
      'image/webp',
    ],
  ])(
    'recovers legacy v1 .bin %s from its recognized signature',
    async (_format, bytes, mimeType) => {
      const file = await makePackage(
        {
          type: 'brew-guide/coffee-beans-package',
          version: 1,
          exportedAt: '2026-09-26T00:00:00.000Z',
          beans: [{ name: 'Legacy signature', imageFile: 'images/image.bin' }],
        },
        { 'images/image.bin': bytes as Uint8Array }
      );
      const expectedBase64 = btoa(
        String.fromCharCode(...(bytes as Uint8Array))
      );

      await expect(readCoffeeBeanSharePackage(file)).resolves.toEqual([
        {
          name: 'Legacy signature',
          image: `data:${mimeType};base64,${expectedBase64}`,
        },
      ]);
    }
  );

  it('fails closed for an unrecognized legacy v1 .bin image', async () => {
    const file = await makePackage(
      {
        type: 'brew-guide/coffee-beans-package',
        version: 1,
        exportedAt: '2026-09-26T00:00:00.000Z',
        beans: [{ name: 'Unknown binary', imageFile: 'images/image.bin' }],
      },
      { 'images/image.bin': new Uint8Array([0, 1, 2, 3]) }
    );

    await expect(readCoffeeBeanSharePackage(file)).rejects.toThrow(
      'Unable to determine image format from legacy share package'
    );
  });

  it('uses the same limited signature detection for an unknown legacy extension', async () => {
    const file = await makePackage(
      {
        type: 'brew-guide/coffee-beans-package',
        version: 1,
        exportedAt: '2026-09-26T00:00:00.000Z',
        beans: [
          { name: 'Unknown extension', imageFile: 'images/image.legacy' },
        ],
      },
      {
        'images/image.legacy': new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]),
      }
    );

    await expect(readCoffeeBeanSharePackage(file)).resolves.toEqual([
      {
        name: 'Unknown extension',
        image: 'data:image/png;base64,iVBORw0KGgo=',
      },
    ]);
  });

  it('does not sniff HEIC or HEIF brands from legacy v1 .bin assets', async () => {
    const file = await makePackage(
      {
        type: 'brew-guide/coffee-beans-package',
        version: 1,
        exportedAt: '2026-09-26T00:00:00.000Z',
        beans: [{ name: 'Unknown HEIF family', imageFile: 'images/image.bin' }],
      },
      {
        'images/image.bin': new TextEncoder().encode(
          '....ftypheic....ftypheif'
        ),
      }
    );

    await expect(readCoffeeBeanSharePackage(file)).rejects.toThrow(
      'Unable to determine image format from legacy share package'
    );
  });

  it.each([
    'image/gif',
    'image/heic',
    'image/heif',
    'image/heic-sequence',
    'image/heif-sequence',
  ])('round-trips v2 embedded %s MIME and bytes', async mimeType => {
    const beanId = `bean-${mimeType}`;
    const dataUrl = `data:${mimeType};base64,AAECAw==`;
    getRecordsMock.mockResolvedValue([
      { beanId, image: dataUrl, updatedAt: 4 },
    ]);

    const result = await createCoffeeBeanSharePackage(
      [{ id: beanId, timestamp: 4, name: 'Format fixture' }],
      [beanId]
    );
    const zip = await openZip(result.blob);
    const manifest = JSON.parse(
      (await zip.file('manifest.json')?.async('string')) ?? '{}'
    );
    const image = manifest.beans[0].image;
    expect(image.kind).toBe('file');
    expect(image.mimeType).toBe(mimeType);
    await expect(zip.file(image.path)?.async('base64')).resolves.toBe(
      'AAECAw=='
    );

    const imported = await readCoffeeBeanSharePackage(
      new File([result.blob], 'format.brewbeans.zip')
    );
    expect(imported[0].image).toBe(dataUrl);
  });

  it('round-trips two embedded sides with independent MIME and archive paths', async () => {
    getRecordsMock.mockResolvedValue([
      {
        beanId: 'bean-two-embedded',
        image: 'data:image/png;base64,AAECAw==',
        backImage: 'data:image/gif;base64,R0lGODlhAQAB',
        updatedAt: 9,
      },
    ]);

    const result = await createCoffeeBeanSharePackage(
      [{ id: 'bean-two-embedded', timestamp: 9, name: 'Two embedded' }],
      ['bean-two-embedded']
    );
    const zip = await openZip(result.blob);
    const manifest = JSON.parse(
      (await zip.file('manifest.json')?.async('string')) ?? '{}'
    );
    const front = manifest.beans[0].image;
    const back = manifest.beans[0].backImage;

    expect(front.kind).toBe('file');
    expect(front.mimeType).toBe('image/png');
    expect(back.kind).toBe('file');
    expect(back.mimeType).toBe('image/gif');
    expect(front.path).not.toBe(back.path);
    await expect(zip.file(front.path)?.async('base64')).resolves.toBe(
      'AAECAw=='
    );
    await expect(zip.file(back.path)?.async('base64')).resolves.toBe(
      'R0lGODlhAQAB'
    );

    await expect(
      readCoffeeBeanSharePackage(
        new File([result.blob], 'two-embedded.brewbeans.zip')
      )
    ).resolves.toEqual([
      {
        name: 'Two embedded',
        image: 'data:image/png;base64,AAECAw==',
        backImage: 'data:image/gif;base64,R0lGODlhAQAB',
      },
    ]);
  });

  it('round-trips front external and back embedded sources independently', async () => {
    const frontUrl = 'https://Example.COM/a%2Fb?b=2&a=1#Frag';
    const backDataUrl = 'data:image/gif;base64,R0lGODlhAQAB';
    getRecordsMock.mockResolvedValue([
      {
        beanId: 'bean-mixed-reverse',
        image: frontUrl,
        backImage: backDataUrl,
        updatedAt: 5,
      },
    ]);

    const result = await createCoffeeBeanSharePackage(
      [
        {
          id: 'bean-mixed-reverse',
          timestamp: 5,
          name: 'Mixed reverse',
          flavor: ['citrus'],
        },
      ],
      ['bean-mixed-reverse']
    );
    const zip = await openZip(result.blob);
    const manifest = JSON.parse(
      (await zip.file('manifest.json')?.async('string')) ?? '{}'
    );
    expect(manifest.beans[0].image).toEqual({
      kind: 'external',
      url: frontUrl,
    });
    expect(manifest.beans[0].backImage).toMatchObject({
      kind: 'file',
      mimeType: 'image/gif',
    });
    expect(manifest.beans[0].flavor).toEqual(['citrus']);
    expect(JSON.stringify(manifest)).not.toMatch(
      /source_kind|relative_path|image_id|objectKey/
    );

    const imported = await readCoffeeBeanSharePackage(
      new File([result.blob], 'mixed.brewbeans.zip')
    );
    expect(imported).toEqual([
      {
        name: 'Mixed reverse',
        flavor: ['citrus'],
        image: frontUrl,
        backImage: backDataUrl,
      },
    ]);
  });

  it('exports and imports beans with no images without adding descriptors', async () => {
    getRecordsMock.mockResolvedValue([]);
    const result = await createCoffeeBeanSharePackage(
      [
        {
          id: 'bean-no-images',
          timestamp: 6,
          name: 'No images',
          blendComponents: [{ origin: 'source-1', percentage: 100 }],
        },
      ],
      ['bean-no-images']
    );
    const zip = await openZip(result.blob);
    const manifest = JSON.parse(
      (await zip.file('manifest.json')?.async('string')) ?? '{}'
    );
    expect(manifest.beans[0]).not.toHaveProperty('image');
    expect(manifest.beans[0]).not.toHaveProperty('backImage');
    expect(Object.keys(zip.files).sort()).toEqual(['manifest.json']);

    await expect(
      readCoffeeBeanSharePackage(new File([result.blob], 'empty.brewbeans.zip'))
    ).resolves.toEqual([
      {
        name: 'No images',
        blendComponents: [{ origin: 'source-1', percentage: 100 }],
      },
    ]);
  });

  it('rejects invalid image references and incomplete v2 archives', async () => {
    getRecordsMock.mockResolvedValue([
      {
        beanId: 'bean-3',
        image: 'data:image/png;base64,not-base64',
        updatedAt: 3,
      },
    ]);
    await expect(
      createCoffeeBeanSharePackage(
        [{ id: 'bean-3', timestamp: 3, name: 'Invalid' }],
        ['bean-3']
      )
    ).rejects.toThrow(/Invalid image Data URL/);

    const missingImage = await makePackage({
      type: 'brew-guide/coffee-beans-package',
      version: 2,
      exportedAt: '2026-09-26T00:00:00.000Z',
      beans: [
        {
          name: 'Incomplete',
          image: {
            kind: 'file',
            path: 'images/missing.png',
            mimeType: 'image/png',
          },
        },
      ],
    });
    await expect(readCoffeeBeanSharePackage(missingImage)).rejects.toThrow(
      '压缩包缺少清单中引用的图片文件'
    );
  });

  it('rejects credential-bearing external references without exposing them', async () => {
    const url = 'https://user:secret@example.com/image.jpg?token=fake-secret';
    const file = await makePackage({
      type: 'brew-guide/coffee-beans-package',
      version: 2,
      exportedAt: '2026-09-26T00:00:00.000Z',
      beans: [{ name: 'Private', image: { kind: 'external', url } }],
    });

    let errorMessage = '';
    try {
      await readCoffeeBeanSharePackage(file);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    expect(errorMessage).toMatch(/credentials are not allowed/);
    expect(errorMessage).not.toContain('secret');
    expect(errorMessage).not.toContain('token=');
    expect(errorMessage).not.toContain(url);
  });

  it.each([
    'blob:https://example.com/image',
    'file:///tmp/image.jpg',
    'content://provider/image.jpg',
    'capacitor://localhost/image.jpg',
    'javascript:alert(1)',
    'ftp://example.com/image.jpg',
    'relative/image.jpg',
    'data:image/png,not-base64',
    'data:text/plain;base64,SGVsbG8=',
    'aGVsbG8=',
  ])('rejects unsupported image source %s during export', async image => {
    getRecordsMock.mockResolvedValue([
      { beanId: 'bean-unsupported', image, updatedAt: 7 },
    ]);
    await expect(
      createCoffeeBeanSharePackage(
        [{ id: 'bean-unsupported', timestamp: 7, name: 'Unsupported' }],
        ['bean-unsupported']
      )
    ).rejects.toThrow();
  });

  it.each(['application/octet-stream', 'text/plain'])(
    'rejects v2 non-image manifest MIME %s without sniffing bytes',
    async mimeType => {
      const file = await makePackage(
        v2Manifest([
          {
            name: 'Invalid MIME',
            image: {
              kind: 'file',
              path: 'images/image.bin',
              mimeType,
            },
          },
        ]),
        { 'images/image.bin': new Uint8Array([0xff, 0xd8, 0xff, 1]) }
      );
      await expect(readCoffeeBeanSharePackage(file)).rejects.toThrow(
        'Invalid image MIME type'
      );
    }
  );

  it('keeps v2 manifest MIME authoritative instead of sniffing embedded bytes', async () => {
    const file = await makePackage(
      v2Manifest([
        {
          name: 'Manifest authority',
          image: {
            kind: 'file',
            path: 'images/image.bin',
            mimeType: 'image/png',
          },
        },
      ]),
      { 'images/image.bin': new TextEncoder().encode('GIF89a') }
    );

    const imported = await readCoffeeBeanSharePackage(file);
    expect(imported[0].image).toBe('data:image/png;base64,R0lGODlh');
  });

  it.each([
    { kind: 'file' },
    { kind: 'file', path: 'images/front.bin' },
    { kind: 'external' },
    { kind: 'future', url: 'https://example.com/image.jpg' },
    {
      kind: 'external',
      url: 'https://example.com/image.jpg',
      path: 'images/front.bin',
    },
  ])('rejects malformed v2 image source descriptors', async image => {
    const file = await makePackage(v2Manifest([{ name: 'Malformed', image }]), {
      'images/front.bin': new Uint8Array([1, 2, 3]),
    });
    await expect(readCoffeeBeanSharePackage(file)).rejects.toThrow();
  });

  it.each([
    '../image.jpg',
    '/foo.jpg',
    '..\\image.jpg',
    'images/../image.jpg',
    'images\\..\\image.jpg',
  ])('rejects unsafe v2 embedded archive path %s', async path => {
    const file = await makePackage(
      v2Manifest([
        {
          name: 'Unsafe path',
          image: { kind: 'file', path, mimeType: 'image/jpeg' },
        },
      ])
    );
    await expect(readCoffeeBeanSharePackage(file)).rejects.toThrow(
      '压缩包中的图片路径无效'
    );
  });

  it('rejects duplicate v2 embedded paths rather than aliasing front and back', async () => {
    const file = await makePackage(
      v2Manifest([
        {
          name: 'Duplicate path',
          image: {
            kind: 'file',
            path: 'images/shared.png',
            mimeType: 'image/png',
          },
          backImage: {
            kind: 'file',
            path: 'images/shared.png',
            mimeType: 'image/png',
          },
        },
      ]),
      { 'images/shared.png': new Uint8Array([1, 2, 3]) }
    );
    await expect(readCoffeeBeanSharePackage(file)).rejects.toThrow(
      '压缩包中的图片文件路径重复'
    );
  });

  it('rejects unsupported future share package versions', async () => {
    const file = await makePackage({
      type: 'brew-guide/coffee-beans-package',
      version: 3,
      exportedAt: '2026-09-26T00:00:00.000Z',
      beans: [{ name: 'Future' }],
    });
    await expect(readCoffeeBeanSharePackage(file)).rejects.toThrow(
      '压缩包格式不受支持'
    );
  });
});
