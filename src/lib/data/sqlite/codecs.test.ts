import { describe, expect, it } from 'vitest';
import type { AppSettings, Grinder } from '@/lib/data/models';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import {
  decodeAppSettings,
  decodeBrewingNote,
  decodeCoffeeBean,
  decodeCustomEquipment,
  decodeCustomMethods,
  decodeGrinder,
  decodeHistoricalYearlyReport,
  decodeLegacySetting,
  decodePendingOperation,
  encodeAppSettings,
  encodeBrewingNote,
  encodeCoffeeBean,
  encodeCustomEquipment,
  encodeCustomMethods,
  encodeGrinder,
  encodeHistoricalYearlyReport,
  encodeLegacySetting,
  encodePendingOperation,
} from './codecs';
import type {
  BrewingNoteRow,
  CoffeeBeanRow,
  HistoricalYearlyReportRow,
  PendingOperationRow,
} from './schemaV1';

const makeCoffeeBean = (overrides: Record<string, unknown> = {}) => ({
  id: 'bean-2026-01',
  timestamp: 1_780_000_001_234,
  name: 'Ethiopia Guji',
  roaster: 'North Roastery',
  roastDate: '2026-06-01',
  roastLevel: 'light',
  flavor: ['柑橘', '白花'],
  flavorTags: ['citrus', 'floral'],
  weight: 200,
  remainingWeight: 173.5,
  price: 28.5,
  isFrozen: false,
  type: 'single-origin-legacy',
  beanType: 'filter',
  image: 'data:image/jpeg;base64,front原图',
  backImage: 'data:image/png;base64,back原图',
  oldPluginData: { nested: ['keep', null, 2] },
  imageProcessingMetadata: { colorSpace: 'Display P3', quality: 0.875 },
  ...overrides,
});

const makeBrewingNote = (overrides: Record<string, unknown> = {}) => ({
  id: 'note-2026-01',
  timestamp: 1_780_000_101_234,
  updatedAt: 1_780_000_201_234,
  beanId: 'bean-2026-01',
  equipment: 'V60',
  method: 'Pulse pour',
  params: {
    coffee: '15g',
    water: '225g',
    ratio: '1:15',
    grindSize: '中细',
    temp: '92°C',
    extractionTime: 180,
    stages: [
      { label: 'Bloom', detail: '先闷蒸', water: '45g', duration: 35 },
      { label: 'Pour', detail: 'slow circle', water: '180g', duration: 90 },
    ],
  },
  coffeeBeanInfo: {
    name: 'Ethiopia Guji',
    roastLevel: 'light',
    roastDate: '2026-06-01',
    roaster: 'North Roastery',
  },
  rating: 4.5,
  taste: { acidity: 4, sweetness: 4.5, body: 3 },
  notes: '柑橘、白花\n回甘清楚。',
  totalTime: 180,
  source: 'quick-decrement',
  changeRecord: { quickDecrementAmount: 1 },
  image: 'data:image/jpeg;base64,note-front',
  images: [
    'data:image/jpeg;base64,note-front',
    'data:image/webp;base64,note-second',
  ],
  futureField: { keep: true },
  ...overrides,
});

