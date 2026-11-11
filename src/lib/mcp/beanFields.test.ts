import type { McpPermissions } from './types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import {
  getCoffeeBean,
  saveCoffeeBean,
} from '@/lib/data/sqlite/repositories/coffeeBean';
import { listBrewingNotes } from '@/lib/data/sqlite/repositories/brewingNote';
const native = vi.hoisted(() => ({
  driver: undefined as SqliteDriver | undefined,
}));
vi.mock('@/lib/data/sqlite/tauriSqliteDriver', () => ({
  openTauriSqliteDriver: async () => {
    if (!native.driver) throw new Error('Test database not initialized');
    return native.driver;
  },
}));
import { executeMcpTool } from './tools';
import { saveAppSettings } from '@/lib/data/sqlite/repositories/appSettings';
import type { AppSettings } from '@/lib/data/models';
import type { CoffeeBean } from '@/types/app';
import type { BeanFieldId } from '@/lib/coffee-beans/beanFields';
import { getBeanImportContract } from '@/lib/coffee-beans/beanImportContract';
import { MCP_TOOLS, TOOL_SCHEMAS } from './toolDefinitions';
type BeanView = {
  id: string;
  version: string;
  blendComponents?: CoffeeBean['blendComponents'];
  notes?: string;
};
type Result = { bean: BeanView; items: BeanView[] };
const permissions: McpPermissions = {
  scopes: { beans: 'edit', notes: 'edit' },
};
let seq = 0;
let db: NodeSqliteTestDatabase;
const call = async (name: string, args: Record<string, unknown>) =>
  (await executeMcpTool(name, args, permissions)) as Result;
const create = (bean: Record<string, unknown>) =>
  call('create_bean', {
    requestId: `bean-fields-${++seq}`,
    bean: { name: 'Synthetic bean', capacityGrams: 100, ...bean },
  });
const update = (bean: BeanView, changes: Record<string, unknown>) =>
  call('update_bean', {
    requestId: `bean-fields-${++seq}`,
    id: bean.id,
    expectedVersion: bean.version,
    changes,
  });
const saved = async (result: Result) =>
  (await getCoffeeBean(db.driver, result.bean.id))!;
