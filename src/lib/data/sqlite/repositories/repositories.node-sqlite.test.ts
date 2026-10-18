import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  AppSettingsRepository,
  CustomMethodRecord,
} from '@/lib/data/contracts';
import type { CustomEquipment, Method } from '@/lib/core/config';
import type { AppSettings, Grinder } from '@/lib/data/models';
import { createSqliteAppSettingsRepository } from './appSettings';
import { createSqliteCustomEquipmentRepository } from './customEquipment';
import { createSqliteCustomMethodRepository } from './customMethod';
import { createSqliteGrinderRepository } from './grinder';
import { createSqliteLegacySettingsRepository } from './legacySettings';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
  type NodeSqliteTestDatabase,
} from './testing/nodeSqliteTestDriver';

describe('node:sqlite runtime gate', () => {
  it.each([
    ['18.19.0', false],
    ['22.12.0', false],
    ['22.13.0', true],
    ['23.0.0', true],
    ['26.10.0', true],
  ])('checks Node %s as supported=%s', (version, supported) => {
    expect(supportsNodeSqlite(version)).toBe(supported);
  });
});

const describeNodeSqlite = supportsNodeSqlite() ? describe : describe.skip;
const nodeSqliteLabel = supportsNodeSqlite()
  ? `real SQLite (node:sqlite, Node ${process.versions.node})`
  : `SKIPPED: node:sqlite unavailable on Node ${process.versions.node}; requires Node >=22.13`;

