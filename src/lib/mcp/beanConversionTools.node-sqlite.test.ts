import {
  getAppSettings,
  saveAppSettings,
} from '@/lib/data/sqlite/repositories/appSettings';
import type { AppSettings } from '@/lib/data/models';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import {
  getCoffeeBean,
  listCoffeeBeans,
  saveCoffeeBean,
} from '@/lib/data/sqlite/repositories/coffeeBean';
import {
  getBrewingNote,
  listBrewingNotes,
  saveBrewingNote,
} from '@/lib/data/sqlite/repositories/brewingNote';
import {
  beanConversionDefinitions,
  readBeanConversionTool,
  mutateBeanConversionTool,
} from './beanConversionTools';
import { validate } from './validation';

describe('Historical roasted-to-green migration (real SQLite)', () => {
  let db: NodeSqliteTestDatabase;
  beforeEach(async () => {
    db = await createNodeSqliteTestDatabase();
    await saveCoffeeBean(db.driver, {
      id: 'old',
      name: '历史豆',
      beanState: 'roasted',
      capacity: '100',
      remaining: '60',
      price: '200',
      roastDate: '2026-10-01',
      timestamp: 1,
    });
    await saveBrewingNote(db.driver, {
      id: 'brew',
      rating: 0,
      taste: {},
      beanId: 'old',
      timestamp: 2,
      params: { coffee: '10g' },
      notes: '保留手冲',
    });
    await saveBrewingNote(db.driver, {
      id: 'quick',
      rating: 0,
      taste: {},
      notes: '',
      beanId: 'old',
      timestamp: 3,
      source: 'quick-decrement',
      quickDecrementAmount: 30,
    });
    await db.driver.execute(
      "INSERT INTO coffee_bean_images(image_id,bean_id,slot,variant,source_kind,relative_path,mime_type,size_bytes) VALUES ('front','old','front','original','file','images/v1/objects/beanphoto','image/png',10)"
    );
    await db.driver.execute(
      "INSERT INTO brewing_note_images(image_id,note_id,position,variant,source_kind,relative_path,mime_type,size_bytes) VALUES ('brewphoto','brew',0,'original','file','images/v1/objects/brewphoto','image/png',10),('quickphoto','quick',0,'original','file','images/v1/objects/quickphoto','image/png',10)"
    );
  });
  afterEach(async () => {
    await db.close();
  });
  const preview = (extra: Record<string, unknown> = {}) =>
    readBeanConversionTool(db.driver, 'preview_convert_roasted_to_green', {
      id: 'old',
      ...extra,
    });
  async function convert(
    p?: Record<string, unknown>,
    extra: Record<string, unknown> = {}
  ) {
    p ??= await preview();
    const args = {
      requestId: 'migration-request',
      id: 'old',
      expectedVersion: p.version,
      confirmationToken: p.confirmationToken,
      confirmAction: 'convert_roasted_to_green',
      ...extra,
    };
    validate(args, beanConversionDefinitions[1].schema);
    return db.driver.transaction(tx =>
      mutateBeanConversionTool(tx, 'convert_roasted_to_green', args)
    );
  }
  const snapshot = async () => ({
    settings: await getAppSettings(db.driver),
    beans: await listCoffeeBeans(db.driver),
    notes: await listBrewingNotes(db.driver),
    beanImages: await db.driver.query(
      'SELECT * FROM coffee_bean_images ORDER BY image_id'
    ),
    noteImages: await db.driver.query(
      'SELECT * FROM brewing_note_images ORDER BY image_id'
    ),
  });
  it('previews complete effects and converts stock, ordinary history, lineage and photos atomically', async () => {
    const p = await preview();
    expect(p.impact).toMatchObject({
      roastedInputGrams: 40,
      roastedRemainingGrams: 30,
      deletedRecordIds: ['quick'],
      migratedNoteIds: ['brew'],
    });
    const result = await convert(p);
    const green = result.result.greenBean as { id: string };
    const roasted = result.result.newRoastedBean as { id: string };
    expect(await getCoffeeBean(db.driver, 'old')).toBeUndefined();
    expect(await getCoffeeBean(db.driver, green.id)).toMatchObject({
      beanState: 'green',
      capacity: '100',
      remaining: '60',
      purchaseDate: '2026-10-01',
      price: '200',
    });
    expect(await getCoffeeBean(db.driver, roasted.id)).toMatchObject({
      beanState: 'roasted',
      capacity: '40',
      remaining: '30',
      sourceGreenBeanId: green.id,
      price: '80.00',
    });
    expect(await getBrewingNote(db.driver, 'brew')).toMatchObject({
      beanId: roasted.id,
      notes: '保留手冲',
      params: { coffee: '10g' },
    });
    expect(await getBrewingNote(db.driver, 'quick')).toBeUndefined();
    expect(result.result.roastingNote).toMatchObject({
      source: 'roasting',
      notes: '从熟豆转换：烘焙了 40g 生豆 → 历史豆',
      changeRecord: {
        roastingRecord: {
          greenBeanId: green.id,
          roastedBeanId: roasted.id,
          roastedAmount: 40,
        },
      },
    });
    const images = await db.driver.query(
      'SELECT bean_id,relative_path FROM coffee_bean_images'
    );
    expect(images).toHaveLength(2);
    expect(
      images.every(i => i.relative_path === 'images/v1/objects/beanphoto')
    ).toBe(true);
    expect(
      await db.driver.query('SELECT image_id FROM brewing_note_images')
    ).toEqual([{ image_id: 'brewphoto' }]);
    expect(result.cleanupPaths).toEqual(['images/v1/objects/quickphoto']);
  });
  it('discloses canonical metadata fields not carried to replacement beans', async () => {
    const bean = (await getCoffeeBean(db.driver, 'old'))!;
    await saveCoffeeBean(db.driver, {
      ...bean,
      overallRating: 4.5,
      isFrozen: true,
    });
    expect((await preview()).impact).toMatchObject({
      discardedMetadataFields: ['isFrozen', 'overallRating'],
    });
  });
  const settingsWithGroup = async (beanIds = ['other', 'old', 'last']) =>
    saveAppSettings(db.driver, {
      textZoomLevel: 1,
      syncSettings: { secret: 'never-emit' },
      coffeeBeanGroups: [
        { id: 'group', name: 'Group', beanIds, createdAt: 1, updatedAt: 1 },
      ],
    } as unknown as AppSettings);
  it.each(['green', 'roasted', 'remove'])(
    'explicit %s group policy preserves order and unrelated settings',
    async policy => {
      await settingsWithGroup();
      const p = await preview({ groupMigration: policy });
      const r = await convert(p, { groupMigration: policy });
      const target =
        policy === 'green'
          ? (r.result.greenBean as { id: string }).id
          : policy === 'roasted'
            ? (r.result.newRoastedBean as { id: string }).id
            : undefined;
      const settings = (await getAppSettings(db.driver))!;
      expect(settings.coffeeBeanGroups?.[0].beanIds).toEqual(
        target ? ['other', target, 'last'] : ['other', 'last']
      );
      expect(JSON.stringify(settings)).toContain('never-emit');
      expect(JSON.stringify(r)).not.toContain('never-emit');
    }
  );
  it('requires group placement matching the preview and conflicts on membership changes', async () => {
    await settingsWithGroup();
    const p = await preview({ groupMigration: 'green' });
    await expect(
      convert(p, { groupMigration: 'roasted' })
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
    await expect(convert(await preview())).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
    });
    await settingsWithGroup(['other']);
    await expect(convert(p, { groupMigration: 'green' })).rejects.toMatchObject(
      { code: 'CONFLICT' }
    );
    const ungrouped = await preview();
    await settingsWithGroup();
    await expect(convert(ungrouped)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
  it('retains unrelated settings edits after preview and rejects nonexistent roasted placement', async () => {
    await settingsWithGroup();
    const p = await preview({ groupMigration: 'green' });
    const current = (await getAppSettings(db.driver))!;
    await saveAppSettings(db.driver, { ...current, textZoomLevel: 2 });
    await convert(p, { groupMigration: 'green' });
    expect((await getAppSettings(db.driver))?.textZoomLevel).toBe(2);
  });
  it('cannot place an unused direct conversion in a nonexistent roasted output', async () => {
    await db.driver.execute('DELETE FROM brewing_notes');
    await db.driver.execute('DELETE FROM brewing_note_images');
    const b = (await getCoffeeBean(db.driver, 'old'))!;
    await saveCoffeeBean(db.driver, { ...b, remaining: '100' });
    await settingsWithGroup();
    await expect(
      convert(await preview({ groupMigration: 'roasted' }), {
        groupMigration: 'roasted',
      })
    ).rejects.toThrow();
    expect(
      (await getAppSettings(db.driver))?.coffeeBeanGroups?.[0].beanIds
    ).toContain('old');
  });
  it('supports unused direct conversion without fabricating roast output', async () => {
    await db.driver.execute('DELETE FROM brewing_notes');
    await db.driver.execute('DELETE FROM brewing_note_images');
    const bean = (await getCoffeeBean(db.driver, 'old'))!;
    await saveCoffeeBean(db.driver, { ...bean, remaining: '100' });
    const r = await convert();
    expect(r.result.newRoastedBean).toBeNull();
    expect(r.result.roastingNote).toBeNull();
    expect(await listCoffeeBeans(db.driver)).toHaveLength(1);
  });
  it('invalidates preview on later consumption, even if bean version itself is unchanged', async () => {
    const p = await preview();
    const n = (await getBrewingNote(db.driver, 'brew'))!;
    await saveBrewingNote(db.driver, { ...n, params: { coffee: '11g' } });
    const before = await snapshot();
    await expect(convert(p)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await snapshot()).toEqual(before);
  });
  it('invalidates preview on image-only edits', async () => {
    const p = await preview();
    await db.driver.execute(
      "UPDATE brewing_note_images SET size_bytes=11 WHERE image_id='brewphoto'"
    );
    const before = await snapshot();
    await expect(convert(p)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await snapshot()).toEqual(before);
  });
  it('rejects linked provenance, dependent lineage and cross-linked roasting records', async () => {
    const b = (await getCoffeeBean(db.driver, 'old'))!;
    await saveCoffeeBean(db.driver, { ...b, sourceGreenBeanId: 'origin' });
    await expect(preview()).rejects.toThrow();
    await saveCoffeeBean(db.driver, b);
    await saveCoffeeBean(db.driver, {
      id: 'child',
      name: 'child',
      sourceGreenBeanId: 'old',
      timestamp: 1,
    });
    await expect(preview()).rejects.toThrow();
    await db.driver.execute("DELETE FROM coffee_beans WHERE id='child'");
    await saveBrewingNote(db.driver, {
      id: 'roast',
      rating: 0,
      taste: {},
      notes: '',
      timestamp: 1,
      source: 'roasting',
      changeRecord: {
        roastingRecord: {
          greenBeanId: 'elsewhere',
          greenBeanName: 'elsewhere',
          roastedBeanId: 'old',
          roastedAmount: 40,
        },
      },
    });
    await expect(preview()).rejects.toThrow();
  });
  it('rejects contradictory usage and ambiguous amounts without mutations', async () => {
    const n = (await getBrewingNote(db.driver, 'brew'))!;
    await saveBrewingNote(db.driver, { ...n, params: { coffee: '50g' } });
    const before = await snapshot();
    await expect(preview()).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
    await saveBrewingNote(db.driver, { ...n, params: { coffee: 'about 10' } });
    await expect(preview()).rejects.toThrow();
  });
  it('rejects missing explicit confirmation', async () => {
    const p = await preview();
    await expect(
      db.driver.transaction(tx =>
        mutateBeanConversionTool(tx, 'convert_roasted_to_green', {
          id: 'old',
          expectedVersion: p.version,
          confirmationToken: p.confirmationToken,
        })
      )
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
    expect(await getCoffeeBean(db.driver, 'old')).not.toBeNull();
  });
  it('rolls back created beans, moved notes and deleted photo metadata if final write fails', async () => {
    await settingsWithGroup();
    const p = await preview({ groupMigration: 'green' }),
      before = await snapshot();
    await expect(
      db.driver.transaction(tx =>
        mutateBeanConversionTool(
          {
            query: tx.query.bind(tx),
            execute: async (sql, values) => {
              if (sql === 'DELETE FROM coffee_beans WHERE id = ?')
                throw new Error('injected');
              return tx.execute(sql, values);
            },
          },
          'convert_roasted_to_green',
          {
            requestId: 'rollback-request',
            groupMigration: 'green',
            id: 'old',
            expectedVersion: p.version,
            confirmationToken: p.confirmationToken,
            confirmAction: 'convert_roasted_to_green',
          }
        )
      )
    ).rejects.toThrow('injected');
    expect(await snapshot()).toEqual(before);
  });
});