describe('SQLite entity row codecs', () => {
  it('round-trips CoffeeBean projections, unknown fields, both legacy type names and image sources', () => {
    const bean = makeCoffeeBean();
    const encoded = encodeCoffeeBean(bean);
    const record = JSON.parse(encoded.row.record_json) as Record<
      string,
      unknown
    >;
    expect(encoded.row).toMatchObject({
      id: bean.id,
      timestamp_ms: bean.timestamp,
    });
    expect(record).not.toHaveProperty('image');
    expect(record).not.toHaveProperty('backImage');
    expect(record).toMatchObject({
      type: 'single-origin-legacy',
      beanType: 'filter',
      oldPluginData: { nested: ['keep', null, 2] },
      imageProcessingMetadata: { colorSpace: 'Display P3', quality: 0.875 },
    });
    expect(encoded.imageSources).toEqual([
      { slot: 'front', data: bean.image, source: 'inline' },
      { slot: 'back', data: bean.backImage, source: 'inline' },
    ]);
    expect(decodeCoffeeBean(encoded.row, encoded.imageSources)).toEqual(bean);
  });

  it('retains a historical type-only bean without synthesizing beanType', () => {
    const bean = makeCoffeeBean({ beanType: undefined });
    const decoded = decodeCoffeeBean(encodeCoffeeBean(bean).row);
    expect((decoded as unknown as Record<string, unknown>).type).toBe(
      'single-origin-legacy'
    );
    expect(Object.hasOwn(decoded, 'beanType')).toBe(false);
  });

  it('preserves explicit null and empty inline image strings without treating them as files', () => {
    const bean = makeCoffeeBean({ image: '', backImage: null });
    const encoded = encodeCoffeeBean(bean);
    expect(encoded.imageSources).toEqual([]);
    expect(decodeCoffeeBean(encoded.row)).toEqual(bean);
  });

  it('checks id and timestamp projections instead of overwriting the JSON snapshot', () => {
    const row = encodeCoffeeBean(makeCoffeeBean()).row;
    expect(() => decodeCoffeeBean({ ...row, id: 'different' })).toThrow(
      /coffee_beans record different at id: projection mismatch/
    );
    expect(() =>
      decodeCoffeeBean({
        ...row,
        timestamp_ms: (row.timestamp_ms as number) + 1,
      })
    ).toThrow(/timestamp_ms: projection mismatch/);
    const conflictingJson = JSON.stringify({
      ...JSON.parse(row.record_json),
      id: 'json-id',
    });
    expect(() =>
      decodeCoffeeBean({ ...row, record_json: conflictingJson })
    ).toThrow(/coffee_beans record bean-2026-01 at id: projection mismatch/);
  });

  it('round-trips BrewingNote nested stages, JSON authority, nullable projections and image order', () => {
    const note = makeBrewingNote();
    const encoded = encodeBrewingNote(note);
    const json = JSON.parse(encoded.row.record_json) as Record<string, unknown>;
    expect(json).not.toHaveProperty('image');
    expect(json).not.toHaveProperty('images');
    expect(encoded.row).toMatchObject({
      id: note.id,
      timestamp_ms: note.timestamp,
      updated_at_ms: note.updatedAt,
      bean_id: note.beanId,
    });
    expect(encoded.imageSources).toEqual([
      {
        slot: 'note',
        field: 'images',
        position: 0,
        data: note.images[0],
        source: 'inline',
      },
      {
        slot: 'note',
        field: 'images',
        position: 1,
        data: note.images[1],
        source: 'inline',
      },
      {
        slot: 'note',
        field: 'image',
        data: note.image,
        source: 'inline',
      },
    ]);
    expect(decodeBrewingNote(encoded.row, encoded.imageSources)).toEqual(note);
    expect(JSON.parse(encoded.row.record_json).params.stages).toEqual(
      note.params.stages
    );
  });

  it.each([
    ['empty array and empty scalar', { images: [], image: '' }],
    [
      'array and scalar both present',
      { images: ['array-image'], image: 'scalar-image' },
    ],
    [
      'empty image string inside array',
      { images: ['', 'array-image'], image: '' },
    ],
  ])('preserves BrewingNote image field shape: %s', (_label, imageFields) => {
    const note = makeBrewingNote(imageFields);
    const encoded = encodeBrewingNote(note);
    const decoded = decodeBrewingNote(encoded.row, encoded.imageSources);

    expect(decoded).toEqual(note);
  });

  it.each([
    ['missing', {}, false],
    ['undefined', { beanId: undefined, updatedAt: undefined }, false],
    ['null', { beanId: null, updatedAt: null }, true],
  ])(
    'keeps BrewingNote beanId and updatedAt %s semantics',
    (label, fields, hasNull) => {
      const note = makeBrewingNote({
        ...fields,
        image: undefined,
        images: undefined,
      });
      if (label === 'missing') {
        delete (note as Record<string, unknown>).beanId;
        delete (note as Record<string, unknown>).updatedAt;
      }
      const encoded = encodeBrewingNote(note);
      const json = JSON.parse(encoded.row.record_json) as Record<
        string,
        unknown
      >;
      const decoded = decodeBrewingNote(encoded.row);
      if (hasNull) {
        expect(encoded.row.bean_id).toBeNull();
        expect(encoded.row.updated_at_ms).toBeNull();
        expect(json.beanId).toBeNull();
        expect(json.updatedAt).toBeNull();
        expect(decoded.beanId).toBeNull();
        expect(decoded.updatedAt).toBeNull();
      } else {
        expect(Object.hasOwn(json, 'beanId')).toBe(false);
        expect(Object.hasOwn(json, 'updatedAt')).toBe(false);
        expect(Object.hasOwn(decoded, 'beanId')).toBe(false);
        expect(Object.hasOwn(decoded, 'updatedAt')).toBe(false);
      }
    }
  );

  it('rejects a BrewingNote SQL projection that conflicts with authoritative JSON', () => {
    const row = encodeBrewingNote(makeBrewingNote()).row;
    expect(() => decodeBrewingNote({ ...row, bean_id: 'other-bean' })).toThrow(
      /bean_id: projection mismatch/
    );
    expect(() => decodeBrewingNote({ ...row, updated_at_ms: 1 })).toThrow(
      /updated_at_ms: projection mismatch/
    );
  });

  it('diagnoses a BrewingNote with a missing required timestamp instead of filling it', () => {
    const note = makeBrewingNote({ timestamp: undefined });
    expect(() => encodeBrewingNote(note)).toThrow(
      /brewing_notes record note-2026-01 at timestamp/
    );
  });

  it('round-trips CustomEquipment SVG, nested animation frames and unknown values intact', () => {
    const equipment = {
      id: 'custom-origami-1',
      name: 'Origami 星芒杯',
      timestamp: 1_780_000_000_123,
      note: '手冲器具',
      defaultEnabled: true,
      animationType: 'custom',
      isCustom: true,
      customShapeSvg:
        '<svg xmlns="http://www.w3.org/2000/svg">\n  <path d="M0 0 L1 1"/>\n  <!-- 星芒 -->\n</svg>',
      customValveSvg: '<svg><circle cx="1" cy="2" r="3"/></svg>',
      customPourAnimations: [
        {
          id: 'pour-1',
          name: '慢速绕圈',
          customAnimationSvg: '<svg>注水 → 绕圈</svg>',
          frames: [
            { id: 'frame-1', svgData: '<svg>第一帧</svg>' },
            { id: 'frame-2', svgData: '<svg>第二帧</svg>' },
          ],
        },
      ],
      unknownExtension: { nested: true },
    };
    const row = encodeCustomEquipment(equipment);
    expect(decodeCustomEquipment(row)).toEqual(equipment);
  });

  it('keeps ordered CustomMethods, empty lists, missing method IDs and unknown fields', () => {
    const record = {
      equipmentId: 'custom-equipment-1',
      methods: [
        {
          name: '第一种冲煮法',
          params: {
            coffee: '15g',
            water: '225g',
            ratio: '1:15',
            grindSize: '中细',
            temp: '92°C',
            stages: [],
          },
          futureMethodField: ['keep', 1],
        },
        {
          id: 'method-2',
          name: '第二种冲煮法',
          params: {
            coffee: '18g',
            water: '270g',
            ratio: '1:15',
            grindSize: '中细',
            temp: '90°C',
            stages: [],
          },
        },
      ],
      futureRecordField: { preserved: true },
    };
    const row = encodeCustomMethods(record);
    expect(decodeCustomMethods(row)).toEqual(record);
    expect(
      decodeCustomMethods(
        encodeCustomMethods({ equipmentId: 'empty', methods: [] })
      )
    ).toEqual({ equipmentId: 'empty', methods: [] });
  });

  it('round-trips Grinder float history, array order and unknown fields', () => {
    const grinder: Grinder = {
      id: 'grinder-1',
      name: '手摇磨豆机',
      currentGrindSize: '中细',
      grindSizeHistory: [
        { grindSize: '中粗', timestamp: 100, coffeeBeanName: 'Guji' },
        { grindSize: '中细', timestamp: 200, method: 'V60' },
      ],
      unknownHistory: { keep: true, calibrationOffset: 0.375 },
    } as Grinder;
    expect(decodeGrinder(encodeGrinder(grinder))).toEqual(grinder);
    const emptyHistory = {
      id: 'grinder-empty-history',
      name: '空历史磨豆机',
      grindSizeHistory: [],
    } as Grinder;
    expect(decodeGrinder(encodeGrinder(emptyHistory))).toEqual(emptyHistory);
  });

  it('round-trips whole AppSettings including roaster logo data and unknown properties', () => {
    const data = {
      notificationSound: true,
      hapticFeedback: false,
      textZoomLevel: 1,
      showFlowRate: true,
      username: '小林',
      decrementPresets: [1, 2.5],
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
      estimatedCupDoseSettings: { filter: 15, espresso: 18, omni: 15 },
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
      showNoteTimeInNote: false,
      showCapacityAdjustmentRecords: true,
      roasterConfigs: [
        {
          roasterName: '烘焙商',
          logoData: 'data:image/png;base64,LOGO+原样保留',
          updatedAt: 123,
          flavorPeriod: {
            light: { startDay: 1, endDay: 20 },
            medium: { startDay: 2, endDay: 30 },
            dark: { startDay: 3, endDay: 40 },
          },
        },
      ],
      flavorDimensions: [
        { id: 'sweetness', label: '甜度', order: 1, isDefault: true },
      ],
      coffeeBeanGroups: [
        {
          id: 'group-1',
          name: '收藏',
          beanIds: ['bean-1'],
          order: 0,
          createdAt: 10,
          updatedAt: 11,
        },
      ],
      grinders: [
        { id: 'legacy-grinder', name: '旧设置磨豆机', grindSizeHistory: [] },
      ],
      unknownPreference: { preserve: 'yes' },
    } as unknown as AppSettings;
    const input = { id: 'main', data };
    expect(decodeAppSettings(encodeAppSettings(input))).toEqual(input);
  });

  it.each([
    '',
    'true',
    'null',
    '{"looks":"json"}',
    '  keep spaces  ',
    'v4_migrated',
    'brewingNoteImagesMigrated',
    'customMethods_器具',
  ])('round-trips legacy setting value exactly: %s', value => {
    const input = { key: 'historical-key', value };
    expect(decodeLegacySetting(encodeLegacySetting(input))).toEqual(input);
  });

  it('distinguishes pending operation data missing/undefined, SQL NULL and JSON null', () => {
    const base = {
      id: 'op-1',
      table: 'coffee_beans',
      type: 'upsert',
      recordId: 'bean-1',
      timestamp: 100,
      retryCount: 0,
    };
    const missing = encodePendingOperation(base);
    const explicitUndefined = encodePendingOperation({
      ...base,
      data: undefined,
    });
    const explicitNull = encodePendingOperation({ ...base, data: null });
    expect(missing.data_json).toBeNull();
    expect(explicitUndefined.data_json).toBeNull();
    expect(explicitNull.data_json).toBe('null');
    expect(Object.hasOwn(decodePendingOperation(missing), 'data')).toBe(false);
    expect(
      Object.hasOwn(decodePendingOperation(explicitUndefined), 'data')
    ).toBe(false);
    expect(decodePendingOperation(explicitNull).data).toBeNull();
  });

  it('round-trips pending retry fields and unknown JSON fields without deduping duplicate targets', () => {
    const first = {
      id: 'op-a',
      table: 'coffee_beans',
      type: 'upsert',
      recordId: 'same-bean',
      data: { id: 'same-bean', type: 'legacy', nested: [1, null, true] },
      timestamp: 123,
      retryCount: 3,
      lastError: 'offline',
      failedAt: 456,
      legacyField: { source: 'old-app' },
    };
    const second = { ...first, id: 'op-b', timestamp: 124 };
    const rows = [
      encodePendingOperation(first),
      encodePendingOperation(second),
    ];
    expect(rows.map(row => row.id)).toEqual(['op-a', 'op-b']);
    expect(rows.map(row => row.record_id)).toEqual(['same-bean', 'same-bean']);
    expect(decodePendingOperation(rows[0])).toEqual(first);
    expect(decodePendingOperation(rows[1])).toEqual(second);
  });

  it('retains explicit nullable pending error fields without confusing absence', () => {
    const input = {
      id: 'op-null',
      table: 'brewing_notes',
      type: 'delete',
      recordId: 'note-1',
      timestamp: 123,
      retryCount: 0,
      lastError: null,
      failedAt: null,
    };
    const row = encodePendingOperation(input);
    expect(decodePendingOperation(row)).toEqual(input);
    expect(
      Object.hasOwn(
        decodePendingOperation(
          encodePendingOperation({
            ...input,
            lastError: undefined,
            failedAt: undefined,
          })
        ),
        'lastError'
      )
    ).toBe(false);
  });

  it('round-trips unknown pending table and operation strings as raw storage data', () => {
    const input = {
      id: 'op-enum',
      table: 'future_table',
      type: 'merge',
      recordId: 'record-1',
      timestamp: 10,
      retryCount: 0,
    };
    const row = encodePendingOperation(input);
    expect(row.table_name).toBe('future_table');
    expect(row.operation_type).toBe('merge');
    expect(decodePendingOperation(row)).toEqual(input);
  });

  it('round-trips the historical report archive while preserving exact content and unknown fields', () => {
    const report = {
      id: 'report_2025_1767225600000',
      year: 2025,
      username: '小林',
      content:
        '# 2025 年度\n\n中文 mixed with English.\n标点：，。！\n\n末行不加换行',
      createdAt: 1_767_225_600_000,
      futureArchiveField: { safe: ['preserve', 1] },
    };
    const row = encodeHistoricalYearlyReport(report);
    expect(row.content).toBe(report.content);
    expect(decodeHistoricalYearlyReport(row)).toEqual(report);
  });
});

