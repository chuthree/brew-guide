import { describe, expect, it } from 'vitest';
import {
  buildNoteReferenceCatalog,
  builtinNoteMethodId,
  resolveNoteReferences,
  type NoteReferenceCatalog,
} from './catalogReferences';
import { brewingMethods } from '@/lib/core/config';
const catalog: NoteReferenceCatalog = {
  equipment: [
    { id: 'a', name: 'Old dripper' },
    { id: 'b', name: 'Other dripper' },
  ],
  methods: [
    { equipmentId: 'a', id: 'recipe-a', name: 'Three pours' },
    { equipmentId: 'b', id: 'recipe-b', name: 'Three pours' },
  ],
};
describe('note catalog identity and historical snapshots', () => {
  it('resolves normalized labels within the chosen equipment without any recipe parameters', () => {
    expect(
      resolveNoteReferences(
        { equipment: ' old  DRIPPER ', method: 'three pours' },
        catalog
      )
    ).toEqual({
      equipment: 'a',
      equipmentId: 'a',
      equipmentName: 'Old dripper',
      method: 'Three pours',
      methodId: 'recipe-a',
      methodName: 'Three pours',
    });
  });
  it('keeps unknown labels plain and does not infer a method without an equipment', () => {
    expect(
      resolveNoteReferences(
        { equipment: 'Borrowed brewer', method: 'Three pours' },
        catalog
      )
    ).toMatchObject({
      equipmentId: null,
      equipmentName: 'Borrowed brewer',
      methodId: null,
      methodName: 'Three pours',
    });
    expect(
      resolveNoteReferences({ method: 'Three pours' }, catalog).methodId
    ).toBeNull();
  });
  it('does not choose ambiguous normalized equipment or method names', () => {
    const ambiguous = {
      equipment: [...catalog.equipment, { id: 'c', name: 'OLD DRIPPER' }],
      methods: [
        ...catalog.methods,
        { equipmentId: 'a', id: 'duplicate', name: 'THREE POURS' },
      ],
    };
    expect(
      resolveNoteReferences(
        { equipment: 'Old dripper', method: 'Three pours' },
        ambiguous
      ).equipmentId
    ).toBeNull();
    expect(
      resolveNoteReferences(
        { equipment: 'a', method: 'Three pours' },
        ambiguous
      ).methodId
    ).toBeNull();
  });
  it('explicit IDs select the correct scoped entry, with canonical names only', () => {
    expect(
      resolveNoteReferences({ equipmentId: 'a', methodId: 'recipe-a' }, catalog)
    ).toEqual({
      equipment: 'a',
      equipmentId: 'a',
      equipmentName: 'Old dripper',
      method: 'Three pours',
      methodId: 'recipe-a',
      methodName: 'Three pours',
    });
    expect(() =>
      resolveNoteReferences({ equipmentId: 'b', methodId: 'recipe-a' }, catalog)
    ).toThrow('methodId');
    expect(() =>
      resolveNoteReferences({ equipmentId: 'missing' }, catalog)
    ).toThrow('equipmentId');
  });
  it('explicit null opts out of inferred identity without adding visible text', () => {
    expect(
      resolveNoteReferences(
        { equipment: 'a', method: 'Three pours', methodId: null },
        catalog
      )
    ).toMatchObject({
      equipmentId: 'a',
      methodId: null,
      methodName: 'Three pours',
    });
    expect(
      resolveNoteReferences(
        { equipment: 'Old dripper', equipmentId: null },
        catalog
      )
    ).toMatchObject({
      equipmentId: null,
      equipment: 'Old dripper',
      equipmentName: 'Old dripper',
    });
  });
  it('ignores optional undefined reference fields from a form picker', () => {
    expect(
      resolveNoteReferences(
        {
          equipment: 'a',
          method: 'Three pours',
          equipmentId: undefined,
          methodId: undefined,
        },
        catalog
      )
    ).toMatchObject({ equipmentId: 'a', methodId: 'recipe-a' });
  });
  it('preserves snapshots and IDs during unrelated edits after catalog rename/deletion', () => {
    const old = resolveNoteReferences(
      { equipment: 'a', method: 'Three pours' },
      catalog
    );
    expect(
      resolveNoteReferences({}, { equipment: [], methods: [] }, old)
    ).toEqual(old);
    expect(
      resolveNoteReferences(
        { equipment: 'a', method: 'Three pours' },
        { equipment: [{ id: 'a', name: 'Renamed' }], methods: [] },
        old
      )
    ).toEqual(old);
  });
  it('does not retrofit an unchanged legacy or deliberately free-form note', () => {
    const legacy = { equipment: 'a', method: 'Three pours' };
    expect(resolveNoteReferences({}, catalog, legacy)).toEqual(legacy);
    const free = {
      equipment: 'a',
      method: 'Three pours',
      equipmentId: null,
      methodId: null,
      equipmentName: 'a',
      methodName: 'Three pours',
    };
    expect(resolveNoteReferences({}, catalog, free)).toEqual(free);
  });
  it('updates a selected method independently and preserves equipment history', () => {
    const old = {
      equipment: 'a',
      method: 'Old method',
      equipmentId: 'a',
      methodId: 'old-id',
      equipmentName: 'Historic name',
      methodName: 'Old method',
    };
    expect(
      resolveNoteReferences({ method: 'recipe-a' }, catalog, old)
    ).toMatchObject({
      equipmentName: 'Historic name',
      methodId: 'recipe-a',
      methodName: 'Three pours',
    });
  });
  it('clearing a method does not erase an equipment-only observation', () => {
    const old = resolveNoteReferences(
      { equipment: 'a', method: 'Three pours' },
      catalog
    );
    expect(resolveNoteReferences({ method: '' }, catalog, old)).toMatchObject({
      equipmentId: 'a',
      methodId: null,
      methodName: '',
      method: '',
    });
  });
  it('never persists index-based identity for id-less imported custom methods', () => {
    const entries = [{ equipmentId: 'a', id: null, name: 'Imported' }];
    const first = resolveNoteReferences(
      { equipment: 'a', method: 'Imported' },
      { ...catalog, methods: entries }
    );
    expect(first.methodId).toBeNull();
    expect(
      resolveNoteReferences(
        {},
        {
          ...catalog,
          methods: [{ equipmentId: 'a', id: 'later', name: 'Imported' }],
        },
        first
      )
    ).toEqual(first);
  });
  it('all current builtins have explicit permanent keys independent of array position', () => {
    for (const [equipment, methods] of Object.entries(brewingMethods)) {
      const ids = methods.map(m => builtinNoteMethodId(equipment, m.name));
      expect(ids.every(Boolean)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const builtins = buildNoteReferenceCatalog([], []);
    const selected = resolveNoteReferences(
      { equipment: 'V60', method: '三段式' },
      builtins
    );
    expect(selected.methodId).toBe('preset:V60:three-stage');
    expect(
      resolveNoteReferences(
        { equipment: 'V60', method: '三段式' },
        { ...builtins, methods: [...builtins.methods].reverse() }
      )
    ).toEqual(selected);
    expect(
      resolveNoteReferences(
        { equipmentId: 'V60', methodId: 'builtin:V60:1' },
        builtins
      )
    ).toEqual(selected);
  });
  it('does not leak stale references when equipment changes', () => {
    const old = resolveNoteReferences(
      { equipment: 'a', method: 'Three pours' },
      catalog
    );
    expect(
      resolveNoteReferences({ equipment: 'b' }, catalog, old)
    ).toMatchObject({
      equipmentId: 'b',
      methodId: 'recipe-b',
      equipmentName: 'Other dripper',
    });
  });
});
