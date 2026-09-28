import { describe, expect, it } from 'vitest';
import type {
  LegacyDatabaseInfo,
  LegacyHistoricalData,
  LegacyMigrationData,
  LegacySourceTableName,
} from '@/lib/data/legacy/legacyDexieReader';
import {
  LEGACY_LOCAL_STORAGE_MIGRATION_KEYS,
  type LegacyLocalStorageSnapshot,
} from '@/lib/data/legacy/legacyLocalStorageReader';
import { planLegacySqliteMigration } from './legacyMigrationPlan';

const tableNames: LegacySourceTableName[] = [
  'coffeeBeans',
  'brewingNotes',
  'coffeeBeanImages',
  'coffeeBeanImageThumbnails',
  'brewingNoteImages',
  'brewingNoteImageThumbnails',
  'customEquipments',
  'customMethods',
  'grinders',
  'appSettings',
  'settings',
  'pendingOperations',
];

const fileImage = 'data:image/png;base64,AQID';
const externalImage = 'https://images.example.test/bean.jpg?size=large';

function createSource(
  input: {
    tables?: Partial<Record<LegacySourceTableName, Record<string, unknown>[]>>;
    yearlyReports?: unknown[];
    version?: number;
    extraTable?: string;
    localStorage?: Partial<LegacyLocalStorageSnapshot>;
    databaseAbsent?: boolean;
  } = {}
) {
  const tables = input.tables ?? {};
  const active = Object.fromEntries(
    tableNames.map(name => {
      const records = tables[name];
      return [
        name,
        records
          ? { status: 'present', records }
          : { status: 'absent', records: [] },
      ];
    })
  ) as LegacyMigrationData;
  const historical: LegacyHistoricalData = input.yearlyReports
    ? { yearlyReports: { status: 'present', records: input.yearlyReports } }
    : { yearlyReports: { status: 'absent', records: [] } };
  const names = [
    ...tableNames.filter(name => active[name].status === 'present'),
    ...(historical.yearlyReports.status === 'present' ? ['yearlyReports'] : []),
    ...(input.extraTable ? [input.extraTable] : []),
  ];
  const info: LegacyDatabaseInfo | null = input.databaseAbsent
    ? null
    : {
        exists: true,
        version: input.version ?? 11,
        absentSourceTables: tableNames.filter(
          name => active[name].status === 'absent'
        ),
        tables: names.map(name => ({
          name,
          primaryKey: {
            name: null,
            keyPath: 'id',
            source: 'id',
            autoIncrement: false,
            unique: true,
            multiEntry: false,
          },
          indexes: [],
        })),
      };
  const localStorage = Object.fromEntries(
    LEGACY_LOCAL_STORAGE_MIGRATION_KEYS.map(key => [
      key,
      input.localStorage?.[key] ?? null,
    ])
  ) as LegacyLocalStorageSnapshot;
  return { info, active, historical, localStorage };
}

