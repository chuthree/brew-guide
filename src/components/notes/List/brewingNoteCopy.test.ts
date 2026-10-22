import { describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import { createBrewingNoteCopyData } from './brewingNoteCopy';

describe('createBrewingNoteCopyData', () => {
  it('keeps other change record data while assigning a new id and timestamp', () => {
    const original: BrewingNote = {
      id: 'original-note',
      timestamp: 100,
      rating: 0,
      taste: {},
      notes: '库存变动 -16g',
      source: 'capacity-adjustment',
      beanId: 'green-bean',
      changeRecord: {
        capacityAdjustment: {
          originalAmount: 100,
          newAmount: 84,
          changeAmount: -16,
          changeType: 'decrease',
        },
      },
      image: 'must-not-copy',
    };

    const copy = createBrewingNoteCopyData(original, 200, 'copy-note');

    expect(copy).toMatchObject({
      id: 'copy-note',
      timestamp: 200,
      source: 'capacity-adjustment',
      beanId: 'green-bean',
      changeRecord: original.changeRecord,
    });
    expect(copy.id).not.toBe(original.id);
    expect(copy.image).toBeUndefined();
  });

  it('preserves stable references and historical snapshots in a copy', () => {
    const original = {
      id: 'original',
      timestamp: 1,
      rating: 0,
      taste: {},
      notes: '',
      equipment: 'deleted-id',
      equipmentId: 'deleted-id',
      equipmentName: 'Old brewer',
      method: 'Free recipe',
      methodId: null,
      methodName: 'Free recipe',
    } satisfies BrewingNote;
    expect(createBrewingNoteCopyData(original, 2, 'copy')).toMatchObject({
      equipmentId: 'deleted-id',
      equipmentName: 'Old brewer',
      methodId: null,
      methodName: 'Free recipe',
    });
  });

  it('copies espresso measured fields without manufacturing water or totalTime aliases', () => {
    const original = {
      id: 'espresso',
      timestamp: 1,
      rating: 0,
      taste: {},
      notes: '',
      equipment: 'Espresso',
      method: '浓缩',
      params: { coffee: '18g', extractionTime: 25, liquidWeight: '36g' },
    } satisfies BrewingNote;
    const copy = createBrewingNoteCopyData(original, 2, 'copy');
    expect(copy.params).toEqual(original.params);
    expect(copy.params).not.toHaveProperty('water');
    expect(copy.totalTime).toBeUndefined();
  });

  it('requires roasting records to use the inventory-aware roasting flow', () => {
    const original: BrewingNote = {
      id: 'original-note',
      timestamp: 100,
      rating: 0,
      taste: {},
      notes: '烘焙了 16g 生豆',
      source: 'roasting',
      beanId: 'green-bean',
      changeRecord: {
        roastingRecord: {
          greenBeanId: 'green-bean',
          greenBeanName: 'Codex QA green bean',
          roastedAmount: 16,
        },
      },
    };

    expect(() => createBrewingNoteCopyData(original)).toThrow(
      'Roasting records must use the roasting copy flow'
    );
  });

  it('generates an independent id when the caller does not supply one', () => {
    const copy = createBrewingNoteCopyData({
      id: 'original-note',
      timestamp: 100,
      rating: 0,
      taste: {},
      notes: '',
    });

    expect(copy.id).toEqual(expect.any(String));
    expect(copy.id).not.toBe('original-note');
  });
});