describeNodeSqlite(`${nodeSqliteLabel} repository integration`, () => {
  let database: NodeSqliteTestDatabase | undefined;

  const getDatabase = (): NodeSqliteTestDatabase => {
    if (!database) throw new Error('Node SQLite test database is not open');
    return database;
  };

  beforeEach(async () => {
    database = await createNodeSqliteTestDatabase();
  });

  afterEach(async () => {
    await database?.close();
    database = undefined;
  });

  it('uses the real SQLite engine with the frozen v1 schema', async () => {
    const rows = await getDatabase().driver.query(
      'SELECT sqlite_version() AS version'
    );
    expect(typeof rows[0]?.version).toBe('string');
    expect(rows[0]?.version).toMatch(/^\d+\.\d+/);
  });

  describe('AppSettingsRepository', () => {
    let repository: AppSettingsRepository;

    beforeEach(() => {
      repository = createSqliteAppSettingsRepository(getDatabase().driver);
    });

    it('returns missing as undefined, saves/updates main, counts, and clears only its table', async () => {
      const settings = appSettings({ revision: 1 });
      expect(await repository.get()).toBeUndefined();
      expect(await repository.count()).toBe(0);

      await createSqliteLegacySettingsRepository(getDatabase().driver).set(
        'keep',
        'legacy'
      );
      await repository.save(settings);
      expect(await repository.get()).toEqual(settings);
      expect(await repository.count()).toBe(1);

      const replacement = appSettings({ revision: 2 });
      await repository.save(replacement);
      expect(await repository.get()).toEqual(replacement);
      expect(await repository.count()).toBe(1);

      await repository.clear();
      expect(await repository.get()).toBeUndefined();
      expect(await repository.count()).toBe(0);
      expect(
        await createSqliteLegacySettingsRepository(getDatabase().driver).get(
          'keep'
        )
      ).toBe('legacy');
    });

    it('reads only the fixed main row and counts unrelated valid rows without deleting them', async () => {
      await getDatabase().driver.execute(
        'INSERT INTO app_settings (id, data_json) VALUES (?, ?)',
        ['other', JSON.stringify({ other: true })]
      );

      expect(await repository.get()).toBeUndefined();
      expect(await repository.count()).toBe(1);

      const settings = appSettings({ after: 'main' });
      await repository.save(settings);
      expect(await repository.get()).toEqual(settings);
      expect(await repository.count()).toBe(2);
    });

    it('rejects a malformed persisted JSON snapshot instead of repairing it', async () => {
      await getDatabase().driver.execute(
        'INSERT INTO app_settings (id, data_json) VALUES (?, ?)',
        ['main', '{']
      );
      await expect(repository.get()).rejects.toThrow(/JSON|record/i);
    });
  });

  describe('LegacySettingsRepository', () => {
    it('preserves raw strings exactly, overwrites keys, and distinguishes missing from empty', async () => {
      const repository = createSqliteLegacySettingsRepository(
        getDatabase().driver
      );
      expect(await repository.get('missing')).toBeUndefined();

      const entries = [
        ['empty', ''],
        ['json', '[{"id":"custom-1"}]'],
        ['null', 'null'],
        ['boolean', 'true'],
        ['unicode', '咖啡 ☕️\n手冲'],
        ['marker', 'brewingNoteImagesMigrated'],
      ] as const;
      for (const [key, value] of entries) await repository.set(key, value);

      for (const [key, value] of entries) {
        expect(await repository.get(key)).toBe(value);
      }
      expect(await repository.get('empty')).toBe('');

      await repository.set('json', 'replacement');
      expect(await repository.get('json')).toBe('replacement');
      expect(await repository.count()).toBe(entries.length);

      await repository.delete('empty');
      expect(await repository.get('empty')).toBeUndefined();
      expect(await repository.count()).toBe(entries.length - 1);
    });

    it('deletes missing keys harmlessly and clears only legacy_settings', async () => {
      const repository = createSqliteLegacySettingsRepository(
        getDatabase().driver
      );
      await createSqliteAppSettingsRepository(getDatabase().driver).save(
        appSettings()
      );
      await repository.set('one', '1');
      await repository.delete('missing');
      expect(await repository.count()).toBe(1);

      await repository.clear();
      expect(await repository.count()).toBe(0);
      expect(
        await createSqliteAppSettingsRepository(getDatabase().driver).count()
      ).toBe(1);
    });
  });

  describe('GrinderRepository', () => {
    it('lists by id ascending, upserts complete snapshots, and preserves history/unknown fields', async () => {
      const repository = createSqliteGrinderRepository(getDatabase().driver);
      expect(await repository.list()).toEqual([]);
      await repository.upsertMany([
        grinder('z-last', 'Zeta'),
        grinder('a-first', 'Alpha'),
      ]);
      expect((await repository.list()).map(item => item.id)).toEqual([
        'a-first',
        'z-last',
      ]);

      const updated = grinder('a-first', 'Updated', {
        note: { future: ['preserved', 7] },
      });
      await repository.save(updated);
      const saved = await repository.list();
      expect(saved[0]).toEqual(updated);
      expect(saved[0]?.grindSizeHistory?.map(item => item.grindSize)).toEqual([
        '20',
        '18',
      ]);
      expect(await repository.count()).toBe(2);

      await repository.delete('missing');
      await repository.delete('z-last');
      expect((await repository.list()).map(item => item.id)).toEqual([
        'a-first',
      ]);
    });

    it('does not write an empty batch and preserves sequential partial upsert failure', async () => {
      const repository = createSqliteGrinderRepository(getDatabase().driver);
      await repository.upsertMany([]);
      expect(await repository.count()).toBe(0);

      const invalid = { id: 'middle', name: 42 } as unknown as Grinder;
      await expect(
        repository.upsertMany([
          grinder('first', 'First'),
          invalid,
          grinder('last', 'Last'),
        ])
      ).rejects.toThrow(/grinders|name/i);
      expect((await repository.list()).map(item => item.id)).toEqual(['first']);
    });

    it('clears before sequential replaceAll and does not roll back a later failure', async () => {
      const repository = createSqliteGrinderRepository(getDatabase().driver);
      await repository.upsertMany([
        grinder('old-a', 'Old A'),
        grinder('old-b', 'Old B'),
      ]);

      const invalid = { id: 'new-b', name: null } as unknown as Grinder;
      await expect(
        repository.replaceAll([
          grinder('new-a', 'New A'),
          invalid,
          grinder('new-c', 'New C'),
        ])
      ).rejects.toThrow(/grinders|name/i);
      expect((await repository.list()).map(item => item.id)).toEqual(['new-a']);

      await repository.clear();
      expect(await repository.count()).toBe(0);
    });

    it('replaces the grinder set successfully', async () => {
      const repository = createSqliteGrinderRepository(getDatabase().driver);
      await repository.save(grinder('old', 'Old'));
      await repository.replaceAll([
        grinder('z-new', 'Z New'),
        grinder('a-new', 'A New'),
      ]);
      expect((await repository.list()).map(item => item.id)).toEqual([
        'a-new',
        'z-new',
      ]);
      expect(await repository.count()).toBe(2);
    });

    it('rejects the complete list when any stored JSON row is corrupt', async () => {
      const repository = createSqliteGrinderRepository(getDatabase().driver);
      await repository.save(grinder('valid', 'Valid'));
      await getDatabase().driver.execute(
        'INSERT INTO grinders (id, record_json) VALUES (?, ?)',
        ['corrupt', '{']
      );
      await expect(repository.list()).rejects.toThrow(/JSON|record/i);
    });
  });

  describe('CustomEquipmentRepository', () => {
    it('gets and lists ordered complete equipment snapshots with exact SVG and animation data', async () => {
      const repository = createSqliteCustomEquipmentRepository(
        getDatabase().driver
      );
      expect(await repository.get('missing')).toBeUndefined();

      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg">\n  <text>手冲 &amp; coffee</text>\n</svg>';
      const late = equipment('z-late', 'Late', { customShapeSvg: svg });
      const early = equipment('a-early', 'Early', {
        customPourAnimations: [
          {
            id: 'animation',
            name: '流速',
            customAnimationSvg: svg,
            previewFrames: 2,
            frames: [
              { id: 'frame-1', svgData: '<svg>一</svg>' },
              { id: 'frame-2', svgData: '<svg>二</svg>' },
            ],
          },
        ],
        futureProperty: { exact: ['unknown', true] },
      });
      await repository.save(late);
      await repository.save(early);

      expect(await repository.get('a-early')).toEqual(early);
      expect((await repository.list()).map(item => item.id)).toEqual([
        'a-early',
        'z-late',
      ]);
      expect((await repository.list())[1]?.customShapeSvg).toBe(svg);
      expect(await repository.count()).toBe(2);

      await repository.save(equipment('a-early', 'Updated'));
      expect((await repository.get('a-early'))?.name).toBe('Updated');
    });

    it('preserves sequential bulk partial success and replaceAll clear/write failure semantics', async () => {
      const repository = createSqliteCustomEquipmentRepository(
        getDatabase().driver
      );
      await repository.upsertMany([]);
      const invalid = equipment('middle', 'Invalid', {}, false);
      await expect(
        repository.upsertMany([
          equipment('first', 'First'),
          invalid,
          equipment('last', 'Last'),
        ])
      ).rejects.toThrow(/isCustom/);
      expect((await repository.list()).map(item => item.id)).toEqual(['first']);

      await repository.upsertMany([
        equipment('old-a', 'Old A'),
        equipment('old-b', 'Old B'),
      ]);
      await expect(
        repository.replaceAll([
          equipment('new-a', 'New A'),
          equipment('new-b', 'Invalid', {}, false),
          equipment('new-c', 'New C'),
        ])
      ).rejects.toThrow(/isCustom/);
      expect((await repository.list()).map(item => item.id)).toEqual(['new-a']);
    });

    it('handles missing, duplicate, and empty deleteMany keys with one repository-level result', async () => {
      const repository = createSqliteCustomEquipmentRepository(
        getDatabase().driver
      );
      await repository.upsertMany([equipment('a', 'A'), equipment('b', 'B')]);
      await repository.deleteMany([]);
      await repository.deleteMany(['a', 'a', 'missing']);
      expect((await repository.list()).map(item => item.id)).toEqual(['b']);
      await repository.delete('missing');
      await repository.delete('b');
      expect(await repository.count()).toBe(0);

      await repository.replaceAll([equipment('c', 'C')]);
      expect((await repository.list()).map(item => item.id)).toEqual(['c']);
      await repository.clear();
      expect(await repository.count()).toBe(0);
    });
  });

  describe('CustomMethodRepository', () => {
    it('gets and lists methods by equipment id while retaining order, missing ids, and unknown top-level fields', async () => {
      const repository = createSqliteCustomMethodRepository(
        getDatabase().driver
      );
      expect(await repository.get('missing')).toBeUndefined();

      const late = customMethods('z-equipment', [
        method('second'),
        method('first', 'first-id'),
      ]);
      const early = customMethods('a-equipment', [method('legacy no id')], {
        futureTopLevel: { keep: 'exactly' },
      });
      await repository.save(late);
      await repository.save(early);

      expect(await repository.get('a-equipment')).toEqual(early);
      expect(
        (await repository.list()).map(record => record.equipmentId)
      ).toEqual(['a-equipment', 'z-equipment']);
      expect((await repository.get('z-equipment'))?.methods).toEqual(
        late.methods
      );
      expect(await repository.count()).toBe(2);

      await repository.save(customMethods('a-equipment', []));
      expect((await repository.get('a-equipment'))?.methods).toEqual([]);
    });

    it('preserves sequential partial upsert failure and deleteMany semantics', async () => {
      const repository = createSqliteCustomMethodRepository(
        getDatabase().driver
      );
      const invalid = {
        equipmentId: 'middle',
        methods: undefined,
      } as unknown as CustomMethodRecord;
      await expect(
        repository.upsertMany([
          customMethods('first', []),
          invalid,
          customMethods('last', []),
        ])
      ).rejects.toThrow(/methods/);
      expect(
        (await repository.list()).map(record => record.equipmentId)
      ).toEqual(['first']);

      await repository.upsertMany([
        customMethods('second', []),
        customMethods('third', []),
      ]);
      await repository.deleteMany([]);
      await repository.deleteMany(['second', 'second', 'missing']);
      expect(
        (await repository.list()).map(record => record.equipmentId)
      ).toEqual(['first', 'third']);

      await repository.delete('missing');
      await repository.delete('third');
      await repository.clear();
      expect(await repository.count()).toBe(0);
    });
  });

  it('queues custom equipment and method sync work behind a failed SQLite transaction', async () => {
    const driver = getDatabase().driver;
    const equipmentRepository = createSqliteCustomEquipmentRepository(driver);
    const methodRepository = createSqliteCustomMethodRepository(driver);
    const transactionError = new Error('simulated transaction failure');

    let releaseTransaction!: () => void;
    const transactionGate = new Promise<void>(resolve => {
      releaseTransaction = resolve;
    });
    let markTransactionStarted!: () => void;
    const transactionStarted = new Promise<void>(resolve => {
      markTransactionStarted = resolve;
    });

    const transaction = driver.transaction(async tx => {
      await tx.execute(
        'INSERT INTO app_settings (id, data_json) VALUES (?, ?)',
        ['main', '{}']
      );
      markTransactionStarted();
      await transactionGate;
      throw transactionError;
    });
    await transactionStarted;

    const syncOperations = Promise.allSettled([
      equipmentRepository.list(),
      equipmentRepository.upsertMany([equipment('sync-equipment', 'Sync')]),
      methodRepository.list(),
      methodRepository.upsertMany([
        customMethods('sync-equipment', [method('Sync method')]),
      ]),
    ]);

    releaseTransaction();
    await expect(transaction).rejects.toBe(transactionError);
    const outcomes = await syncOperations;

    expect(
      outcomes.map(outcome =>
        outcome.status === 'fulfilled' ? 'ok' : outcome.reason.message
      )
    ).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(await createSqliteAppSettingsRepository(driver).count()).toBe(0);
    expect(await equipmentRepository.get('sync-equipment')).toMatchObject({
      id: 'sync-equipment',
      name: 'Sync',
    });
    expect(await methodRepository.get('sync-equipment')).toMatchObject({
      equipmentId: 'sync-equipment',
      methods: [{ name: 'Sync method' }],
    });
  });
});

