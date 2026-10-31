import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import {
  getAppSettings,
  saveAppSettings,
} from '@/lib/data/sqlite/repositories/appSettings';
import { listCoffeeBeans } from '@/lib/data/sqlite/repositories/coffeeBean';
import { listBrewingNotes } from '@/lib/data/sqlite/repositories/brewingNote';
import {
  listGrinders,
  upsertGrinders,
} from '@/lib/data/sqlite/repositories/grinder';
import { saveCoffeeBean } from '@/lib/data/sqlite/repositories/coffeeBean';
import { saveBrewingNote } from '@/lib/data/sqlite/repositories/brewingNote';
import type { AppSettings } from '@/lib/data/models';
import type { BrewingNote } from '@/lib/core/config';
import {
  mutatePreferencesTool,
  preferencesDefinitions,
  readPreferencesTool,
} from './preferencesTools';
import { validate } from './validation';
import { clearMcpLocalHistory } from './storage';

let db: NodeSqliteTestDatabase;
const read = (name: string, args: Record<string, unknown> = {}) =>
  readPreferencesTool(db.driver, name, args);
async function mutate(name: string, args: Record<string, unknown>) {
  const input = { requestId: 'preferences-operation-test', ...args };
  validate(input, preferencesDefinitions.find(d => d.name === name)!.schema);
  return db.driver.transaction(tx => mutatePreferencesTool(tx, name, input));
}
describe('MCP safe preferences (real SQLite)', () => {
  beforeEach(async () => {
    db = await createNodeSqliteTestDatabase();
    await saveAppSettings(db.driver, {
      textZoomLevel: 1,
      coffeeBeanGroups: [],
      syncSettings: { secret: 'must-never-leak' },
    } as unknown as AppSettings);
    await saveCoffeeBean(db.driver, {
      id: 'bean-a',
      name: 'A',
      capacity: '100',
      remaining: '80',
      timestamp: 1,
      beanState: 'roasted',
    });
  });
  afterEach(async () => {
    await db.close();
  });
  it('projects only allowlisted preferences and rejects credential writes', async () => {
    const before = await read('get_preferences');
    expect(JSON.stringify(before)).not.toContain('secret');
    const result = await mutate('update_preferences', {
      expectedVersion: before.version,
      patch: { textZoomLevel: 1.2 },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect((await getAppSettings(db.driver))!.textZoomLevel).toBe(1.2);
    expect(JSON.stringify(await getAppSettings(db.driver))).toContain(
      'must-never-leak'
    );
    await expect(
      mutate('update_preferences', {
        expectedVersion: result.result.version,
        patch: { syncSettings: {} },
      })
    ).rejects.toThrow('not allowed');
  });
  it('requires current version and never overwrites unrelated settings', async () => {
    const before = await read('get_preferences');
    await mutate('update_preferences', {
      expectedVersion: before.version,
      patch: { showFlowRate: true },
    });
    await expect(
      mutate('update_preferences', {
        expectedVersion: before.version,
        patch: { showFlowRate: false },
      })
    ).rejects.toThrow('changed');
    expect((await getAppSettings(db.driver))!.showFlowRate).toBe(true);
  });
  it('creates groups with valid deduplicated references; preview delete never deletes beans', async () => {
    const before = await read('list_bean_groups');
    const created = await mutate('create_bean_group', {
      expectedVersion: before.version,
      name: 'Test group',
      beanIds: ['bean-a', 'bean-a'],
    });
    const group = (
      created.result.items as Array<{ id: string; beanIds: string[] }>
    )[0];
    expect(group.beanIds).toEqual(['bean-a']);
    await expect(
      mutate('update_bean_group', {
        expectedVersion: created.result.version,
        id: group.id,
        beanIds: ['missing'],
      })
    ).rejects.toThrow('unknown bean');
    const preview = await read('preview_delete_preferences_item', {
      kind: 'group',
      id: group.id,
    });
    await mutate('delete_bean_group', {
      expectedVersion: preview.version,
      confirmationToken: preview.confirmationToken,
      id: group.id,
    });
    expect((await read('list_bean_groups')).items).toEqual([]);
    expect((await read('get_statistics')).inventory).toContainEqual({
      state: 'roasted',
      beanCount: 1,
      capacityGrams: 100,
      remainingGrams: 80,
    });
  });
  it('rejects stale deletion previews and duplicate reorder IDs', async () => {
    let current = await read('list_bean_groups');
    const first = await mutate('create_bean_group', {
      expectedVersion: current.version,
      name: 'one',
    });
    const id = (first.result.items as Array<{ id: string }>)[0].id;
    const preview = await read('preview_delete_preferences_item', {
      kind: 'group',
      id,
    });
    await mutate('create_bean_group', {
      expectedVersion: first.result.version,
      name: 'two',
    });
    await expect(
      mutate('delete_bean_group', {
        id,
        expectedVersion: preview.version,
        confirmationToken: preview.confirmationToken,
      })
    ).rejects.toThrow('changed');
    current = await read('list_bean_groups');
    await expect(
      mutate('reorder_bean_groups', {
        expectedVersion: current.version,
        ids: [id, id],
      })
    ).rejects.toThrow('every current ID');
  });
  it('retains labels and ratings when a flavor dimension is deleted', async () => {
    const current = await read('get_flavor_dimensions');
    const updated = await mutate('upsert_flavor_dimension', {
      expectedVersion: current.version,
      id: 'acidity',
      label: 'Bright',
    });
    expect(JSON.stringify(updated.result)).toContain('Bright');
    const preview = await read('preview_delete_preferences_item', {
      kind: 'flavor_dimension',
      id: 'acidity',
    });
    await mutate('delete_flavor_dimension', {
      id: 'acidity',
      expectedVersion: preview.version,
      confirmationToken: preview.confirmationToken,
    });
    const after = await getAppSettings(db.driver);
    expect(after!.flavorDimensions!.some(d => d.id === 'acidity')).toBe(false);
    expect(after!.flavorDimensionHistoricalLabels!.acidity).toBe('Bright');
  });
  it('validates taste windows and never exposes or destroys roaster image data', async () => {
    const settings = (await getAppSettings(db.driver))!;
    settings.roasterConfigs = [
      { roasterName: 'R', logoData: 'private-image', updatedAt: 1 },
    ];
    await saveAppSettings(db.driver, settings);
    const before = await read('list_roaster_configs');
    expect(JSON.stringify(before)).not.toContain('private-image');
    const period = {
      light: { startDay: 1, endDay: 10 },
      medium: { startDay: 2, endDay: 8 },
      dark: { startDay: 0, endDay: 5 },
    };
    await mutate('upsert_roaster_config', {
      expectedVersion: before.version,
      roasterName: 'R',
      flavorPeriod: period,
    });
    expect((await getAppSettings(db.driver))!.roasterConfigs![0].logoData).toBe(
      'private-image'
    );
    const current = await read('list_roaster_configs');
    await expect(
      mutate('upsert_roaster_config', {
        expectedVersion: current.version,
        roasterName: 'R',
        flavorPeriod: { ...period, light: { startDay: 20, endDay: 10 } },
      })
    ).rejects.toThrow('startDay');
  });
  it('separates adjustment/quick/roasting from brewing counts and filters time range', async () => {
    for (const [index, source] of [
      undefined,
      'capacity-adjustment',
      'quick-decrement',
      'roasting',
    ].entries()) {
      await saveBrewingNote(db.driver, {
        id: `note-${index}`,
        timestamp: 1000 + index,
        source,
        notes: '',
        rating: 0,
        taste: {},
      } as BrewingNote);
    }
    expect((await read('get_statistics')).records).toEqual({
      brewing: 1,
      capacityAdjustment: 1,
      quickConsumption: 1,
      roasting: 1,
    });
    expect(
      (
        await read('get_statistics', {
          from: new Date(1001).toISOString(),
          to: new Date(1002).toISOString(),
        })
      ).totalRecords
    ).toBe(1);
  });
  it('group versions remain stable for old records missing timestamps', async () => {
    const settings = (await getAppSettings(db.driver))!;
    settings.coffeeBeanGroups = [
      { id: 'old', name: 'Legacy', beanIds: [] } as never,
    ];
    await saveAppSettings(db.driver, settings);
    expect((await read('list_bean_groups')).version).toEqual(
      (await read('list_bean_groups')).version
    );
  });
  it('updates and reorders groups without deleting contents', async () => {
    let version = (await read('list_bean_groups')).version;
    let result = await mutate('create_bean_group', {
      expectedVersion: version,
      name: 'one',
      beanIds: ['bean-a'],
    });
    version = result.result.version;
    result = await mutate('create_bean_group', {
      expectedVersion: version,
      name: 'two',
    });
    const [a, b] = result.result.items as Array<{ id: string }>;
    result = await mutate('reorder_bean_groups', {
      expectedVersion: result.result.version,
      ids: [b.id, a.id],
    });
    expect(
      (result.result.items as Array<{ id: string }>).map(g => g.id)
    ).toEqual([b.id, a.id]);
    result = await mutate('update_bean_group', {
      expectedVersion: result.result.version,
      id: a.id,
      name: 'renamed',
    });
    expect(
      (
        result.result.items as Array<{
          id: string;
          name: string;
          beanIds: string[];
        }>
      ).find(g => g.id === a.id)
    ).toMatchObject({ name: 'renamed', beanIds: ['bean-a'] });
  });
  it('adds and reorders flavor dimensions while retaining default identity', async () => {
    const before = await read('get_flavor_dimensions');
    const result = await mutate('upsert_flavor_dimension', {
      expectedVersion: before.version,
      label: 'Finish',
    });
    const value = result.result.value as {
      dimensions: Array<{ id: string; isDefault: boolean }>;
    };
    expect(value.dimensions.at(-1)!.isDefault).toBe(false);
    const ids = value.dimensions.map(d => d.id).reverse();
    const reordered = await mutate('reorder_flavor_dimensions', {
      expectedVersion: result.result.version,
      ids,
    });
    const after = reordered.result.value as {
      dimensions: Array<{ id: string; isDefault: boolean }>;
    };
    expect(after.dimensions.map(d => d.id)).toEqual(ids);
    expect(after.dimensions.find(d => d.id === 'acidity')!.isDefault).toBe(
      true
    );
  });
  it('requires deletion preview for roasters and preserves unrelated roasters', async () => {
    const period = {
      light: { startDay: 1, endDay: 10 },
      medium: { startDay: 1, endDay: 10 },
      dark: { startDay: 1, endDay: 10 },
    };
    const before = await read('list_roaster_configs');
    const result = await mutate('upsert_roaster_config', {
      expectedVersion: before.version,
      roasterName: 'R',
      flavorPeriod: period,
    });
    await expect(
      mutate('delete_roaster_config', {
        expectedVersion: result.result.version,
        id: 'R',
        confirmationToken: 'x'.repeat(64),
      })
    ).rejects.toThrow('preview');
    const preview = await read('preview_delete_preferences_item', {
      kind: 'roaster_config',
      id: 'R',
    });
    await mutate('delete_roaster_config', {
      expectedVersion: preview.version,
      id: 'R',
      confirmationToken: preview.confirmationToken,
    });
    expect((await read('list_roaster_configs')).items).toEqual([]);
  });
  it('renames roaster atomically across beans, notes, grinder history and configs', async () => {
    await saveCoffeeBean(db.driver, {
      id: 'bean-a',
      name: 'A',
      roaster: 'Old',
      capacity: '100',
      remaining: '80',
      timestamp: 1,
      beanState: 'roasted',
    });
    await saveBrewingNote(db.driver, {
      id: 'note-a',
      timestamp: 1,
      rating: 0,
      notes: '',
      taste: {},
      beanId: 'bean-a',
      coffeeBeanInfo: { name: 'A', roaster: 'Old' },
    } as BrewingNote);
    await upsertGrinders(db.driver, [
      {
        id: 'grinder-a',
        name: 'G',
        grindSizeHistory: [
          { grindSize: '12', timestamp: 1, coffeeBeanRoaster: 'Old' },
        ],
      },
    ]);
    const settings = (await getAppSettings(db.driver))!;
    settings.roasterConfigs = [
      { roasterName: 'Old', logoData: 'private-image', updatedAt: 1 },
    ];
    await saveAppSettings(db.driver, settings);
    const preview = await read('preview_roaster_rename', {
      fromName: 'Old',
      toName: 'New',
    });
    expect(preview.impact).toEqual({
      beans: 1,
      notes: 1,
      grinders: 1,
      configurations: 1,
    });
    const result = await mutate('rename_roaster', {
      fromName: 'Old',
      toName: 'New',
      expectedVersion: preview.version,
      confirmationToken: preview.confirmationToken,
    });
    expect(result.result.renamed).toBe(true);
    expect((await listCoffeeBeans(db.driver))[0].roaster).toBe('New');
    expect((await listBrewingNotes(db.driver))[0].coffeeBeanInfo!.roaster).toBe(
      'New'
    );
    expect(
      (await listGrinders(db.driver))[0].grindSizeHistory![0].coffeeBeanRoaster
    ).toBe('New');
    const after = (await getAppSettings(db.driver))!;
    expect(after.roasterConfigs![0]).toMatchObject({
      roasterName: 'New',
      logoData: 'private-image',
    });
    expect(JSON.stringify(result.changes)).not.toContain('private-image');
    expect(JSON.stringify(result.changes)).not.toContain('must-never-leak');
  });
  it('rejects roaster rename if a dependent record changed after preview', async () => {
    await saveCoffeeBean(db.driver, {
      id: 'bean-a',
      name: 'A',
      roaster: 'Old',
      capacity: '100',
      remaining: '80',
      timestamp: 1,
    });
    const preview = await read('preview_roaster_rename', {
      fromName: 'Old',
      toName: 'New',
    });
    await saveCoffeeBean(db.driver, {
      id: 'bean-a',
      name: 'A',
      roaster: 'Old',
      capacity: '100',
      remaining: '70',
      timestamp: 2,
    });
    await expect(
      mutate('rename_roaster', {
        fromName: 'Old',
        toName: 'New',
        expectedVersion: preview.version,
        confirmationToken: preview.confirmationToken,
      })
    ).rejects.toThrow('changed');
    expect((await listCoffeeBeans(db.driver))[0].roaster).toBe('Old');
  });
  it('supports nested business settings with canonical dosage normalization', async () => {
    const before = await read('get_preferences');
    const flavorPeriod = {
      light: { startDay: 3, endDay: 20 },
      medium: { startDay: 2, endDay: 15 },
      dark: { startDay: 1, endDay: 10 },
    };
    const result = await mutate('update_preferences', {
      expectedVersion: before.version,
      patch: {
        customFlavorPeriod: flavorPeriod,
        estimatedCupDoseSettings: { filter: 15.55, espresso: 18, omni: 16 },
        showCapacityAdjustmentRecords: true,
        enableGreenBeanInventory: true,
      },
    });
    expect(
      (result.result.value as Record<string, unknown>).estimatedCupDoseSettings
    ).toEqual({ filter: 15.6, espresso: 18, omni: 16 });
    expect((await read('get_statistics')).estimatedCups).toBe(5);
    await expect(
      mutate('update_preferences', {
        expectedVersion: result.result.version,
        patch: {
          customFlavorPeriod: {
            ...flavorPeriod,
            dark: { startDay: 20, endDay: 1 },
          },
        },
      })
    ).rejects.toThrow('startDay');
    await expect(
      mutate('update_preferences', {
        expectedVersion: result.result.version,
        patch: {
          estimatedCupDoseSettings: { filter: 0, espresso: 18, omni: 15 },
        },
      })
    ).rejects.toThrow();
  });
  it('invalidates old delete and rename previews at full-data reset boundary', async () => {
    const before = await read('list_bean_groups');
    const result = await mutate('create_bean_group', {
      expectedVersion: before.version,
      name: 'Reset group',
    });
    const id = (result.result.items as Array<{ id: string }>)[0].id;
    const deletion = await read('preview_delete_preferences_item', {
      kind: 'group',
      id,
    });
    await saveCoffeeBean(db.driver, {
      id: 'bean-a',
      name: 'A',
      roaster: 'Old',
      timestamp: 1,
      capacity: '100',
      remaining: '80',
    });
    const rename = await read('preview_roaster_rename', {
      fromName: 'Old',
      toName: 'New',
    });
    await clearMcpLocalHistory(db.driver);
    await expect(
      mutate('delete_bean_group', {
        id,
        expectedVersion: deletion.version,
        confirmationToken: deletion.confirmationToken,
      })
    ).rejects.toThrow('preview');
    await expect(
      mutate('rename_roaster', {
        fromName: 'Old',
        toName: 'New',
        expectedVersion: rename.version,
        confirmationToken: rename.confirmationToken,
      })
    ).rejects.toThrow('Preview');
  });
  it('hashes private logo merge inputs without exposing them in rename preview', async () => {
    const settings = (await getAppSettings(db.driver))!;
    settings.roasterConfigs = [
      { roasterName: 'Old', updatedAt: 1, logoData: 'before' },
    ];
    await saveAppSettings(db.driver, settings);
    const preview = await read('preview_roaster_rename', {
      fromName: 'Old',
      toName: 'New',
    });
    expect(JSON.stringify(preview)).not.toContain('before');
    settings.roasterConfigs[0].logoData = 'after';
    await saveAppSettings(db.driver, settings);
    await expect(
      mutate('rename_roaster', {
        fromName: 'Old',
        toName: 'New',
        expectedVersion: preview.version,
        confirmationToken: preview.confirmationToken,
      })
    ).rejects.toThrow('changed');
  });
  it('normalizes preset order and rating granularity as the settings UI does', async () => {
    const before = await read('get_preferences');
    let result = await mutate('update_preferences', {
      expectedVersion: before.version,
      patch: {
        decrementPresets: [20, 15.11, 15.1],
        greenBeanRoastPresets: [200, 50, 200],
        flavorRatingHalfStep: true,
      },
    });
    expect(result.result.value).toMatchObject({
      decrementPresets: [15.1, 20],
      greenBeanRoastPresets: [50, 200],
      flavorRatingHalfStep: true,
      flavorRatingTenthStep: false,
    });
    result = await mutate('update_preferences', {
      expectedVersion: result.result.version,
      patch: { flavorRatingTenthStep: true },
    });
    expect(result.result.value).toMatchObject({
      flavorRatingHalfStep: false,
      flavorRatingTenthStep: true,
    });
    for (const patch of [
      { flavorRatingHalfStep: true, flavorRatingTenthStep: true },
      { decrementPresets: [0.001] },
      { notesMaxLines: 6 },
      { notesMaxLines: 100 },
      { textZoomLevel: 0.79 },
      { textZoomLevel: 1.21 },
    ]) {
      await expect(
        mutate('update_preferences', {
          expectedVersion: result.result.version,
          patch,
        })
      ).rejects.toThrow();
    }
  });
  it('merges duplicate roaster configs with canonical target precedence', async () => {
    const settings = (await getAppSettings(db.driver))!;
    const source = {
      light: { startDay: 1, endDay: 10 },
      medium: { startDay: 1, endDay: 10 },
      dark: { startDay: 1, endDay: 10 },
    };
    const target = {
      light: { startDay: 2, endDay: 20 },
      medium: { startDay: 2, endDay: 20 },
      dark: { startDay: 2, endDay: 20 },
    };
    settings.roasterConfigs = [
      {
        roasterName: 'Old',
        logoData: 'source',
        flavorPeriod: source,
        updatedAt: 1,
      },
      {
        roasterName: 'New',
        logoData: 'target',
        flavorPeriod: target,
        updatedAt: 2,
      },
    ];
    await saveAppSettings(db.driver, settings);
    const preview = await read('preview_roaster_rename', {
      fromName: 'Old',
      toName: 'New',
    });
    await mutate('rename_roaster', {
      fromName: 'Old',
      toName: 'New',
      expectedVersion: preview.version,
      confirmationToken: preview.confirmationToken,
    });
    const configs = (await getAppSettings(db.driver))!.roasterConfigs!;
    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({
      roasterName: 'New',
      logoData: 'target',
      flavorPeriod: target,
    });
    expect(JSON.stringify(await getAppSettings(db.driver))).toContain(
      'must-never-leak'
    );
  });
  it('invalidates rename preview on newly added linked note or grinder history', async () => {
    await saveCoffeeBean(db.driver, {
      id: 'bean-a',
      name: 'A',
      roaster: 'Old',
      timestamp: 1,
    });
    const preview = await read('preview_roaster_rename', {
      fromName: 'Old',
      toName: 'New',
    });
    await upsertGrinders(db.driver, [
      {
        id: 'late-grinder',
        name: 'G',
        grindSizeHistory: [
          { grindSize: '12', timestamp: 1, coffeeBeanRoaster: 'Old' },
        ],
      },
    ]);
    await expect(
      mutate('rename_roaster', {
        fromName: 'Old',
        toName: 'New',
        expectedVersion: preview.version,
        confirmationToken: preview.confirmationToken,
      })
    ).rejects.toThrow('changed');
    const again = await read('preview_roaster_rename', {
      fromName: 'Old',
      toName: 'New',
    });
    await saveBrewingNote(db.driver, {
      id: 'late-note',
      timestamp: 1,
      notes: '',
      rating: 0,
      taste: {},
      beanId: 'bean-a',
      coffeeBeanInfo: { name: 'A', roaster: 'Old', roastLevel: 'Medium' },
    } as BrewingNote);
    await expect(
      mutate('rename_roaster', {
        fromName: 'Old',
        toName: 'New',
        expectedVersion: again.version,
        confirmationToken: again.confirmationToken,
      })
    ).rejects.toThrow('changed');
  });
  it('supports all ordinary settings families and safe clear while preserving unrelated values', async () => {
    const before = await read('get_preferences');
    const patch = {
      username: 'Local display',
      showUpdatePrompt: false,
      showBeanReadyReminderPopup: false,
      enableBeanPrint: true,
      artisticShareRatingStyle: 'dots',
      artisticShareTags: '#coffee',
      autoFillRecognitionImage: false,
      showEstateField: true,
      immersiveAdd: true,
      experimentalBeanSharePackageEnabled: true,
      showMenuBarIcon: false,
      showCoffeeBeanSelectionStep: false,
      showBrewingVisualizer: false,
      roasterFieldEnabled: false,
      roasterSeparator: '/',
      layoutSettings: {
        dataFontSize: '3xl',
        stepDisplayMode: 'time',
      },
      safeAreaMargins: { top: 20, bottom: 30 },
      navigationSettings: {
        visibleTabs: { brewing: false, coffeeBean: true, notes: false },
        coffeeBeanViews: { ranking: false },
        pinnedViews: ['stats'],
      },
      randomCoffeeBeans: {
        enableLongPressRandomType: true,
        defaultRandomType: 'filter',
        flavorPeriodRanges: {
          aging: false,
          optimal: true,
          decline: false,
          frozen: false,
          inTransit: false,
          unknown: false,
        },
      },
      beanFieldConfig: {
        version: 1,
        fields: [{ id: 'country', enabled: true, order: 0 }],
      },
    };
    let result = await mutate('update_preferences', {
      expectedVersion: before.version,
      patch,
    });
    expect(result.result.value).toMatchObject({
      ...patch,
      beanFieldConfig: {
        version: 1,
        fields: expect.arrayContaining([
          { id: 'country', enabled: true, order: 0 },
        ]),
      },
    });
    result = await mutate('update_preferences', {
      expectedVersion: result.result.version,
      patch: {
        layoutSettings: { dataFontSize: '4xl' },
        navigationSettings: { visibleTabs: { notes: true } },
      },
    });
    expect(result.result.value).toMatchObject({
      layoutSettings: {
        dataFontSize: '4xl',
        stepDisplayMode: 'time',
      },
      navigationSettings: {
        visibleTabs: { brewing: false, coffeeBean: true, notes: true },
      },
    });
    const cleared = await mutate('update_preferences', {
      expectedVersion: result.result.version,
      clearFields: Object.keys(patch),
    });
    for (const key of Object.keys(patch))
      expect(cleared.result.value).not.toHaveProperty(key);
    expect(JSON.stringify(await getAppSettings(db.driver))).toContain(
      'must-never-leak'
    );
  });
  it('rejects ambiguous/unsafe clear and invalid nested business configuration', async () => {
    const { version } = await read('get_preferences');
    for (const args of [
      {},
      { clearFields: ['s3Sync'] },
      { patch: { username: 'A' }, clearFields: ['username'] },
      {
        patch: {
          navigationSettings: {
            visibleTabs: { brewing: false, coffeeBean: false, notes: false },
          },
        },
      },
      {
        patch: {
          beanFieldConfig: {
            version: 1,
            fields: [
              { id: 'country', enabled: true, order: 0 },
              { id: 'country', enabled: false, order: 1 },
            ],
          },
        },
      },
      { patch: { safeAreaMargins: { top: 9, bottom: 20 } } },
      { patch: { layoutSettings: { progressBarHeight: 12 } } },
      { patch: { experimentalBeanRecognitionEnabled: true } },
    ])
      await expect(
        mutate('update_preferences', { expectedVersion: version, ...args })
      ).rejects.toThrow();
  });
  it('never leaks unknown nested preference extensions in read or audit snapshots', async () => {
    const settings = (await getAppSettings(db.driver))!;
    settings.layoutSettings = {
      dataFontSize: '3xl',
      credential: 'hidden-nested-token',
    } as AppSettings['layoutSettings'];
    await saveAppSettings(db.driver, settings);
    const before = await read('get_preferences');
    expect(JSON.stringify(before)).not.toContain('hidden-nested-token');
    const result = await mutate('update_preferences', {
      expectedVersion: before.version,
      patch: { showFlowRate: true },
    });
    expect(JSON.stringify(result.changes)).not.toContain('hidden-nested-token');
    expect(JSON.stringify(await getAppSettings(db.driver))).toContain(
      'hidden-nested-token'
    );
  });
});