const configure = async (ids: BeanFieldId[]) =>
  saveAppSettings(db.driver, {
    beanFieldConfig: {
      version: 1,
      fields: ids.map((id, order) => ({ id, enabled: true, order })),
    },
  } as AppSettings);
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
  native.driver = db.driver;
});
afterEach(async () => {
  native.driver = undefined;
  await db.close();
});
describe('MCP generic bean field configuration (real SQLite)', () => {
  it('advertises the effective import contract without exposing unrelated private settings', async () => {
    const capabilities = () =>
      executeMcpTool('get_capabilities', {}, permissions) as Promise<{
        beanInput: ReturnType<typeof getBeanImportContract>;
      }>;
    const initial = await capabilities();
    expect(initial.beanInput).toMatchObject(getBeanImportContract());
    expect(
      initial.beanInput.fieldConfig.fields
        .filter(field => field.enabled)
        .map(field => field.id)
    ).toEqual(['origin', 'process', 'variety']);

    const settings = {
      beanFieldConfig: {
        version: 1,
        fields: ['country', 'region', 'process', 'variety'].map(
          (id, order) => ({
            id,
            enabled: true,
            order,
          })
        ),
      },
      experimentalBeanRecognitionApiKey: 'synthetic-secret-must-not-be-exposed',
      privateUnrecognizedSetting: 'synthetic-private-value',
    } as AppSettings & { privateUnrecognizedSetting: string };
    await saveAppSettings(db.driver, settings);
    const configured = await capabilities();
    expect(configured.beanInput).toMatchObject(getBeanImportContract(settings));
    expect(
      configured.beanInput.fieldConfig.fields
        .filter(field => field.enabled)
        .map(field => field.id)
    ).toEqual(['country', 'region', 'process', 'variety']);
    expect(configured.beanInput.importRules).not.toBe(
      initial.beanInput.importRules
    );
    expect(configured.beanInput.fields.map(field => field.id)).toContain(
      'country'
    );
    for (const response of [initial, configured]) {
      const text = JSON.stringify(response);
      expect(text).not.toContain('synthetic-secret-must-not-be-exposed');
      expect(text).not.toContain('synthetic-private-value');
      expect(text).not.toContain('experimentalBeanRecognitionApiKey');
      expect(text).not.toContain('privateUnrecognizedSetting');
    }
  });

  it('omits the bean import contract when the native connection has no bean scope', async () => {
    const capabilities = await executeMcpTool(
      'get_capabilities',
      {},
      {
        scopes: { notes: 'edit' },
      }
    );
    expect(capabilities).not.toHaveProperty('beanInput');
  });

  it('advertises canonical roast vocabulary and the import contract in native write schemas', () => {
    for (const schema of [
      TOOL_SCHEMAS.get('create_bean')!.properties!.bean,
      TOOL_SCHEMAS.get('update_bean')!.properties!.changes,
    ]) {
      for (const roastLevel of [
        '极浅烘焙',
        '浅度烘焙',
        '中浅烘焙',
        '中度烘焙',
        '中深烘焙',
        '深度烘焙',
      ])
        expect(schema.properties!.roastLevel.description).toContain(roastLevel);
      expect(schema.properties!.blendComponents.description).toContain(
        'get_capabilities.beanInput'
      );
    }
    for (const name of ['create_bean', 'update_bean']) {
      expect(MCP_TOOLS.find(tool => tool.name === name)?.description).toContain(
        'get_capabilities.beanInput.importRules'
      );
    }
  });

  it('normalizes DUFFY package fields once and preserves raw-argument idempotency', async () => {
    const args = {
      requestId: `bean-fields-${++seq}`,
      bean: {
        name: 'DUFFY',
        capacityGrams: 200,
        roastLevel: '深烘焙',
        notes:
          '包装侧面印有烘焙日期 / 产国：巴布亚新几内亚 / 产区：西部高地 / 处理法：水洗 / 品种：铁皮卡',
        blendComponents: [
          {
            country: '巴布亚新几内亚',
            region: '西部高地',
            process: '水洗',
            variety: '铁皮卡',
          },
        ],
      },
    };
    const result = await call('create_bean', args);
    const bean = await saved(result);
    expect(bean).toMatchObject({
      name: 'DUFFY',
      roastLevel: '深度烘焙',
      notes: '包装侧面印有烘焙日期',
      blendComponents: [
        {
          origin: '巴布亚新几内亚 · 西部高地',
          process: '水洗',
          variety: '铁皮卡',
        },
      ],
    });
    expect(bean.blendComponents?.[0]).not.toHaveProperty('country');
    expect(bean.blendComponents?.[0]).not.toHaveProperty('region');
    expect((await call('get_bean', { id: bean.id })).bean).toMatchObject({
      roastLevel: bean.roastLevel,
      blendComponents: bean.blendComponents,
      notes: bean.notes,
    });
    expect(await call('create_bean', args)).toMatchObject({
      bean: { id: bean.id, version: result.bean.version },
      replayed: true,
    });
    await expect(
      call('create_bean', {
        ...args,
        bean: { ...args.bean, roastLevel: '深度烘焙' },
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect((await call('list_beans', {})).items).toHaveLength(1);
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
  });

  it('keeps all three Misai blend components in their original order with percentages', async () => {
    const result = await create({
      name: 'Misai',
      blendComponents: [
        { country: '巴西', process: '日晒', percentage: 50 },
        { country: '哥伦比亚', process: '水洗', percentage: 30 },
        { country: '埃塞俄比亚', process: '厌氧日晒', percentage: 20 },
      ],
    });
    const bean = await saved(result);
    const expected = [
      { origin: '巴西', process: '日晒', percentage: 50 },
      { origin: '哥伦比亚', process: '水洗', percentage: 30 },
      { origin: '埃塞俄比亚', process: '厌氧日晒', percentage: 20 },
    ];
    expect(bean.blendComponents).toEqual(expected);
    expect(bean.notes).toBeUndefined();
    expect(
      (await call('get_bean', { id: bean.id })).bean.blendComponents
    ).toEqual(expected);
  });

  it('fills enabled country and region fields without inventing a legacy origin or duplicate notes', async () => {
    await configure(['country', 'region', 'process', 'variety']);
    const result = await create({
      name: 'DUFFY',
      roastLevel: '深烘焙',
      notes: '保留包装 / 产国：巴布亚新几内亚 / 产区：西部高地',
      blendComponents: [
        { country: '巴布亚新几内亚', region: '西部高地', process: '水洗' },
      ],
    });
    const bean = await saved(result);
    expect(bean.blendComponents).toEqual([
      { country: '巴布亚新几内亚', region: '西部高地', process: '水洗' },
    ]);
    expect(bean.roastLevel).toBe('深度烘焙');
    expect(bean.notes).toBe('保留包装');
  });

  it('keeps disabled facts in canonical notes without attribution prose or duplicate labels', async () => {
    await configure(['variety']);
    const result = await create({
      name: 'DUFFY',
      notes: '保留包装 / 产国：巴布亚新几内亚 / 产国：巴布亚新几内亚',
      blendComponents: [
        {
          country: '巴布亚新几内亚',
          region: '西部高地',
          process: '水洗',
          variety: '铁皮卡',
        },
      ],
    });
    const bean = await saved(result);
    expect(bean.blendComponents).toEqual([{ variety: '铁皮卡' }]);
    expect(bean.notes).toBe(
      '保留包装 / 产国：巴布亚新几内亚 / 产区：西部高地 / 处理法：水洗'
    );
  });

  it('normalizes explicitly replaced fields while retaining stale-version protection', async () => {
    const initial = await create({ name: 'DUFFY' });
    const updated = await update(initial.bean, {
      roastLevel: '深烘焙',
      blendComponents: [
        { country: '巴布亚新几内亚', region: '西部高地', process: '水洗' },
      ],
    });
    const bean = await saved(updated);
    expect(bean.roastLevel).toBe('深度烘焙');
    expect(bean.blendComponents).toEqual([
      { origin: '巴布亚新几内亚 · 西部高地', process: '水洗' },
    ]);
    expect(bean.notes).toBeUndefined();
    await expect(
      update(initial.bean, { roastLevel: '浅烘焙' })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await saved(updated)).toEqual(bean);
    expect((await call('get_bean', { id: bean.id })).bean.version).toBe(
      updated.bean.version
    );
  });

  it('preserves the prior roast and free notes when an unsupported roast update is replayed', async () => {
    const initial = await create({
      name: 'DUFFY',
      capacityGrams: 200,
      roastLevel: '深烘焙',
      notes: '朋友赠送，周末开封',
    });
    const before = await saved(initial);
    expect(before.roastLevel).toBe('深度烘焙');
    const args = {
      requestId: `bean-fields-${++seq}`,
      id: initial.bean.id,
      expectedVersion: initial.bean.version,
      changes: { roastLevel: 'City' },
    };
    const updated = await call('update_bean', args);
    const bean = await saved(updated);
    expect(bean).toMatchObject({
      roastLevel: '深度烘焙',
      notes: '朋友赠送，周末开封 / 烘焙度：City',
      remaining: before.remaining,
    });
    expect(updated.bean.version).not.toBe(initial.bean.version);
    expect(await call('update_bean', args)).toMatchObject({
      bean: {
        id: initial.bean.id,
        version: updated.bean.version,
        notes: bean.notes,
      },
      replayed: true,
    });
    expect(await saved(updated)).toEqual(bean);
    expect((await call('list_beans', {})).items).toHaveLength(1);
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
  });

  it('uses default enabled fields and canonical disabled-field notes without attribution prose', async () => {
    const result = await create({
      notes: 'Personal remark',
      blendComponents: [
        {
          origin: 'Kenya',
          country: 'Kenya',
          region: 'Nyeri',
          estate: 'Estate X',
          process: 'Washed',
          variety: ['SL28/34', 'Ruiru 11', 'Batian'],
        },
      ],
    });
    const bean = await saved(result);
    expect(bean.blendComponents).toEqual([
      {
        origin: 'Kenya',
        process: 'Washed',
        variety: ['SL28/34', 'Ruiru 11', 'Batian'],
      },
    ]);
    expect(bean.notes).toBe('Personal remark / 产区：Nyeri / 庄园：Estate X');
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
  });
  it('preserves explicit variety array boundaries through create/get/list readonly projections', async () => {
    const result = await create({
      blendComponents: [{ variety: ['SL28/34', 'Ruiru 11', 'Batian'] }],
    });
    const before = await saved(result);
    expect(before.blendComponents?.[0].variety).toEqual([
      'SL28/34',
      'Ruiru 11',
      'Batian',
    ]);
    expect(
      (await call('get_bean', { id: result.bean.id })).bean.blendComponents?.[0]
        .variety
    ).toEqual(['SL28/34', 'Ruiru 11', 'Batian']);
    expect(
      (await call('list_beans', {})).items[0].blendComponents?.[0].variety
    ).toEqual(['SL28/34', 'Ruiru 11', 'Batian']);
    expect(await saved(result)).toEqual(before);
  });
  it('routes disabled variety arrays into a lossless managed JSON note and restores when enabled', async () => {
    await configure(['origin', 'process']);
    let result = await create({
      notes: 'Personal remark',
      blendComponents: [
        { origin: 'Kenya', variety: ['SL28/34', 'Ruiru 11', 'Batian'] },
      ],
    });
    const disabled = await saved(result);
    expect(disabled.blendComponents).toEqual([{ origin: 'Kenya' }]);
    expect(disabled.notes).toBe(
      'Personal remark / 品种：["SL28/34","Ruiru 11","Batian"]'
    );
    await configure(['origin', 'process', 'variety']);
    result = await update(result.bean, {
      blendComponents: disabled.blendComponents,
    });
    expect((await saved(result)).blendComponents).toEqual([
      { origin: 'Kenya', variety: ['SL28/34', 'Ruiru 11', 'Batian'] },
    ]);
    expect((await saved(result)).notes).toBe('Personal remark');
  });
  it('replaces an old managed variety note while preserving unrelated free remarks', async () => {
    await configure(['origin', 'process']);
    let result = await create({
      notes: 'Personal remark',
      blendComponents: [
        { origin: 'Kenya', country: 'Kenya', variety: ['Old A', 'Old B'] },
      ],
    });
    result = await update(result.bean, {
      blendComponents: [
        { origin: 'Kenya', variety: ['SL28/34', 'Ruiru 11', 'Batian'] },
      ],
    });
    const bean = await saved(result);
    expect(bean.notes).toBe(
      'Personal remark / 品种：["SL28/34","Ruiru 11","Batian"]'
    );
    expect(bean.notes).not.toContain('Old');
    expect(bean.blendComponents).toEqual([{ origin: 'Kenya' }]);
  });
  it('unrelated name edits preserve historical roast, structured fields and remarks despite changed config', async () => {
    const initial = await create({
      notes: 'Personal remark',
      blendComponents: [{ origin: 'Kenya', variety: ['SL28/34', 'Batian'] }],
    });
    const before = {
      ...(await saved(initial)),
      roastLevel: '深烘焙',
      notes: '历史备注 / 产国：Kenya / 产国：Kenya',
    };
    await saveCoffeeBean(db.driver, before);
    await configure(['origin']);
    const current = await call('get_bean', { id: initial.bean.id });
    const after = await saved(await update(current.bean, { name: 'New name' }));
    expect(after.blendComponents).toEqual(before.blendComponents);
    expect(after.notes).toEqual(before.notes);
    expect(after.roastLevel).toBe('深烘焙');
    expect(after.name).toBe('New name');
  });
  it('keeps legacy string variety compatible without slash-based splitting', async () => {
    let result = await create({ blendComponents: [{ variety: 'SL28/34' }] });
    expect((await saved(result)).blendComponents?.[0].variety).toBe('SL28/34');
    result = await update(result.bean, {
      blendComponents: [{ variety: 'Bourbon / Caturra' }],
    });
    expect((await saved(result)).blendComponents?.[0].variety).toBe(
      'Bourbon / Caturra'
    );
  });
  it('rejects non-string array values atomically', async () => {
    await expect(
      create({ blendComponents: [{ variety: ['SL28', 42] }] })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect((await call('list_beans', {})).items).toHaveLength(0);
  });
  it('rejects ambiguous component reorder atomically and accepts explicit scoped-note remapping', async () => {
    await configure(['origin']);
    const initial = await create({
      notes: 'Personal remark',
      blendComponents: [
        { origin: 'A', variety: ['SL28/34', 'Ruiru 11'] },
        { origin: 'B', variety: ['Batian'] },
      ],
    });
    const before = await saved(initial);
    expect(before.blendComponents).toEqual([{ origin: 'A' }, { origin: 'B' }]);
    expect(before.notes).toBe(
      'Personal remark / 成分1 品种：["SL28/34","Ruiru 11"] / 成分2 品种：["Batian"]'
    );
    const reordered = [{ origin: 'B' }, { origin: 'A' }];
    await expect(
      update(initial.bean, { blendComponents: reordered })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(await saved(initial)).toEqual(before);
    expect((await call('get_bean', { id: initial.bean.id })).bean.version).toBe(
      initial.bean.version
    );
    const notes =
      'Personal remark / 成分1 品种：["Batian"] / 成分2 品种：["SL28/34","Ruiru 11"]';
    const corrected = await update(initial.bean, {
      blendComponents: reordered,
      notes,
    });
    expect((await saved(corrected)).blendComponents).toEqual(reordered);
    expect((await saved(corrected)).notes).toBe(notes);
    expect((await saved(corrected)).remaining).toBe(before.remaining);
    expect((await call('list_beans', {})).items).toHaveLength(1);
  });
});
