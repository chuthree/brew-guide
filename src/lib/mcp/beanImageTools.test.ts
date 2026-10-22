import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import { encodeImageDataUrl } from '@/lib/data/images/imageBinary';
import { BEAN_IMAGE_COMPRESSION_OPTIONS } from '@/lib/images/imageProcessing';
import { createSqliteCoffeeBeanRepository } from '@/lib/data/sqlite/repositories/coffeeBean';
import { listCoffeeBeanImageMetadata } from '@/lib/data/sqlite/imageMetadataExecutor';
import {
  cleanupPreparedCoffeeBeanImageFiles,
  type PreparedCoffeeBeanImageWrite,
} from '@/lib/data/sqlite/persistence/coffeeBeanImagePersistence';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import {
  getMcpBeanImageInfo,
  prepareMcpBeanImageMutation,
  validateMcpBeanImageDataUrl,
  MCP_BEAN_IMAGE_MAX_DATA_URL_LENGTH,
} from './beanImageTools';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const OTHER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/hS0AAAAASUVORK5CYII=';
const bean = {
  id: 'image-bean',
  name: 'Image fixture',
  timestamp: 1,
  capacity: '125',
  remaining: '125',
} as CoffeeBean;
class Files implements NativeImageFileStore {
  objects = new Map<string, Uint8Array>();
  write = vi.fn(async (key: string, bytes: Uint8Array) => {
    if (this.objects.has(key)) throw new Error('collision');
    this.objects.set(key, bytes.slice());
  });
  read = vi.fn(async (key: string) => {
    const value = this.objects.get(key);
    if (!value) throw new Error('missing');
    return value.slice();
  });
  delete = vi.fn(async (key: string) => {
    this.objects.delete(key);
  });
  exists = vi.fn(async (key: string) => this.objects.has(key));
  listObjectKeys = vi.fn(async () => [...this.objects.keys()]);
}

describe('MCP image envelope validation before browser decode', () => {
  it.each([
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAADAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDi6KKK+ZP3E//Z',
    'data:image/webp;base64,UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoCAAMAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=',
    'data:image/webp;base64,UklGRhwAAABXRUJQVlA4TA8AAAAvAYAAAAcQ/Y/+ByKi/wEA',
  ])('recognizes bounded JPEG and lossy/lossless WebP dimensions', input => {
    expect(validateMcpBeanImageDataUrl(input)).toMatchObject({
      width: 2,
      height: 3,
    });
  });

  it('accepts a correctly identified bounded raster', () => {
    expect(validateMcpBeanImageDataUrl(PNG)).toMatchObject({
      width: 1,
      height: 1,
      mimeType: 'image/png',
    });
  });
  it.each([
    'https://example.com/image.png',
    'file:///private/photo.png',
    '/tmp/photo.png',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/gif;base64,R0lGODlh',
    'data:image/png;base64,AQID',
    PNG.replace('image/png', 'image/jpeg'),
    PNG + '!',
  ])('rejects unsupported or malformed input without reflecting it', input => {
    expect(() => validateMcpBeanImageDataUrl(input)).toThrow();
    try {
      validateMcpBeanImageDataUrl(input);
    } catch (error) {
      expect(String(error)).not.toContain(input);
    }
  });
  it('rejects an oversized envelope before decoding and oversized dimensions', () => {
    expect(() =>
      validateMcpBeanImageDataUrl(
        'x'.repeat(MCP_BEAN_IMAGE_MAX_DATA_URL_LENGTH + 1)
      )
    ).toThrow();
    const image = validateMcpBeanImageDataUrl(PNG);
    const bytes = image.bytes.slice();
    new DataView(bytes.buffer).setUint32(16, 65535);
    expect(() =>
      validateMcpBeanImageDataUrl(
        encodeImageDataUrl({ mimeType: 'image/png', bytes })
      )
    ).toThrow();
  });
});

