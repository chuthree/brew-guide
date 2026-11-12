import { describe, expect, it } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { prepareBrewingNoteInventory } from '@/lib/notes/inventory';
import {
  analyzeHistoricalConversion,
  buildHistoricalConversionRecords,
  HistoricalConversionConflict,
} from './historicalConversion';

const bean: CoffeeBean = {
  id: 'synthetic',
  timestamp: 1,
  name: 'Synthetic',
  capacity: '100',
  remaining: '100',
  beanState: 'roasted',
};
const note = (coffee?: string): BrewingNote => ({
  id: 'synthetic-note',
  timestamp: 2,
  beanId: bean.id,
  rating: 0,
  taste: {},
  notes: 'Synthetic tasting',
  ...(coffee !== undefined && { params: { coffee } }),
});

describe('historical conversion diagnostic boundaries', () => {
  it.each(['0g', '', undefined])(
    'retains the guard for full stock and a %s note',
    coffee => {
      // The current plan has no roasted target at zero input. Removing only the
      // guard would crash during note migration; no stock or lineage is invented.
      expect(() =>
        analyzeHistoricalConversion(bean, [bean], [note(coffee)])
      ).toThrow(HistoricalConversionConflict);
    }
  );

  it.each(['15', '15g', '15 g'])(
    'accepts supported gram syntax %s at exact usage',
    coffee => {
      const graph = analyzeHistoricalConversion(
        { ...bean, remaining: '85' },
        [bean],
        [note(coffee)]
      );
      const result = buildHistoricalConversionRecords(graph, 3, () => 'new-id');
      expect(result.roasted).toMatchObject({ capacity: '15', remaining: '0' });
      expect(result.migratedNotes[0].params).toEqual({ coffee });
      expect(result.green.remaining).toBe('85');
    }
  );

  it('normalizes binary subtraction at three decimal precision', () => {
    const graph = analyzeHistoricalConversion(
      { ...bean, capacity: '0.3', remaining: '0.1' },
      [bean],
      [note('0.2g')]
    );
    expect(graph.input).toBe(0.2);
    expect(graph.usage).toBe(0.2);
  });

  it.each(['15.001g', '15.01g', '20g'])(
    'rejects unresolved excess %s without changing inputs',
    coffee => {
      const historical = { ...bean, remaining: '85' };
      const notes = [note(coffee)];
      const before = structuredClone({ historical, notes });
      expect(() =>
        analyzeHistoricalConversion(historical, [historical], notes)
      ).toThrow(HistoricalConversionConflict);
      expect({ historical, notes }).toEqual(before);
    }
  );

  it('does not infer linkage from a matching display name', () => {
    const unlinked = {
      ...note('1000g'),
      beanId: undefined,
      coffeeBeanInfo: { name: bean.name, roastLevel: '' },
    };
    expect(analyzeHistoricalConversion(bean, [bean], [unlinked]).brews).toEqual(
      []
    );
  });

  it('uses current inventory and separates change records from brew usage', () => {
    const graph = analyzeHistoricalConversion(
      { ...bean, remaining: '85' },
      [bean],
      [
        note('10g'),
        {
          ...note('999g'),
          id: 'quick',
          source: 'quick-decrement',
          quickDecrementAmount: 5,
        },
        {
          ...note(),
          id: 'adjust',
          source: 'capacity-adjustment',
          changeRecord: {
            capacityAdjustment: {
              changeAmount: 100,
              originalAmount: 0,
              newAmount: 100,
              changeType: 'set',
            },
          },
        },
      ]
    );
    expect(graph.usage).toBe(10);
    expect(graph.records).toHaveLength(2);
    expect(
      buildHistoricalConversionRecords(graph, 3, () => 'new-id').roasted
        ?.remaining
    ).toBe('5');
  });

  it.each(['1kg', '15.0001g', '-1g', '未知'])(
    'rejects unsupported or ambiguous amount %s',
    coffee => {
      expect(() =>
        analyzeHistoricalConversion(
          { ...bean, remaining: '0' },
          [bean],
          [note(coffee)]
        )
      ).toThrow();
    }
  );

  it('blocks existing roasting provenance', () => {
    expect(() =>
      analyzeHistoricalConversion(
        { ...bean, sourceGreenBeanId: 'green' },
        [bean],
        []
      )
    ).toThrow();
    expect(() =>
      analyzeHistoricalConversion(
        bean,
        [bean],
        [{ ...note(), source: 'roasting' }]
      )
    ).toThrow();
  });

  it('preserves ordinary overstock-dose data but cannot safely convert it', async () => {
    const saved = await prepareBrewingNoteInventory(
      note('101g'),
      undefined,
      async () => bean
    );
    expect(saved.beans[0].remaining).toBe('0');
    expect(saved.note?.params?.coffee).toBe('101g');
    expect(() =>
      analyzeHistoricalConversion(saved.beans[0], saved.beans, [saved.note!])
    ).toThrow(HistoricalConversionConflict);
  });
});

describe('future precision regression', () => {
  it.each(['15.01g', '15.001g', '0.001g'])(
    'a saved %s note can be converted without inventing inventory',
    async coffee => {
      const saved = await prepareBrewingNoteInventory(
        note(coffee),
        undefined,
        async () => bean
      );
      const updated = saved.beans[0] ?? bean;
      const graph = analyzeHistoricalConversion(
        updated,
        [updated],
        [saved.note!]
      );
      expect(graph.input).toBe(graph.usage);
      const result = buildHistoricalConversionRecords(graph, 3, () => 'new-id');
      expect(
        Number(result.green.remaining) + Number(result.roasted?.capacity)
      ).toBe(100);
      expect(result.roasted?.remaining).toBe('0');
    }
  );
});