describe('SQLite codec malformed source matrix', () => {
  const validBean = makeCoffeeBean({ image: undefined, backImage: undefined });

  it.each([
    ['missing required timestamp', { timestamp: undefined }, /timestamp/],
    ['wrong timestamp primitive', { timestamp: '123' }, /finite number/],
    ['non-string ID', { id: 7 }, /id: expected a string/],
    ['wrong required name type', { name: 7 }, /name: expected a string/],
    [
      'NaN timestamp',
      { timestamp: Number.NaN },
      /timestamp: number must be finite/,
    ],
    [
      'Date in entity snapshot',
      { unknownLegacy: new Date(0) },
      /unknownLegacy: Date/,
    ],
    [
      'undefined array item',
      { unknownLegacy: [1, undefined] },
      /unknownLegacy\[1\]/,
    ],
  ])('%s is diagnosed with a field path', (_label, override, message) => {
    expect(() => encodeCoffeeBean({ ...validBean, ...override })).toThrow(
      message
    );
  });

  it('rejects cycles and sparse arrays in a legacy report extra field', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const validReport = {
      id: 'report_2025_1',
      year: 2025,
      username: 'User',
      content: 'Report',
      createdAt: 1,
    };
    expect(() =>
      encodeHistoricalYearlyReport({ ...validReport, extension: cycle })
    ).toThrow(/extension\.self: cyclic reference/);
    const sparse: unknown[] = [];
    sparse[2] = 'tail';
    expect(() =>
      encodeHistoricalYearlyReport({ ...validReport, extension: sparse })
    ).toThrow(/extension\[0\].*sparse array hole/);
  });

  it('rejects unsupported historical report extras instead of JSON coercing them', () => {
    const report = {
      id: 'report_2025_1',
      year: 2025,
      username: 'User',
      content: 'Report',
      createdAt: 1,
      extension: new Date(1),
    };
    expect(() => encodeHistoricalYearlyReport(report)).toThrow(
      /historical_yearly_reports record report_2025_1 at extension: Date/
    );
  });
});

// Compile-time DTO usage confirms snake_case storage rows stay separate from
// application-domain DTOs and are not accepted as repository contracts.
const _rowContractExamples: Array<
  | CoffeeBeanRow
  | BrewingNoteRow
  | PendingOperationRow
  | HistoricalYearlyReportRow
> = [];
void _rowContractExamples;
const _domainTypeExamples: Array<
  CoffeeBean | BrewingNote | AppSettings | Grinder
> = [];
void _domainTypeExamples;