(supportsNodeSqlite() ? describe : describe.skip)(
  'MCP image prepared writes on real SQLite',
  () => {
    let db: NodeSqliteTestDatabase;
    let files: Files;
    let seq = 0;
    const process = vi.fn(async (file: File) =>
      encodeImageDataUrl({
        mimeType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })
    );
    const dependencies = () => ({
      fileStore: files,
      process,
      persistence: {
        objectKeyFactory: () => `mcp-image-${++seq}`,
        imageIdFactory: () => `image-${++seq}`,
        thumbnailGenerator: async () => OTHER,
      },
    });
    beforeEach(async () => {
      db = await createNodeSqliteTestDatabase();
      files = new Files();
      process.mockClear();
      await createSqliteCoffeeBeanRepository(db.driver).save(bean);
    });
    afterEach(async () => {
      await db.close();
    });
    const save = async (side: 'front' | 'back', image: string | null) =>
      db.driver.transaction(async tx => {
        const plan = await prepareMcpBeanImageMutation(
          tx,
          bean,
          side,
          image,
          dependencies()
        );
        await plan.apply(tx);
        return plan;
      });
    it('uses shared compression, stores only metadata/clean bean and exposes no paths or bytes', async () => {
      await save('front', PNG);
      expect(process).toHaveBeenCalledWith(expect.any(File), {
        maxFileSizeBytes: 8 * 1024 * 1024,
        compression: BEAN_IMAGE_COMPRESSION_OPTIONS,
      });
      expect(await getMcpBeanImageInfo(db.driver, bean.id)).toEqual([
        {
          imageId: expect.any(String),
          side: 'front',
          source: 'file',
          mimeType: 'image/png',
          sizeBytes: validateMcpBeanImageDataUrl(PNG).bytes.length,
          hasThumbnail: true,
        },
      ]);
      expect(
        await createSqliteCoffeeBeanRepository(db.driver).get(bean.id)
      ).not.toHaveProperty('image');
      expect(files.objects.size).toBe(2);
    });
    it('prepares file objects without SQL writes, then removes new objects after SQL rollback', async () => {
      let plan: PreparedCoffeeBeanImageWrite | undefined;
      await expect(
        db.driver.transaction(async tx => {
          plan = await prepareMcpBeanImageMutation(
            tx,
            bean,
            'front',
            PNG,
            dependencies()
          );
          expect(await listCoffeeBeanImageMetadata(tx, bean.id)).toEqual([]);
          await plan.apply(tx);
          throw new Error('rollback');
        })
      ).rejects.toThrow('rollback');
      expect(await getMcpBeanImageInfo(db.driver, bean.id)).toEqual([]);
      await cleanupPreparedCoffeeBeanImageFiles(
        db.driver,
        files,
        plan!.created.map(item => item.relativePath)
      );
      expect(files.objects.size).toBe(0);
    });
    it('retains superseded files until commit and preserves the opposite side', async () => {
      await save('front', PNG);
      await save('back', PNG);
      const before = await listCoffeeBeanImageMetadata(db.driver, bean.id);
      const replacement = await save('front', OTHER);
      expect(files.objects.size).toBeGreaterThan(4);
      const back = (
        await listCoffeeBeanImageMetadata(db.driver, bean.id)
      ).filter(row => row.slot === 'back');
      expect(back).toEqual(before.filter(row => row.slot === 'back'));
      await cleanupPreparedCoffeeBeanImageFiles(
        db.driver,
        files,
        replacement.supersededPaths
      );
      expect(files.objects.size).toBe(4);
      const deletion = await save('front', null);
      expect(files.objects.size).toBe(4);
      await cleanupPreparedCoffeeBeanImageFiles(
        db.driver,
        files,
        deletion.supersededPaths
      );
      expect(files.objects.size).toBe(2);
      expect(
        (await getMcpBeanImageInfo(db.driver, bean.id)).map(row => row.side)
      ).toEqual(['back']);
    });
    it('keeps old metadata and files on replacement rollback; cleanup never removes referenced objects', async () => {
      const first = await save('front', PNG);
      let plan: PreparedCoffeeBeanImageWrite | undefined;
      const before = await listCoffeeBeanImageMetadata(db.driver, bean.id);
      await expect(
        db.driver.transaction(async tx => {
          plan = await prepareMcpBeanImageMutation(
            tx,
            bean,
            'front',
            OTHER,
            dependencies()
          );
          await plan.apply(tx);
          throw new Error('rollback');
        })
      ).rejects.toThrow();
      await cleanupPreparedCoffeeBeanImageFiles(
        db.driver,
        files,
        [...plan!.created, ...first.created].map(item => item.relativePath)
      );
      expect(await listCoffeeBeanImageMetadata(db.driver, bean.id)).toEqual(
        before
      );
      expect(files.objects.size).toBe(2);
    });
    it('retains uncertain rollback files rather than deleting possibly committed originals', async () => {
      let plan: PreparedCoffeeBeanImageWrite | undefined;
      await db.driver.transaction(async tx => {
        plan = await prepareMcpBeanImageMutation(
          tx,
          bean,
          'front',
          PNG,
          dependencies()
        );
      });
      await cleanupPreparedCoffeeBeanImageFiles(
        db.driver,
        files,
        plan!.created.map(item => item.relativePath),
        Object.assign(new Error('uncertain'), { rollbackDiagnostic: true })
      );
      expect(files.objects.size).toBe(2);
    });
    it('rejects failed decode/compression before file writes and never logs image data', async () => {
      await expect(
        prepareMcpBeanImageMutation(db.driver, bean, 'front', PNG, {
          ...dependencies(),
          process: async () => {
            throw new Error(PNG);
          },
        })
      ).rejects.toThrow('Image decoding or compression failed');
      expect(files.write).not.toHaveBeenCalled();
    });
    it('never accepts header-only input without the actual browser processor', async () => {
      const log = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        await expect(
          prepareMcpBeanImageMutation(db.driver, bean, 'front', PNG, {
            fileStore: files,
          })
        ).rejects.toThrow('Image decoding or compression failed');
        expect(files.write).not.toHaveBeenCalled();
      } finally {
        log.mockRestore();
      }
    });
    it('mandatory object write failure leaves original state and metadata untouched', async () => {
      await save('front', PNG);
      const before = await listCoffeeBeanImageMetadata(db.driver, bean.id);
      files.write.mockRejectedValueOnce(new Error('disk unavailable'));
      await expect(
        db.driver.transaction(async tx => {
          const plan = await prepareMcpBeanImageMutation(
            tx,
            bean,
            'front',
            OTHER,
            dependencies()
          );
          await plan.apply(tx);
        })
      ).rejects.toThrow('Image storage preparation failed');
      expect(await listCoffeeBeanImageMetadata(db.driver, bean.id)).toEqual(
        before
      );
      expect(files.objects.size).toBe(2);
    });
  }
);