function appSettings(extra: Record<string, unknown> = {}): AppSettings {
  return {
    notificationSound: true,
    hapticFeedback: false,
    textZoomLevel: 1,
    showFlowRate: true,
    username: '咖啡用户',
    decrementPresets: [1, 2, 5],
    enableAllDecrementOption: false,
    enableCustomDecrementInput: true,
    greenBeanRoastPresets: [10, 20],
    enableAllGreenBeanRoastOption: false,
    enableCustomGreenBeanRoastInput: true,
    simplifiedViewLabels: false,
    dateDisplayMode: 'date',
    showFlavorInfo: true,
    showBeanNotes: true,
    showNoteContent: true,
    limitNotesLines: false,
    notesMaxLines: 3,
    showPrice: true,
    showTotalPrice: false,
    showStatusDots: true,
    showBeanSummary: true,
    showEstimatedCups: false,
    estimatedCupDoseSettings: { enabled: true, dosePerCup: 15 },
    enableBeanSummaryCapacityLimit: false,
    beanSummaryMaxDisplayCapacity: 5,
    enableBeanSummaryOverflowWrap: true,
    showBeanReadyReminderPopup: false,
    showFlavorRatingInForm: true,
    showOverallRatingInForm: true,
    flavorRatingFollowOverall: false,
    flavorRatingHalfStep: true,
    flavorRatingTenthStep: false,
    overallRatingUseSlider: true,
    showRatingDimensionsEntry: true,
    showUnitPriceInNote: false,
    showBeanAgingDaysInNote: true,
    showFlavorInNote: true,
    showNoteTimeInNote: true,
    showCapacityAdjustmentRecords: true,
    roasterConfigs: [
      {
        roasterName: '示例烘焙商',
        logoData: 'data:image/png;base64,AA==',
        updatedAt: 123,
      },
    ],
    unknownPersistedSetting: { shouldRemain: ['intact', null] },
    ...extra,
  } as unknown as AppSettings;
}

function grinder(
  id: string,
  name: string,
  extra: Record<string, unknown> = {}
): Grinder {
  return {
    id,
    name,
    currentGrindSize: '18',
    grindSizeHistory: [
      { grindSize: '20', timestamp: 100 },
      { grindSize: '18', timestamp: 200, coffeeBeanName: 'Bourbon' },
    ],
    ...extra,
  } as unknown as Grinder;
}

function equipment(
  id: string,
  name: string,
  extra: Record<string, unknown> = {},
  isCustom = true
): CustomEquipment {
  return {
    id,
    name,
    animationType: 'v60',
    isCustom,
    ...extra,
  } as unknown as CustomEquipment;
}

function customMethods(
  equipmentId: string,
  methods: CustomMethodRecord['methods'],
  extra: Record<string, unknown> = {}
): CustomMethodRecord {
  return {
    equipmentId,
    methods,
    ...extra,
  } as CustomMethodRecord;
}

function method(name: string, id?: string): Method {
  return {
    ...(id ? { id } : {}),
    name,
    params: {
      coffee: '15',
      water: '250',
      ratio: '1:16',
      grindSize: '18',
      temp: '93',
      stages: [],
    },
  };
}
