import { describe, expect, it } from 'vitest';
import {
  normalizeBrewingNoteSelection,
  getNoteEspressoMeasurements,
  isCoffeeOnlyNoteParams,
  getNoteEspressoParamParts,
  noteEquipmentFilterKey,
  resolveNoteEquipmentName,
  resolveNoteMethodName,
} from './noteDisplay';

describe('note catalog display snapshots', () => {
  it('does not merge free labels with catalog identities when filtering', () => {
    const linked = noteEquipmentFilterKey({
      equipment: 'Orea',
      equipmentId: 'Orea',
    });
    const free = noteEquipmentFilterKey({
      equipment: 'Orea',
      equipmentId: null,
    });
    expect(linked).not.toBe(free);
    expect(
      noteEquipmentFilterKey({ equipment: 'Old label', equipmentId: 'Orea' })
    ).toBe(linked);
    expect(
      noteEquipmentFilterKey({ equipment: 'OREA' }, value =>
        value === 'OREA' ? 'Orea' : value
      )
    ).toBe(linked);
  });
  it('preserves historical equipment and method names after rename or deletion', () => {
    const note = {
      equipment: 'custom-id',
      equipmentId: 'custom-id',
      equipmentName: 'Original brewer',
      method: 'Original recipe',
      methodName: 'Original recipe',
    };
    expect(
      resolveNoteEquipmentName(note, { 'custom-id': 'Renamed brewer' })
    ).toBe('Original brewer');
    expect(resolveNoteEquipmentName(note, {})).toBe('Original brewer');
    expect(resolveNoteMethodName(note)).toBe('Original recipe');
  });
  it('displays free labels without resolving them to later catalog entries', () => {
    expect(
      resolveNoteEquipmentName(
        { equipment: 'Orea', equipmentId: null },
        { Orea: 'Changed' }
      )
    ).toBe('Orea');
    expect(
      resolveNoteMethodName({ method: '三段式', methodName: '三段式' })
    ).toBe('三段式');
  });
  it('retains legacy lookup and unknown fallback without annotations', () => {
    expect(
      resolveNoteEquipmentName({ equipment: 'Orea' }, { Orea: 'OREA' })
    ).toBe('OREA');
    expect(
      resolveNoteEquipmentName({ equipment: 'Old custom brewer' }, {})
    ).toBe('Old custom brewer');
    expect(resolveNoteMethodName({ method: ' Old recipe ' })).toBe(
      'Old recipe'
    );
  });
  it('retains an equipment-only record without fabricating a recipe', () => {
    expect(normalizeBrewingNoteSelection({ equipment: ' Orea ' })).toEqual({
      equipment: 'Orea',
      method: undefined,
    });
  });
});

describe('espresso measured parameter display', () => {
  it('does not classify saved extraction time/yield as a coffee-only placeholder', () => {
    expect(
      isCoffeeOnlyNoteParams({
        coffee: '18g',
        extractionTime: 25,
        liquidWeight: '36g',
      })
    ).toBe(false);
    expect(isCoffeeOnlyNoteParams({ coffee: '18g', extractionTime: 25 })).toBe(
      false
    );
    expect(isCoffeeOnlyNoteParams({ coffee: '18g', liquidWeight: '36g' })).toBe(
      false
    );
    expect(isCoffeeOnlyNoteParams({ coffee: '18g' })).toBe(true);
  });
  it('shows the actual MCP time and yield without requiring old aliases', () => {
    const note = {
      params: { coffee: '18g', extractionTime: 25, liquidWeight: '36g' },
    };
    expect(getNoteEspressoParamParts(note)).toEqual(['18g', '25s', '36g']);
    expect(note.params).not.toHaveProperty('water');
    expect(note).not.toHaveProperty('totalTime');
  });
  it('prefers canonical measured fields over legacy aliases', () => {
    expect(
      getNoteEspressoMeasurements({
        params: { extractionTime: 25, liquidWeight: '36g', water: '50g' },
        totalTime: 40,
      })
    ).toEqual({ extractionTime: 25, liquidWeight: '36g' });
  });
  it('still displays historical notes and does not invent missing measurements', () => {
    expect(
      getNoteEspressoParamParts({
        params: { coffee: '18g', water: '36g' },
        totalTime: 25,
      })
    ).toEqual(['18g', '25s', '36g']);
    expect(getNoteEspressoParamParts({ params: { coffee: '18g' } })).toEqual([
      '18g',
    ]);
    expect(getNoteEspressoParamParts({})).toEqual([]);
  });
});
