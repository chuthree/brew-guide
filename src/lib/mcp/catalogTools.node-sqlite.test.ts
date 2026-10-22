import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import { saveBrewingNote } from '@/lib/data/sqlite/repositories/brewingNote';
import {
  catalogDefinitions,
  mutateCatalogTool,
  readCatalogTool,
} from './catalogTools';

let db: NodeSqliteTestDatabase;
let seq = 0;
type View = {
  id: string;
  version: string;
  name: string;
  equipmentId?: string;
  readOnly?: boolean;
  currentGrindSize?: string;
  grindSizeHistory?: Array<{ grindSize: string }>;
};
const read = (name: string, args = {}) =>
  db.driver.transaction(tx => readCatalogTool(tx, name, args));
const mutate = (name: string, args = {}) =>
  db.driver.transaction(tx =>
    mutateCatalogTool(tx, name, { requestId: `catalog-test-${++seq}`, ...args })
  );
const method = {
  name: 'Test method',
  params: {
    coffee: '15g',
    water: '225g',
    ratio: '1:15',
    grindSize: 'fine',
    temp: '92°C',
    stages: [
      {
        label: 'Pour',
        detail: '',
        duration: 30,
        water: '225',
        pourType: 'circle',
      },
    ],
  },
};
const createEquipment = async () =>
  (
    await mutate('create_equipment', {
      equipment: { name: 'Test V60', animationType: 'v60' },
    })
  ).result.equipment as View;
const createMethod = async (equipmentId: string) =>
  (await mutate('create_method', { equipmentId, method })).result
    .method as View;
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
});
afterEach(async () => {
  await db.close();
});