describe('legacy SQLite migration planning', () => {
  it('preflights every active and historical table and maps images without writing', async () => {
    const source = createSource({
      version: 8,
      tables: {
        coffeeBeans: [
          {
            id: 'bean-1',
            timestamp: 1700000000000,
            name: 'Washed Ethiopia',
            image: fileImage,
            backImage: externalImage,
            futureField: { retained: true },
          },
        ],
        brewingNotes: [
          {
            id: 'note-1',
            timestamp: 1700000001000,
            updatedAt: 1700000002000,
            rating: 4,
            notes: 'bright',
            taste: { citrus: 4 },
            beanId: 'bean-1',
            image: fileImage,
            images: [fileImage, externalImage],
          },
        ],
        coffeeBeanImages: [
          {
            beanId: 'bean-1',
            image: fileImage,
            backImage: externalImage,
            updatedAt: 1700000000000,
          },
        ],
        coffeeBeanImageThumbnails: [
          {
            beanId: 'bean-1',
            imageThumbnail: fileImage,
            updatedAt: 1700000000001,
          },
        ],
        brewingNoteImages: [
          {
            noteId: 'note-1',
            image: fileImage,
            images: [fileImage, externalImage],
            updatedAt: 1700000002000,
          },
        ],
        brewingNoteImageThumbnails: [
          {
            noteId: 'note-1',
            imageThumbnail: fileImage,
            imageThumbnails: [fileImage],
            updatedAt: 1700000002001,
          },
        ],
        customEquipments: [
          {
            id: 'equipment-1',
            name: 'Dripper',
            animationType: 'pour',
            isCustom: true,
            svg: '<svg>保留</svg>',
          },
        ],
        customMethods: [
          {
            equipmentId: 'equipment-1',
            methods: [{ name: 'Slow pour', futureStepField: true }],
            futureTopLevelField: 'kept',
          },
        ],
        grinders: [{ id: 'grinder-1', name: 'C40', grindSizeHistory: [] }],
        appSettings: [
          { id: 'main', data: { logoData: 'data:image/png;base64,AQID' } },
        ],
        settings: [
          { key: 'v4_migrated', value: 'true' },
          { key: 'customMethods_equipment-1', value: '{"methods":[]}' },
        ],
        pendingOperations: [
          {
            id: 'op-1',
            table: 'futureTable',
            type: 'futureAction',
            recordId: 'record-1',
            timestamp: 1700000003000,
            retryCount: 2,
            data: null,
            lastError: 'kept',
            failedAt: 1700000004000,
            futureMetadata: { attempt: 3 },
          },
        ],
      },
      yearlyReports: [
        {
          id: 'report-2024',
          year: 2024,
          username: '咖啡师',
          content: 'line one\n第二行',
          createdAt: 1700000005000,
          futureReportField: ['kept'],
        },
      ],
    });

    const plan = await planLegacySqliteMigration(source);

    expect(plan.sourceVersion).toBe(8);
    expect(plan.sourcePresence.yearlyReports).toBe('present-data');
    expect(plan.sourcePresence.appSettings).toBe('present-data');
    expect(plan.sourcePresence.grinders).toBe('present-data');
    expect(plan.legacyLocalStoragePresence.brewGuideSettings).toBe(false);
    expect(plan.rows.coffeeBeans).toHaveLength(1);
    expect(JSON.parse(plan.rows.coffeeBeans[0].record_json)).toMatchObject({
      futureField: { retained: true },
    });
    expect(plan.rows.brewingNotes).toHaveLength(1);
    expect(plan.rows.customEquipments).toHaveLength(1);
    expect(plan.rows.customMethods).toHaveLength(1);
    expect(plan.rows.grinders).toHaveLength(1);
    expect(plan.rows.appSettings).toHaveLength(1);
    expect(plan.rows.legacySettings).toHaveLength(2);
    expect(plan.rows.pendingOperations[0].table_name).toBe('futureTable');
    expect(plan.rows.pendingOperations[0].operation_type).toBe('futureAction');
    expect(JSON.parse(plan.rows.pendingOperations[0].extra_json)).toMatchObject(
      {
        futureMetadata: { attempt: 3 },
      }
    );
    expect(plan.rows.historicalYearlyReports[0].content).toBe(
      'line one\n第二行'
    );
    expect(JSON.parse(plan.rows.historicalYearlyReports[0].extra_json)).toEqual(
      {
        futureReportField: ['kept'],
      }
    );

    expect(plan.rows.coffeeBeanImages).toHaveLength(3);
    expect(
      plan.rows.coffeeBeanImages.find(row => row.slot === 'back')?.external_url
    ).toBe(externalImage);
    expect(plan.rows.brewingNoteImages).toHaveLength(3);
    expect(
      plan.rows.brewingNoteImages
        .filter(row => row.variant === 'original')
        .map(row => row.position)
    ).toEqual([0, 1]);
    expect(
      plan.rows.brewingNoteImages.find(
        row => row.variant === 'original' && row.position === 1
      )?.external_url
    ).toBe(externalImage);
    expect(plan.imageFiles).toHaveLength(4);
    expect(
      plan.imageFiles.every(
        file =>
          file.dataUrl.startsWith('data:image/') &&
          file.sizeBytes > 0 &&
          /^[0-9a-f]{64}$/.test(file.sha256) &&
          !Object.prototype.hasOwnProperty.call(file, 'bytes')
      )
    ).toBe(true);
    expect(
      plan.imageFiles.every(file => file.objectKey.startsWith('mig_'))
    ).toBe(true);

    const retryPlan = await planLegacySqliteMigration(source);
    expect(retryPlan.imageFiles.map(file => file.objectKey)).toEqual(
      plan.imageFiles.map(file => file.objectKey)
    );
  });

  it('distinguishes absent tables from present-empty historical tables', async () => {
    const source = createSource({
      tables: {
        coffeeBeans: [],
      },
      yearlyReports: [],
    });

    const plan = await planLegacySqliteMigration(source);

    expect(plan.sourcePresence.coffeeBeans).toBe('present-empty');
    expect(plan.sourcePresence.brewingNotes).toBe('absent');
    expect(plan.sourcePresence.yearlyReports).toBe('present-empty');
  });

  it('maps a missing or null legacy overall rating to the canonical unrated value', async () => {
    const source = createSource({
      tables: {
        brewingNotes: [
          {
            id: 'note-rating-missing',
            timestamp: 1700000000000,
            notes: '',
            taste: {},
          },
          {
            id: 'note-rating-null',
            timestamp: 1700000000001,
            rating: null,
            notes: '',
            taste: {},
          },
        ],
      },
    });

    const plan = await planLegacySqliteMigration(source);
    const persistedNotes = plan.rows.brewingNotes.map(row =>
      JSON.parse(row.record_json)
    );

    expect(persistedNotes.map(note => note.rating)).toEqual([0, 0]);
    expect(source.active.brewingNotes.records[0]).not.toHaveProperty('rating');
    expect(source.active.brewingNotes.records[1].rating).toBeNull();
  });

  it('continues rejecting malformed non-null legacy ratings', async () => {
    await expect(
      planLegacySqliteMigration(
        createSource({
          tables: {
            brewingNotes: [
              {
                id: 'note-rating-invalid',
                timestamp: 1700000000000,
                rating: 'unrated',
                notes: '',
                taste: {},
              },
            ],
          },
        })
      )
    ).rejects.toThrow(
      /brewing_notes record note-rating-invalid at rating: expected a finite number/
    );
  });

  it('plans an absent IndexedDB without inventing tables or a version', async () => {
    const plan = await planLegacySqliteMigration(
      createSource({ databaseAbsent: true })
    );

    expect(plan.sourceVersion).toBeNull();
    expect(Object.values(plan.sourcePresence)).toEqual(
      Array(13).fill('absent')
    );
    expect(Object.values(plan.rows).every(rows => rows.length === 0)).toBe(
      true
    );
    expect(plan.imageFiles).toEqual([]);
  });

  it('maps LocalStorage settings even when the legacy database is absent', async () => {
    const plan = await planLegacySqliteMigration(
      createSource({
        databaseAbsent: true,
        localStorage: {
          brewGuideSettings: JSON.stringify({
            state: { settings: { theme: 'dark' } },
          }),
          'roaster-logos': '[{"roasterName":"Legacy"}]',
        },
      })
    );

    expect(plan.sourceVersion).toBeNull();
    expect(plan.rows.appSettings).toHaveLength(1);
    expect(JSON.parse(plan.rows.appSettings[0].data_json)).toEqual({
      theme: 'dark',
      roasterConfigs: [{ roasterName: 'Legacy' }],
    });
  });

  it('uses legacy scalar note images when the image array is empty', async () => {
    const plan = await planLegacySqliteMigration(
      createSource({
        tables: {
          brewingNotes: [
            {
              id: 'note-scalar',
              timestamp: 1700000000000,
              rating: 3,
              notes: '',
              taste: {},
              image: fileImage,
              images: [],
            },
          ],
          brewingNoteImageThumbnails: [
            {
              noteId: 'note-scalar',
              imageThumbnail: fileImage,
              imageThumbnails: [],
            },
          ],
        },
      })
    );

    expect(
      plan.rows.brewingNoteImages.map(row => ({
        variant: row.variant,
        position: row.position,
      }))
    ).toEqual([
      { variant: 'original', position: 0 },
      { variant: 'thumbnail', position: 0 },
    ]);
    expect(plan.imageFiles).toHaveLength(2);
  });

  it('plans known LocalStorage-to-Dexie settings and grinder sources without mutating them', async () => {
    const rawSettings = JSON.stringify({
      state: {
        settings: {
          theme: 'dark',
          grinders: [
            {
              id: 'legacy-grinder',
              name: 'C40',
              grindSizeHistory: [],
              extension: { kept: true },
            },
          ],
        },
      },
      version: 2,
    });
    const localStorage: LegacyLocalStorageSnapshot = {
      brewGuideSettings: rawSettings,
      'roaster-logos':
        '[{"roasterName":"Roaster","logoData":"data:image/png;base64,AQID","future":"kept"}]',
      customFlavorDimensions: '[{"id":"sweetness"}]',
      flavorDimensionHistoricalLabels: '{"old":"Sweet"}',
      equipmentOrder: '{"equipmentIds":["v60","custom"]}',
    };
    const source = createSource({
      tables: {
        coffeeBeans: [],
        brewingNotes: [],
        customEquipments: [],
        customMethods: [],
        grinders: [],
        appSettings: [],
        settings: [
          {
            key: 'customEquipments',
            value:
              '[{"id":"legacy-equipment","name":"Old Dripper","animationType":"pour","isCustom":true,"svg":"<svg/>"}]',
          },
        ],
        pendingOperations: [],
      },
      localStorage,
    });

    const plan = await planLegacySqliteMigration(source);
    const settings = JSON.parse(plan.rows.appSettings[0].data_json);

    expect(plan.legacyLocalStoragePresence).toEqual({
      brewGuideSettings: true,
      'roaster-logos': true,
      customFlavorDimensions: true,
      flavorDimensionHistoricalLabels: true,
      equipmentOrder: true,
    });
    expect(settings).toEqual({
      theme: 'dark',
      flavorDimensions: [{ id: 'sweetness' }],
      flavorDimensionHistoricalLabels: { old: 'Sweet' },
      roasterConfigs: [
        {
          roasterName: 'Roaster',
          logoData: 'data:image/png;base64,AQID',
          future: 'kept',
        },
      ],
      equipmentOrder: ['v60', 'custom'],
    });
    expect(plan.rows.grinders.map(row => row.id)).toEqual(['legacy-grinder']);
    expect(JSON.parse(plan.rows.grinders[0].record_json).extension).toEqual({
      kept: true,
    });
    expect(plan.rows.customEquipments.map(row => row.id)).toEqual([
      'legacy-equipment',
    ]);
    expect(localStorage.brewGuideSettings).toBe(rawSettings);
    expect(source.active.settings.records[0].value).toContain(
      'legacy-equipment'
    );
  });

  it('fills only missing legacy settings from LocalStorage when the Dexie main row exists', async () => {
    const source = createSource({
      tables: {
        appSettings: [
          {
            id: 'main',
            data: {
              theme: 'light',
              flavorDimensions: [{ id: 'current' }],
              roasterConfigs: [],
              flavorDimensionHistoricalLabels: {},
              equipmentOrder: [],
            },
          },
        ],
        grinders: [],
      },
      localStorage: {
        brewGuideSettings: JSON.stringify({
          state: { settings: { theme: 'dark' } },
        }),
        'roaster-logos': '[{"roasterName":"Legacy"}]',
        customFlavorDimensions: '[{"id":"old"}]',
        flavorDimensionHistoricalLabels: '{"old":"Old label"}',
        equipmentOrder: '{"equipmentIds":["legacy-order"]}',
      },
    });

    const plan = await planLegacySqliteMigration(source);
    const settings = JSON.parse(plan.rows.appSettings[0].data_json);

    expect(settings).toEqual({
      theme: 'light',
      flavorDimensions: [{ id: 'current' }],
      roasterConfigs: [{ roasterName: 'Legacy' }],
      flavorDimensionHistoricalLabels: { old: 'Old label' },
      equipmentOrder: ['legacy-order'],
    });
    expect(plan.rows.grinders).toEqual([]);
  });

  it('fails closed on malformed LocalStorage migration payloads and equipment fallback rows', async () => {
    await expect(
      planLegacySqliteMigration(
        createSource({
          localStorage: { brewGuideSettings: '{invalid' },
        })
      )
    ).rejects.toThrow(/brewGuideSettings.*invalid JSON/);

    await expect(
      planLegacySqliteMigration(
        createSource({
          tables: {
            customEquipments: [],
            settings: [{ key: 'customEquipments', value: '{invalid' }],
          },
        })
      )
    ).rejects.toThrow(/settings record customEquipments.*invalid JSON/);
  });

  it('rejects unknown tables and unsupported or conflicting image sources before any write plan is returned', async () => {
    await expect(
      planLegacySqliteMigration(createSource({ extraTable: 'futureUserData' }))
    ).rejects.toThrow(/futureUserData.*no SQLite v1 migration mapping/);

    await expect(
      planLegacySqliteMigration(
        createSource({
          tables: {
            coffeeBeans: [
              {
                id: 'bean-1',
                timestamp: 1,
                name: 'Coffee',
                image: 'blob:unrecoverable',
              },
            ],
          },
        })
      )
    ).rejects.toThrow(/coffeeBeans record bean-1.*supported image/);

    await expect(
      planLegacySqliteMigration(
        createSource({
          tables: {
            coffeeBeans: [
              {
                id: 'bean-1',
                timestamp: 1,
                name: 'Coffee',
                image: externalImage,
              },
            ],
            coffeeBeanImages: [
              {
                beanId: 'bean-1',
                image: fileImage,
                updatedAt: 1,
              },
            ],
          },
        })
      )
    ).rejects.toThrow(/inline and split original images conflict/);
  });
});
