import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CustomEquipment, Method } from '@/lib/core/config';
import type {
  CustomMethodRecord,
  CustomEquipmentRepository,
  CustomMethodRepository,
} from '@/lib/data/contracts';
import { createDexieCustomEquipmentRepository } from '@/lib/data/adapters/dexie/customEquipmentRepository';
import { createDexieCustomMethodRepository } from '@/lib/data/adapters/dexie/customMethodRepository';

class CustomRepositoryTestDatabase extends Dexie {
  customEquipments!: Table<CustomEquipment, string>;
  customMethods!: Table<CustomMethodRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      customEquipments: 'id, name',
      customMethods: 'equipmentId',
    });
  }
}

const makeEquipment = (id: string, name = 'Glass dripper'): CustomEquipment =>
  ({
    id,
    name,
    animationType: 'custom',
    isCustom: true,
    customShapeSvg: '<svg><path d="M0 0" /></svg>',
    customPourAnimations: [
      {
        id: 'spiral',
        name: 'Spiral pour',
        customAnimationSvg: '<svg><circle cx="4" cy="4" r="2" /></svg>',
        previewFrames: 2,
        frames: [
          { id: 'frame-1', svgData: '<svg data-frame="1" />' },
          { id: 'frame-2', svgData: '<svg data-frame="2" />' },
        ],
      },
    ],
  }) as CustomEquipment;

const makeMethod = (id: string, name: string): Method => ({
  id,
  name,
  timestamp: 123,
  params: {
    coffee: '15g',
    water: '225g',
    ratio: '1:15',
    grindSize: 'medium-fine',
    temp: '92°C',
    stages: [
      {
        pourType: 'circle',
        label: 'Bloom',
        water: '30',
        duration: 30,
        detail: 'Wet the bed evenly',
      },
      {
        pourType: 'wait',
        label: 'Wait',
        duration: 30,
        detail: '',
      },
    ],
  },
});

describe('Dexie custom data repository adapters', () => {
  let testDb: CustomRepositoryTestDatabase;
  let equipmentRepository: CustomEquipmentRepository;
  let methodRepository: CustomMethodRepository;

  beforeEach(async () => {
    testDb = new CustomRepositoryTestDatabase(
      `BrewGuideCustomRepositoryTest-${Date.now()}-${Math.random()}`
    );
    await testDb.open();
    equipmentRepository = createDexieCustomEquipmentRepository(
      testDb.customEquipments
    );
    methodRepository = createDexieCustomMethodRepository(testDb.customMethods);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('lists empty tables and returns undefined for missing records', async () => {
    expect(await equipmentRepository.list()).toEqual([]);
    expect(await equipmentRepository.get('missing')).toBeUndefined();
    expect(await methodRepository.list()).toEqual([]);
    expect(await methodRepository.get('missing')).toBeUndefined();
  });

  it('saves, upserts, reads, and deletes custom equipment without altering nested SVG frames', async () => {
    const first = makeEquipment('equipment-1');
    const updated = makeEquipment('equipment-1', 'Updated dripper');

    await equipmentRepository.save(first);
    await equipmentRepository.save(updated);

    expect(await equipmentRepository.get('equipment-1')).toEqual(updated);
    expect(await equipmentRepository.count()).toBe(1);
    expect((await equipmentRepository.list())[0].customPourAnimations).toEqual(
      updated.customPourAnimations
    );

    await equipmentRepository.delete('equipment-1');
    expect(await equipmentRepository.list()).toEqual([]);
  });

  it('bulk upserts and replaces equipment rows, including clearing with an empty replacement', async () => {
    const equipments = [
      makeEquipment('equipment-1'),
      makeEquipment('equipment-2', 'Ceramic dripper'),
    ];

    await equipmentRepository.upsertMany(equipments);
    expect(await equipmentRepository.list()).toHaveLength(2);

    const replacement = [makeEquipment('equipment-3', 'Flat-bottom dripper')];
    await equipmentRepository.replaceAll(replacement);
    expect(await equipmentRepository.list()).toEqual(replacement);

    await equipmentRepository.replaceAll([]);
    expect(await equipmentRepository.count()).toBe(0);
  });

  it('deletes a batch of equipment ids and clears the table', async () => {
    await equipmentRepository.upsertMany([
      makeEquipment('equipment-1'),
      makeEquipment('equipment-2'),
    ]);

    await equipmentRepository.deleteMany(['equipment-1']);
    expect(await equipmentRepository.list()).toHaveLength(1);

    await equipmentRepository.clear();
    expect(await equipmentRepository.count()).toBe(0);
  });

  it('saves and replaces methods by equipment id while preserving stages', async () => {
    const first: CustomMethodRecord = {
      equipmentId: 'equipment-1',
      methods: [makeMethod('method-1', 'First recipe')],
    };
    const replacement: CustomMethodRecord = {
      equipmentId: 'equipment-1',
      methods: [makeMethod('method-2', 'Second recipe')],
    };

    await methodRepository.save(first);
    await methodRepository.save(replacement);

    expect(await methodRepository.get('equipment-1')).toEqual(replacement);
    expect(await methodRepository.count()).toBe(1);
    expect((await methodRepository.list())[0].methods[0].params.stages).toEqual(
      replacement.methods[0].params.stages
    );

    await methodRepository.delete('equipment-1');
    expect(await methodRepository.get('equipment-1')).toBeUndefined();
  });

  it('bulk upserts and deletes custom method records, then clears the table', async () => {
    const records: CustomMethodRecord[] = [
      {
        equipmentId: 'equipment-1',
        methods: [makeMethod('method-1', 'V60 recipe')],
      },
      {
        equipmentId: 'equipment-2',
        methods: [makeMethod('method-2', 'Kalita recipe')],
      },
    ];

    await methodRepository.upsertMany(records);
    expect(await methodRepository.list()).toHaveLength(2);
    expect(
      (await methodRepository.get('equipment-1'))?.methods[0].params
    ).toEqual(records[0].methods[0].params);

    await methodRepository.deleteMany(['equipment-1']);
    expect(await methodRepository.list()).toEqual([records[1]]);

    await methodRepository.clear();
    expect(await methodRepository.count()).toBe(0);
  });

  it('keeps an equipment id unchanged when it is also used as a method key', async () => {
    const sharedId = 'custom-v60-123';
    const equipment = makeEquipment(sharedId);
    const methods: CustomMethodRecord = {
      equipmentId: sharedId,
      methods: [makeMethod('method-1', 'Shared-key recipe')],
    };

    await equipmentRepository.save(equipment);
    await methodRepository.save(methods);

    expect((await equipmentRepository.get(sharedId))?.id).toBe(sharedId);
    expect((await methodRepository.get(sharedId))?.equipmentId).toBe(sharedId);
    expect(await equipmentRepository.count()).toBe(1);
    expect(await methodRepository.count()).toBe(1);
  });
});