describe('MCP catalog domain in real SQLite transactions', () => {
  it('has strict unique schemas and paginated immutable builtins', async () => {
    expect(new Set(catalogDefinitions.map(x => x.name)).size).toBe(23);
    const list = await read('list_equipment', { limit: 2 });
    expect(list.items).toHaveLength(2);
    expect(list.hasMore).toBe(true);
    const builtin = (await read('get_equipment', { id: 'V60' }))
      .equipment as View;
    expect(builtin.readOnly).toBe(true);
    await expect(
      mutate('update_equipment', {
        id: builtin.id,
        expectedVersion: builtin.version,
        changes: { name: 'overwrite' },
      })
    ).rejects.toMatchObject({ code: 'READ_ONLY' });
    await expect(
      read('preview_delete_equipment', { id: 'V60' })
    ).rejects.toMatchObject({ code: 'READ_ONLY' });
    await expect(
      mutate('create_equipment', {
        equipment: { id: 'V60', name: 'bad', animationType: 'v60' },
      })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });
  it('creates and version-guards custom equipment; preserves unsupported custom drawing fields on edit', async () => {
    const equipment = await createEquipment();
    expect(equipment.id).toMatch(/^custom-v60-/);
    const edited = (
      await mutate('update_equipment', {
        id: equipment.id,
        expectedVersion: equipment.version,
        changes: { note: 'Pour over' },
      })
    ).result.equipment as View;
    expect(edited.version).not.toBe(equipment.version);
    await expect(
      mutate('update_equipment', {
        id: equipment.id,
        expectedVersion: equipment.version,
        changes: { name: 'stale' },
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('lists builtin methods with stable IDs and disallows editing them', async () => {
    const listed = await read('list_method', { equipmentId: 'V60' });
    const builtin = (listed.items as View[])[0];
    expect(builtin.id).toMatch(/^builtin:V60:/);
    expect(
      (await read('get_method', { id: builtin.id, equipmentId: 'V60' })).method
    ).toEqual(builtin);
    await expect(
      mutate('update_method', {
        id: builtin.id,
        equipmentId: 'V60',
        expectedVersion: builtin.version,
        changes: { name: 'overwrite' },
      })
    ).rejects.toMatchObject({ code: 'READ_ONLY' });
  });
  it('validates method parent and stage data without writes', async () => {
    await expect(createMethod('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      mutate('create_method', {
        equipmentId: 'V60',
        method: { ...method, params: { ...method.params, coffee: '-1g' } },
      })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(
      mutate('create_method', {
        equipmentId: 'V60',
        method: {
          ...method,
          params: {
            ...method.params,
            stages: [{ label: 'Wait', detail: '', pourType: 'wait' }],
          },
        },
      })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(await db.driver.query('SELECT * FROM custom_methods')).toHaveLength(
      0
    );
  });
  it('creates, edits, deletes one method without touching siblings', async () => {
    const first = await createMethod('V60'),
      second = await createMethod('V60');
    const updated = (
      await mutate('update_method', {
        id: first.id,
        equipmentId: 'V60',
        expectedVersion: first.version,
        changes: { name: 'Edited' },
      })
    ).result.method as View;
    const preview = await read('preview_delete_method', {
      id: updated.id,
      equipmentId: 'V60',
    });
    await mutate('delete_method', {
      id: updated.id,
      equipmentId: 'V60',
      expectedVersion: updated.version,
      confirmationToken: preview.confirmationToken,
    });
    expect(
      (
        (await read('get_method', { id: second.id, equipmentId: 'V60' }))
          .method as View
      ).name
    ).toBe(method.name);
    await expect(
      read('get_method', { id: first.id, equipmentId: 'V60' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('equipment delete cascades only its methods and preserves historical notes', async () => {
    const equipment = await createEquipment();
    await createMethod(equipment.id);
    const kept = await createMethod('V60');
    await saveBrewingNote(db.driver, {
      id: 'history',
      timestamp: 1,
      equipment: equipment.id,
      method: method.name,
      rating: 0,
      taste: {},
      notes: 'keep',
    });
    const preview = await read('preview_delete_equipment', {
      id: equipment.id,
    });
    expect(preview.impact).toEqual({
      deletedCustomMethodCount: 1,
      preservedHistoricalNoteCount: 1,
    });
    const work = await mutate('delete_equipment', {
      id: equipment.id,
      expectedVersion: equipment.version,
      confirmationToken: preview.confirmationToken,
    });
    expect(work.changes.map(x => x.entity)).toEqual(['method', 'equipment']);
    expect(
      await db.driver.query(
        'SELECT * FROM custom_methods WHERE equipment_id = ?',
        [equipment.id]
      )
    ).toHaveLength(0);
    expect(await db.driver.query('SELECT * FROM brewing_notes')).toHaveLength(
      1
    );
    expect(
      (await read('get_method', { id: kept.id, equipmentId: 'V60' })).method
    ).toBeTruthy();
  });
  it('invalidates delete preview when child methods change, without removing anything', async () => {
    const equipment = await createEquipment();
    const preview = await read('preview_delete_equipment', {
      id: equipment.id,
    });
    await createMethod(equipment.id);
    await expect(
      mutate('delete_equipment', {
        id: equipment.id,
        expectedVersion: equipment.version,
        confirmationToken: preview.confirmationToken,
      })
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
    expect(
      (await read('get_equipment', { id: equipment.id })).equipment
    ).toBeTruthy();
  });
  it('grinder scale history is deduplicated and capped; delete preserves note snapshots', async () => {
    let grinder = (
      await mutate('create_grinder', {
        grinder: { name: 'Test grinder', currentGrindSize: '1' },
      })
    ).result.grinder as View;
    for (let n = 2; n < 15; n++)
      grinder = (
        await mutate('update_grinder', {
          id: grinder.id,
          expectedVersion: grinder.version,
          changes: { currentGrindSize: String(n) },
        })
      ).result.grinder as View;
    grinder = (
      await mutate('update_grinder', {
        id: grinder.id,
        expectedVersion: grinder.version,
        changes: { currentGrindSize: '12' },
      })
    ).result.grinder as View;
    expect(grinder.grindSizeHistory).toHaveLength(10);
    expect(grinder.grindSizeHistory![0].grindSize).toBe('12');
    expect(
      grinder.grindSizeHistory!.filter(x => x.grindSize === '12')
    ).toHaveLength(1);
    await saveBrewingNote(db.driver, {
      id: 'history',
      timestamp: 1,
      params: { grindSize: 'Test grinder 12' },
      rating: 0,
      taste: {},
      notes: 'keep',
    });
    const preview = await read('preview_delete_grinder', { id: grinder.id });
    expect(preview.impact).toMatchObject({ preservedHistoricalNoteCount: 1 });
    await mutate('delete_grinder', {
      id: grinder.id,
      expectedVersion: grinder.version,
      confirmationToken: preview.confirmationToken,
    });
    expect((await read('list_grinder')).total).toBe(0);
    expect(await db.driver.query('SELECT * FROM brewing_notes')).toHaveLength(
      1
    );
  });
  it('includes common methods inherited by a custom equipment', async () => {
    const equipment = await createEquipment();
    const listed = await read('list_method', { equipmentId: equipment.id });
    expect((listed.items as View[]).some(item => item.readOnly)).toBe(true);
  });
  it('addresses duplicate legacy method names independently and promotes edits to durable IDs', async () => {
    await db.driver.execute(
      'INSERT INTO custom_methods (equipment_id, methods_json, extra_json) VALUES (?, ?, ?)',
      ['V60', JSON.stringify([method, method]), '{}']
    );
    const listed = (await read('list_method', { equipmentId: 'V60' }))
      .items as View[];
    const legacy = listed.filter(item => !item.readOnly);
    expect(legacy.map(item => item.id)).toEqual(['legacy:0', 'legacy:1']);
    const updated = (
      await mutate('update_method', {
        equipmentId: 'V60',
        id: legacy[0].id,
        expectedVersion: legacy[0].version,
        changes: { name: 'Promoted' },
      })
    ).result.method as View;
    expect(updated.id).toMatch(/^method-/);
    expect(
      (await read('get_method', { equipmentId: 'V60', id: 'legacy:1' })).method
    ).toMatchObject({ name: method.name });
  });
});

describe('canonical method lifecycle', () => {
  it('reorders only an exact permutation and rejects stale collections', async () => {
    const equipment = await createEquipment();
    const a = await createMethod(equipment.id);
    const b = await createMethod(equipment.id);
    const state = await read('list_method', { equipmentId: equipment.id });
    await expect(
      mutate('reorder_method', {
        equipmentId: equipment.id,
        expectedVersion: state.collectionVersion,
        ids: [a.id, a.id],
      })
    ).rejects.toThrow();
    await mutate('reorder_method', {
      equipmentId: equipment.id,
      expectedVersion: state.collectionVersion,
      ids: [b.id, a.id],
    });
    const rows = (
      (await read('list_method', { equipmentId: equipment.id })).items as View[]
    ).filter(row => !row.readOnly);
    expect(rows.map(row => row.id)).toEqual([b.id, a.id]);
    await expect(
      mutate('reorder_method', {
        equipmentId: equipment.id,
        expectedVersion: state.collectionVersion,
        ids: [a.id, b.id],
      })
    ).rejects.toThrow();
  });
  it('copies builtins and removes unsupported valve state without changing source', async () => {
    const target = await createEquipment();
    const source = (
      (await read('list_method', { equipmentId: 'CleverDripper' }))
        .items as View[]
    )[0];
    const before = await read('get_method', {
      equipmentId: 'CleverDripper',
      id: source.id,
    });
    const result = await mutate('copy_method', {
      equipmentId: 'CleverDripper',
      id: source.id,
      expectedVersion: source.version,
      targetEquipmentId: target.id,
    });
    const copied = result.result.method as View & {
      params: { stages: Array<{ valveStatus?: string }> };
    };
    expect(copied.readOnly).toBe(false);
    expect(
      copied.params.stages.every(stage => stage.valveStatus === undefined)
    ).toBe(true);
    expect(
      await read('get_method', { equipmentId: 'CleverDripper', id: source.id })
    ).toEqual(before);
    const espresso = (
      await mutate('create_equipment', {
        equipment: { name: 'Espresso', animationType: 'espresso' },
      })
    ).result.equipment as View;
    await expect(
      mutate('copy_method', {
        equipmentId: 'CleverDripper',
        id: source.id,
        expectedVersion: source.version,
        targetEquipmentId: espresso.id,
      })
    ).rejects.toThrow();
  });
  it('sets and resets builtin parameter overrides without editing source or exposing other settings in changes', async () => {
    const source = (
      (await read('list_method', { equipmentId: 'V60' })).items as View[]
    )[0];
    const get = async () =>
      (await read('get_method', { equipmentId: 'V60', id: source.id }))
        .method as View & {
        overrideVersion: string;
        parameterOverride: unknown;
        effectiveParams: { coffee: string };
        params: { coffee: string };
      };
    const before = await get();
    const args = {
      equipmentId: 'V60',
      id: source.id,
      expectedVersion: before.version,
      expectedOverrideVersion: before.overrideVersion,
    };
    const updated = await mutate('set_method_override', {
      ...args,
      params: { coffee: '17g' },
    });
    const after = await get();
    expect(after.version).toBe(before.version);
    expect(after.params).toEqual(before.params);
    expect(after.effectiveParams.coffee).toBe('17g');
    expect(Object.keys(updated.changes[0].after as object)).toEqual([
      'methodParamOverrides',
    ]);
    await expect(
      mutate('set_method_override', { ...args, params: { coffee: '18g' } })
    ).rejects.toThrow();
    await mutate('set_method_override', {
      ...args,
      expectedOverrideVersion: after.overrideVersion,
      reset: true,
    });
    expect((await get()).parameterOverride).toBeNull();
    expect((await get()).effectiveParams.coffee).toBe(before.params.coffee);
  });
  it('reads and copies legacy cumulative stages through the app migration semantics', async () => {
    const legacy = {
      ...method,
      id: 'legacy-stages',
      params: {
        ...method.params,
        stages: [
          {
            label: 'Bloom',
            detail: '',
            time: 30,
            pourTime: 10,
            water: '50',
            pourType: 'circle',
          },
          {
            label: 'Pour',
            detail: '',
            time: 90,
            pourTime: 40,
            water: '225',
            pourType: 'circle',
          },
        ],
      },
    };
    await db.driver.execute(
      'INSERT INTO custom_methods (equipment_id, methods_json, extra_json) VALUES (?, ?, ?)',
      ['V60', JSON.stringify([legacy]), '{}']
    );
    const source = (
      await read('get_method', { equipmentId: 'V60', id: legacy.id })
    ).method as View & {
      params: {
        stages: Array<{ duration: number; water: string; pourType: string }>;
      };
    };
    expect(source.params.stages.map(stage => stage.duration)).toEqual([
      10, 20, 40, 20,
    ]);
    expect(source.params.stages.map(stage => stage.water)).toEqual([
      '50',
      undefined,
      '175',
      undefined,
    ]);
    const target = await createEquipment();
    const copied = (
      await mutate('copy_method', {
        equipmentId: 'V60',
        id: legacy.id,
        expectedVersion: source.version,
        targetEquipmentId: target.id,
      })
    ).result.method as typeof source;
    expect(copied.params.stages).toEqual(source.params.stages);
  });
});

describe('catalog preferences', () => {
  it('preserves private settings while applying builtin visibility, name and original enable-order semantics', async () => {
    await db.driver.execute(
      'INSERT INTO app_settings(id,data_json) VALUES (?,?)',
      [
        'main',
        JSON.stringify({
          experimentalBeanRecognitionApiKey: 'test-private-do-not-expose',
        }),
      ]
    );
    const before = await read('get_catalog_preferences');
    expect(JSON.stringify(before)).not.toContain('test-private');
    const builtin = (
      (await read('list_method', { equipmentId: 'V60' })).items as View[]
    ).find(row => row.readOnly)!;
    const updated = await mutate('update_catalog_preferences', {
      expectedVersion: before.version,
      equipmentId: 'V60',
      hidden: true,
      displayName: 'My V60',
      hiddenMethodIds: [builtin.id],
      equipmentOrder: ['V60'],
    });
    const equipment = (await read('get_equipment', { id: 'V60' }))
      .equipment as View & { hidden: boolean; displayName: string };
    expect(equipment.hidden).toBe(true);
    expect(equipment.displayName).toBe('My V60');
    expect(
      (
        (await read('get_method', { id: builtin.id, equipmentId: 'V60' }))
          .method as { hidden: boolean }
      ).hidden
    ).toBe(true);
    expect(JSON.stringify(updated.changes)).not.toContain('test-private');
    const persisted = await db.driver.query(
      'SELECT data_json FROM app_settings'
    );
    expect(
      JSON.parse(String(persisted[0].data_json))
        .experimentalBeanRecognitionApiKey
    ).toBe('test-private-do-not-expose');
    await expect(
      mutate('update_catalog_preferences', {
        expectedVersion: before.version,
        equipmentOrder: [],
      })
    ).rejects.toThrow();
    const current = await read('get_catalog_preferences');
    await expect(
      mutate('update_catalog_preferences', {
        expectedVersion: current.version,
        equipmentOrder: ['V60', 'V60'],
      })
    ).rejects.toThrow();
    await expect(
      mutate('update_catalog_preferences', {
        expectedVersion: current.version,
        equipmentId: 'V60',
        hiddenMethodIds: ['bad-id'],
      })
    ).rejects.toThrow();
    await mutate('update_catalog_preferences', {
      expectedVersion: current.version,
      equipmentId: 'V60',
      hidden: false,
      displayName: '',
      hiddenMethodIds: [],
      equipmentOrder: [],
    });
    const reset = await read('get_catalog_preferences');
    expect(
      (reset.preferences as { equipmentOrder: string[] }).equipmentOrder
    ).toEqual(['V60']);
  });
});

describe('MCP persisted equipment SVG assets', () => {
  it('roundtrips drawings and frame animation configuration through SQLite, preserving imported fields on unrelated edits', async () => {
    const svg =
      '<svg viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="var(--custom-shape-color)"/></svg>';
    const created = (
      await mutate('create_equipment', {
        equipment: {
          name: 'Custom drawn dripper',
          animationType: 'custom',
          customShapeSvg: svg,
          customValveSvg: svg,
          customValveOpenSvg: '',
          customPourAnimations: [
            {
              id: 'pour-custom',
              name: '手绘绕圈',
              customAnimationSvg: '',
              frames: [
                { id: 'frame-1', svgData: svg },
                { id: 'frame-2', svgData: '' },
              ],
            },
          ],
        },
      })
    ).result.equipment as View;
    const animationMethod = await mutate('create_method', {
      equipmentId: created.id,
      method: {
        ...method,
        params: {
          ...method.params,
          stages: [
            {
              label: 'Custom pour',
              detail: '',
              duration: 30,
              water: '225',
              pourType: 'pour-custom',
            },
          ],
        },
      },
    });
    expect(JSON.stringify(animationMethod.result)).toContain('pour-custom');
    const loaded = await read('get_equipment', { id: created.id });
    expect(JSON.stringify(loaded)).toContain('手绘绕圈');
    expect(JSON.stringify(loaded)).toContain('previewFrames');
    const updated = (
      await mutate('update_equipment', {
        id: created.id,
        expectedVersion: created.version,
        changes: { name: 'Renamed drawing' },
      })
    ).result.equipment as View & {
      customShapeSvg: string;
      customPourAnimations: Array<{
        customAnimationSvg: string;
        previewFrames: number;
      }>;
    };
    expect(updated.customShapeSvg).toBe(svg);
    expect(updated.customPourAnimations[0]).toMatchObject({
      customAnimationSvg: svg,
      previewFrames: 2,
    });
    await expect(
      mutate('update_equipment', {
        id: created.id,
        expectedVersion: updated.version,
        changes: { customShapeSvg: '<svg onload="evil()"/>' },
      })
    ).rejects.toThrow();
    expect(
      JSON.stringify(await read('get_equipment', { id: created.id }))
    ).toContain('Renamed drawing');
  });
});

describe('MCP legacy SVG retention', () => {
  it('does not sanitize or discard preexisting imported SVG on unrelated changes', async () => {
    const importedSvg =
      '<svg><g style="stroke:red"><path d="M0 0L1 1"/></g></svg>';
    const equipment = {
      id: 'custom-legacy-svg',
      name: 'Imported',
      animationType: 'custom',
      isCustom: true,
      customShapeSvg: importedSvg,
    };
    await db.driver.transaction(tx =>
      tx.execute(
        'INSERT INTO custom_equipments (id, record_json) VALUES (?, ?)',
        [equipment.id, JSON.stringify(equipment)]
      )
    );
    const loaded = await read('get_equipment', { id: equipment.id });
    const view = (loaded.equipment || loaded) as View;
    const result = await mutate('update_equipment', {
      id: equipment.id,
      expectedVersion: view.version,
      changes: { note: 'Keep imported shape' },
    });
    expect(
      (result.result.equipment as { customShapeSvg: string }).customShapeSvg
    ).toBe(importedSvg);
  });
});

describe('MCP custom animation reference integrity', () => {
  it('rejects removing or changing used IDs, allows names and unused removal, and preserves unknown imported references', async () => {
    const animations = ['used', 'unused'].map(id => ({
      id,
      name: id,
      customAnimationSvg: '<svg/>',
    }));
    const created = (
      await mutate('create_equipment', {
        equipment: {
          name: 'Animation references',
          animationType: 'custom',
          customPourAnimations: animations,
        },
      })
    ).result.equipment as View;
    const createdMethod = (
      await mutate('create_method', {
        equipmentId: created.id,
        method: {
          ...method,
          params: {
            ...method.params,
            stages: [
              { ...method.params.stages[0], pourType: 'used' },
              { ...method.params.stages[0], pourType: 'imported-unknown' },
            ],
          },
        },
      })
    ).result.method as View;
    for (const customPourAnimations of [
      [],
      [{ ...animations[0], id: 'renamed-id' }],
    ]) {
      await expect(
        mutate('update_equipment', {
          id: created.id,
          expectedVersion: created.version,
          changes: { customPourAnimations },
        })
      ).rejects.toThrow('References:');
      const readback = (await read('get_equipment', { id: created.id }))
        .equipment as View;
      expect(readback.version).toBe(created.version);
    }
    const updated = (
      await mutate('update_equipment', {
        id: created.id,
        expectedVersion: created.version,
        changes: {
          customPourAnimations: [{ ...animations[0], name: 'Renamed label' }],
        },
      })
    ).result.equipment as View;
    expect(
      JSON.stringify(
        await read('get_method', {
          id: createdMethod.id,
          equipmentId: created.id,
        })
      )
    ).toContain('imported-unknown');
    await mutate('update_method', {
      id: createdMethod.id,
      equipmentId: created.id,
      expectedVersion: createdMethod.version,
      changes: { params: method.params },
    });
    await expect(
      mutate('update_equipment', {
        id: created.id,
        expectedVersion: updated.version,
        changes: { customPourAnimations: [] },
      })
    ).resolves.toBeDefined();
  });
});
