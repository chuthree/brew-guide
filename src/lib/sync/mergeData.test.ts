import { describe, expect, it, vi } from 'vitest';
import { syncDataEqual, mergeSyncData, parseSyncDocument } from './mergeData';

const bean = (id: string, name = id) => ({ id, name });
const data = (coffeeBeans: ReturnType<typeof bean>[]) => ({ coffeeBeans });

describe('cloud three-way merge', () => {
  it('merges independent additions and edits without a clock-based winner', () => {
    const result = mergeSyncData(
      data([bean('a'), bean('b')]),
      data([bean('a', 'local'), bean('b'), bean('c')]),
      data([bean('a'), bean('b', 'remote'), bean('d')])
    );
    expect(result.conflicts).toEqual([]);
    expect(result.data.coffeeBeans).toEqual([
      bean('a', 'local'),
      bean('b', 'remote'),
      bean('c'),
      bean('d'),
    ]);
  });

  it('propagates deletion only with a common baseline', () => {
    expect(
      mergeSyncData(data([bean('a')]), data([]), data([bean('a')])).data
    ).toEqual(data([]));
    expect(mergeSyncData(undefined, data([]), data([bean('a')])).data).toEqual(
      data([bean('a')])
    );
  });

  it('reports edit/edit and edit/delete conflicts at record level', () => {
    const base = data([bean('a')]);
    expect(
      mergeSyncData(
        base,
        data([bean('a', 'local')]),
        data([bean('a', 'remote')])
      ).conflicts
    ).toEqual(['coffeeBeans[a]']);
    expect(
      mergeSyncData(base, data([]), data([bean('a', 'remote')])).conflicts
    ).toEqual(['coffeeBeans[a]']);
    expect(
      mergeSyncData(undefined, data([bean('a')]), data([bean('a', 'remote')]))
        .conflicts
    ).toEqual(['coffeeBeans[a]']);
  });

  it('accepts identical edits and ignores object property order', () => {
    expect(syncDataEqual({ id: 'a', name: 'b' }, { name: 'b', id: 'a' })).toBe(
      true
    );
    expect(
      mergeSyncData(
        data([bean('a')]),
        data([bean('a', 'same')]),
        data([bean('a', 'same')])
      ).conflicts
    ).toEqual([]);
  });

  it.each([
    [null, undefined],
    [0, false],
    [1, '1'],
    [{ value: undefined }, {}],
    [
      [1, 2],
      [2, 1],
    ],
    [[], {}],
    [{ value: null }, { value: false }],
  ])(
    'keeps distinct JSON values and missing fields distinct',
    (left, right) => {
      expect(syncDataEqual(left, right)).toBe(false);
      expect(syncDataEqual(right, left)).toBe(false);
    }
  );

  it('compares image-heavy records without allocating serialized copies', () => {
    const image = 'data:image/jpeg;base64,' + 'a'.repeat(3 * 1024 * 1024);
    const base = { coffeeBeans: [{ ...bean('a'), image }] };
    const local = { coffeeBeans: [{ image, ...bean('a') }] };
    const remote = { coffeeBeans: [{ ...bean('a'), image }] };
    const stringify = vi.spyOn(JSON, 'stringify').mockImplementation(() => {
      throw new Error('Sync comparisons must not serialize image payloads');
    });
    let result;
    try {
      result = mergeSyncData(base, local, remote);
    } finally {
      stringify.mockRestore();
    }
    expect(result.conflicts).toEqual([]);
    expect(result.data).toBe(local);
  });

  it('merges methods by ID within each equipment', () => {
    const base = { customMethodsByEquipment: { v60: [bean('a')] } };
    const local = { customMethodsByEquipment: { v60: [bean('a'), bean('b')] } };
    const remote = {
      customMethodsByEquipment: { v60: [bean('a'), bean('c')] },
    };
    expect(mergeSyncData(base, local, remote).data).toEqual({
      customMethodsByEquipment: { v60: [bean('a'), bean('b'), bean('c')] },
    });
  });

  it('rejects incomplete, duplicate-ID and invalid documents before writes', () => {
    expect(() => parseSyncDocument('{"data":{}}')).toThrow('缺少');
    const document = {
      data: {
        coffeeBeans: [bean('a'), bean('a')],
        brewingNotes: [],
        grinders: [],
        customEquipments: [],
      },
    };
    expect(() => parseSyncDocument(JSON.stringify(document))).toThrow('重复');
    expect(() => parseSyncDocument('{"data":[]}')).toThrow('格式无效');
  });

  it('excludes local connection credentials and device display settings', () => {
    const parsed = parseSyncDocument(
      JSON.stringify({
        data: {
          coffeeBeans: [],
          brewingNotes: [],
          grinders: [],
          customEquipments: [],
          brewGuideSettings: {
            s3Sync: { secretAccessKey: 'secret' },
            activeSyncType: 's3',
            textZoomLevel: 2,
            theme: 'dark',
          },
        },
      })
    );
    expect(parsed.data.brewGuideSettings).toEqual({ theme: 'dark' });
  });
});
