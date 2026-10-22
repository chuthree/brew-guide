import { afterEach, describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import {
  normalizeBrewingNote,
  normalizeLegacyBrewingNote,
} from '@/lib/notes/cleanup';
import { decodeBrewingNote, encodeBrewingNote } from './codecs';
import { getBrewingNote, saveBrewingNote } from './repositories/brewingNote';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
  type NodeSqliteTestDatabase,
} from './repositories/testing/nodeSqliteTestDriver';

const legacyNote = (): BrewingNote => ({
  id: 'synthetic-note',
  timestamp: 1_792_641_600_000,
  equipment: 'custom-cone',
  method: 'Three pours',
  params: { coffee: '10g' },
  rating: 0,
  taste: {},
  notes: '',
});
const referencedNote = () => ({
  ...legacyNote(),
  equipmentId: 'custom-cone',
  methodId: 'method-stable',
  equipmentName: 'Original cone name',
  methodName: 'Original three pours',
  futureMetadata: { preserved: true },
});

let database: NodeSqliteTestDatabase | undefined;
afterEach(async () => {
  await database?.close();
  database = undefined;
});

describe('note catalog-reference serialization', () => {
  it('round-trips stable references and historical labels without supplying recipe defaults', () => {
    const note = referencedNote();
    const decoded = decodeBrewingNote(encodeBrewingNote(note).row);
    expect(decoded).toEqual(note);
    expect(decoded.params).toEqual({ coffee: '10g' });
  });

  it('distinguishes explicit free-label null references from absent legacy fields', () => {
    const free = { ...referencedNote(), equipmentId: null, methodId: null };
    expect(decodeBrewingNote(encodeBrewingNote(free).row)).toEqual(free);
    const legacy = legacyNote();
    const decoded = decodeBrewingNote(encodeBrewingNote(legacy).row);
    expect(decoded).toEqual(legacy);
    for (const key of [
      'equipmentId',
      'methodId',
      'equipmentName',
      'methodName',
    ]) {
      expect(Object.hasOwn(decoded, key)).toBe(false);
    }
  });

  it('cleanup preserves references, unknown metadata and measured params without linking legacy records', () => {
    const note = referencedNote();
    expect(normalizeBrewingNote(note)).toEqual({ changed: false, note });
    const legacy = legacyNote();
    expect(normalizeLegacyBrewingNote(legacy)).toEqual({
      changed: false,
      note: legacy,
    });
    const needsCleanup = {
      ...note,
      coffeeBean: { id: 'obsolete-cache' },
      taste: null,
    };
    const normalized = normalizeBrewingNote(
      needsCleanup as unknown as BrewingNote
    );
    expect(normalized.changed).toBe(true);
    expect(normalized.note).toEqual(note);
    expect(needsCleanup.coffeeBean).toEqual({ id: 'obsolete-cache' });
  });
});

(supportsNodeSqlite() ? describe : describe.skip)(
  'note catalog references in real SQLite',
  () => {
    it('retains labels, stable IDs and actual measurements after catalog rows are renamed and removed', async () => {
      database = await createNodeSqliteTestDatabase();
      const driver = database.driver;
      const note = referencedNote();
      await driver.transaction(async tx => {
        await tx.execute('INSERT INTO custom_equipments VALUES (?, ?)', [
          'custom-cone',
          JSON.stringify({ id: 'custom-cone', name: 'Original cone name' }),
        ]);
        await tx.execute('INSERT INTO custom_methods VALUES (?, ?, ?)', [
          'custom-cone',
          JSON.stringify([
            { id: 'method-stable', name: 'Original three pours' },
          ]),
          '{}',
        ]);
        await saveBrewingNote(tx, note);
      });
      await driver.transaction(async tx => {
        await tx.execute(
          'UPDATE custom_equipments SET record_json = ? WHERE id = ?',
          [
            JSON.stringify({ id: 'custom-cone', name: 'Renamed cone' }),
            'custom-cone',
          ]
        );
        await tx.execute('DELETE FROM custom_methods WHERE equipment_id = ?', [
          'custom-cone',
        ]);
        await tx.execute('DELETE FROM custom_equipments WHERE id = ?', [
          'custom-cone',
        ]);
      });
      expect(await getBrewingNote(driver, note.id)).toEqual(note);
      const rows = await driver.query(
        'SELECT record_json FROM brewing_notes WHERE id = ?',
        [note.id]
      );
      expect(JSON.parse(String(rows[0].record_json))).toMatchObject({
        equipmentName: 'Original cone name',
        methodName: 'Original three pours',
        params: { coffee: '10g' },
      });
    });

    it('rolls back changed references and preserves explicit null values in durable rows', async () => {
      database = await createNodeSqliteTestDatabase();
      const driver = database.driver;
      const note = { ...referencedNote(), equipmentId: null, methodId: null };
      await saveBrewingNote(driver, note);
      await expect(
        driver.transaction(async tx => {
          await saveBrewingNote(tx, {
            ...note,
            equipmentId: 'another',
            equipmentName: 'Changed',
          });
          throw new Error('synthetic transaction failure');
        })
      ).rejects.toThrow('synthetic transaction failure');
      expect(await getBrewingNote(driver, note.id)).toEqual(note);
    });
  }
);
