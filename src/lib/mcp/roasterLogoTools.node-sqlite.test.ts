import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import {
  getAppSettings,
  saveAppSettings,
} from '@/lib/data/sqlite/repositories/appSettings';
import type { AppSettings } from '@/lib/data/models';
import { ROASTER_LOGO_COMPRESSION_OPTIONS } from '@/lib/images/imageProcessing';
import { readRoasterLogoTool, mutateRoasterLogoTool } from './roasterLogoTools';
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
let db: NodeSqliteTestDatabase;
const process = vi.fn(async () => png);
const read = (name = 'get_roaster_logo', roasterName = 'R') =>
  readRoasterLogoTool(db.driver, name, { roasterName });
const mutate = (args: Record<string, unknown>, name = 'set_roaster_logo') =>
  db.driver.transaction(tx =>
    mutateRoasterLogoTool(
      tx,
      name,
      { requestId: 'logo-test-request', roasterName: 'R', ...args },
      { process }
    )
  );
describe('MCP roaster logos (real SQLite)', () => {
  beforeEach(async () => {
    process.mockClear();
    db = await createNodeSqliteTestDatabase();
    await saveAppSettings(db.driver, {
      roasterConfigs: [
        {
          roasterName: 'R',
          flavorPeriod: {
            light: { startDay: 1, endDay: 10 },
            medium: { startDay: 2, endDay: 9 },
            dark: { startDay: 3, endDay: 8 },
          },
          updatedAt: 1,
        },
      ],
      syncSettings: { secret: 'never-leak' },
    } as unknown as AppSettings);
  });
  afterEach(async () => db.close());
  it('creates and replaces using canonical compression, safe metadata and preserved settings', async () => {
    const original = (await getAppSettings(db.driver))!;
    const before = await read();
    expect(before.hasLogo).toBe(false);
    const result = await mutate({
      expectedVersion: before.version,
      image: png,
    });
    expect(result.result.hasLogo).toBe(true);
    expect(result.result.mimeType).toBe('image/png');
    expect(process.mock.calls[0]).toEqual([
      expect.any(File),
      {
        maxFileSizeBytes: 8 * 1024 * 1024,
        compression: ROASTER_LOGO_COMPRESSION_OPTIONS,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('base64');
    expect(JSON.stringify(result)).not.toContain('never-leak');
    const stored = (await getAppSettings(db.driver))!;
    expect(stored.roasterConfigs![0].logoData).toBe(png);
    expect(stored.roasterConfigs![0].flavorPeriod).toEqual(
      original.roasterConfigs![0].flavorPeriod
    );
    expect(JSON.stringify(stored)).toContain('never-leak');
    await mutate({ expectedVersion: result.result.version, image: png });
    expect(process).toHaveBeenCalledTimes(2);
  });
  it('can create a logo-only configuration for a new roaster', async () => {
    const before = await read('get_roaster_logo', 'New');
    await mutate({
      roasterName: 'New',
      expectedVersion: before.version,
      image: png,
    });
    expect((await getAppSettings(db.driver))!.roasterConfigs).toHaveLength(2);
  });
  it('requires matching preview for deletion and retains taste windows', async () => {
    await mutate({ expectedVersion: (await read()).version, image: png });
    const before = (await getAppSettings(db.driver))!;
    const preview = await read('preview_delete_roaster_logo');
    await expect(
      mutate(
        { expectedVersion: preview.version, confirmationToken: 'a'.repeat(64) },
        'delete_roaster_logo'
      )
    ).rejects.toThrow('preview');
    const removed = await mutate(
      {
        expectedVersion: preview.version,
        confirmationToken: preview.confirmationToken,
      },
      'delete_roaster_logo'
    );
    expect(removed.result.hasLogo).toBe(false);
    const after = (await getAppSettings(db.driver))!;
    expect(after.roasterConfigs![0].logoData).toBeUndefined();
    expect(after.roasterConfigs![0].flavorPeriod).toEqual(
      before.roasterConfigs![0].flavorPeriod
    );
  });
  it('detects logo-only UI changes even when updatedAt is unchanged', async () => {
    const before = await read();
    const settings = (await getAppSettings(db.driver))!;
    settings.roasterConfigs![0].logoData = png;
    await saveAppSettings(db.driver, settings);
    await expect(
      mutate({ expectedVersion: before.version, image: png })
    ).rejects.toThrow('changed');
    expect(process).not.toHaveBeenCalled();
  });
  it.each([
    'file:///tmp/private',
    'https://example.com/logo.png',
    'data:image/svg+xml;base64,PHN2Zz4=',
  ])('rejects unsafe source %s with no data changes', async image => {
    const before = (await getAppSettings(db.driver))!;
    await expect(
      mutate({ expectedVersion: (await read()).version, image })
    ).rejects.toThrow();
    expect(await getAppSettings(db.driver)).toEqual(before);
  });
  it('rolls back logo on transaction failure and never emits compression error details', async () => {
    const before = await read();
    await expect(
      db.driver.transaction(async tx => {
        await mutateRoasterLogoTool(
          tx,
          'set_roaster_logo',
          {
            requestId: 'rollback-logo-test',
            roasterName: 'R',
            expectedVersion: before.version,
            image: png,
          },
          { process }
        );
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');
    expect((await read()).hasLogo).toBe(false);
    process.mockRejectedValueOnce(new Error('/private/location secret'));
    await expect(
      mutate({ expectedVersion: before.version, image: png })
    ).rejects.toThrow('Image decoding or compression failed');
  });
  it('rejects oversized sources and compressed dimensions before saving', async () => {
    const before = await read();
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
    Buffer.from(png.split(',')[1], 'base64').copy(oversized);
    await expect(
      mutate({
        expectedVersion: before.version,
        image: 'data:image/png;base64,' + oversized.toString('base64'),
      })
    ).rejects.toThrow();
    expect(process).not.toHaveBeenCalled();
    const wide = Buffer.from(png.split(',')[1], 'base64');
    wide.writeUInt32BE(513, 16);
    process.mockResolvedValueOnce(
      'data:image/png;base64,' + wide.toString('base64')
    );
    await expect(
      mutate({ expectedVersion: before.version, image: png })
    ).rejects.toThrow('512px');
    expect((await read()).version).toBe(before.version);
  });
  it('rejects expired previews without removing the logo', async () => {
    await mutate({ expectedVersion: (await read()).version, image: png });
    const preview = await read('preview_delete_roaster_logo');
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 300001);
    try {
      await expect(
        mutate(
          {
            expectedVersion: preview.version,
            confirmationToken: preview.confirmationToken,
          },
          'delete_roaster_logo'
        )
      ).rejects.toThrow('preview');
    } finally {
      clock.mockRestore();
    }
    expect((await read()).hasLogo).toBe(true);
  });
  it('returns validated logo content only on explicit includeImage', async () => {
    await mutate({ expectedVersion: (await read()).version, image: png });
    const metadata = await read();
    expect(metadata).not.toHaveProperty('image');
    expect(JSON.stringify(metadata)).not.toContain('base64');
    const included = await readRoasterLogoTool(db.driver, 'get_roaster_logo', {
      roasterName: 'R',
      includeImage: true,
    });
    expect(included.imageStatus).toBe('available');
    expect(included.image).toEqual({
      dataUrl: png,
      mimeType: 'image/png',
      sizeBytes: Buffer.from(png.split(',')[1], 'base64').length,
      width: 1,
      height: 1,
    });
    expect(JSON.stringify(included)).not.toContain('never-leak');
  });
  it.each([
    'https://private.invalid/logo?secret=hidden',
    '/private/secret/image.png',
    'data:image/png;base64,broken',
    'data:image/png;base64,' + 'A'.repeat(12 * 1024 * 1024),
  ])('does not return unsupported legacy source content', async logoData => {
    const settings = (await getAppSettings(db.driver))!;
    settings.roasterConfigs![0].logoData = logoData;
    await saveAppSettings(db.driver, settings);
    const included = await readRoasterLogoTool(db.driver, 'get_roaster_logo', {
      roasterName: 'R',
      includeImage: true,
    });
    expect(included.imageStatus).toBe('unsupported_source');
    expect(included.image).toBeNull();
    expect(JSON.stringify(included)).not.toContain('secret');
    expect(JSON.stringify(included)).not.toContain('base64');
  });
  it('reports absent content without error when explicitly requested', async () => {
    const included = await readRoasterLogoTool(db.driver, 'get_roaster_logo', {
      roasterName: 'R',
      includeImage: true,
    });
    expect(included.imageStatus).toBe('absent');
    expect(included.image).toBeNull();
  });
  it.each(['gif', 'heic', 'heif', 'avif'])(
    'returns bounded legacy %s bytes only as an opaque resource',
    async mime => {
      const settings = (await getAppSettings(db.driver))!;
      settings.roasterConfigs![0].logoData = `data:image/${mime};base64,R0lGODlh`;
      await saveAppSettings(db.driver, settings);
      expect(JSON.stringify(await read())).not.toContain('R0lGODlh');
      const included = await readRoasterLogoTool(
        db.driver,
        'get_roaster_logo',
        { roasterName: 'R', includeImage: true }
      );
      expect(included.imageStatus).toBe('opaque');
      expect(included.image).toEqual({
        imageId: 'roaster-logo:R',
        mimeType: 'application/octet-stream',
        sourceMimeType: `image/${mime}`,
        sizeBytes: 6,
        blob: 'R0lGODlh',
      });
    }
  );
  it('accepts canonical PNG output above the soft byte target', async () => {
    // Valid ancillary PNG text chunk preserves the original 1x1 pixels and CRCs.
    const source = Buffer.from(png.split(',')[1], 'base64');
    const payload = Buffer.from('Comment\0' + 'x'.repeat(140000));
    const kindAndPayload = Buffer.concat([Buffer.from('tEXt'), payload]);
    let crc = 0xffffffff;
    for (const byte of kindAndPayload) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4);
    length.writeUInt32BE(payload.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    const largePng = Buffer.concat([
      source.subarray(0, -12),
      length,
      kindAndPayload,
      checksum,
      source.subarray(-12),
    ]);
    expect(largePng.length).toBeGreaterThan(0.12 * 1024 * 1024);
    process.mockResolvedValueOnce(
      'data:image/png;base64,' + largePng.toString('base64')
    );
    const result = await mutate({
      expectedVersion: (await read()).version,
      image: png,
    });
    expect(result.result.sizeBytes).toBe(largePng.length);
    expect(result.result.width).toBe(1);
    expect(result.result.hasLogo).toBe(true);
  });
});
