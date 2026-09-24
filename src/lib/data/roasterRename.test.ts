import { describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import type { AppSettings, Grinder, RoasterConfig } from '@/lib/data/models';
import type { CoffeeBean } from '@/types/app';
import { transformRoasterRenameRecords } from './roasterRename';

const oldFlavorPeriod = {
  light: { startDay: 1, endDay: 10 },
  medium: { startDay: 2, endDay: 20 },
  dark: { startDay: 3, endDay: 30 },
};

describe('transformRoasterRenameRecords', () => {
  it('preserves the current bean, note, grinder, and config rename rules', () => {
    const beans: CoffeeBean[] = [
      {
        id: 'bean-prefixed',
        timestamp: 10,
        name: 'Old Roaster Espresso',
        roaster: 'Old Roaster',
        flavor: ['chocolate'],
        brand: 'kept brand',
      },
      {
        id: 'bean-unprefixed',
        timestamp: 11,
        name: 'Washed Lot',
        roaster: 'Old Roaster',
      },
      {
        id: 'bean-untouched',
        timestamp: 12,
        name: 'Other Lot',
        roaster: 'Other Roaster',
      },
    ];
    const note: BrewingNote = {
      id: 'note-1',
      timestamp: 20,
      updatedAt: 21,
      beanId: 'bean-prefixed',
      coffeeBeanInfo: {
        name: 'Old Roaster Espresso',
        roaster: 'Old Roaster',
        roastLevel: 'medium',
      },
      image: 'inline-image',
      images: ['inline-image', 'inline-image-2'],
      rating: 4,
      taste: { sweet: 4 },
      notes: 'keep note fields',
    };
    const grinders: Grinder[] = [
      {
        id: 'grinder-1',
        name: 'C40',
        grindSizeHistory: [
          { grindSize: '20', timestamp: 1, coffeeBeanRoaster: 'Old Roaster' },
          { grindSize: '21', timestamp: 2, coffeeBeanRoaster: 'Other Roaster' },
          { grindSize: '22', timestamp: 3, coffeeBeanRoaster: 'Old Roaster' },
        ],
      },
      {
        id: 'grinder-untouched',
        name: 'K6',
        grindSizeHistory: [
          { grindSize: '30', timestamp: 4, coffeeBeanRoaster: 'Other Roaster' },
        ],
      },
    ];
    const targetConfig = {
      roasterName: 'New Roaster',
      logoData: 'target-logo',
      updatedAt: 30,
      targetOnlyField: 'target-wins',
    };
    const sourceConfig: RoasterConfig = {
      roasterName: 'Old Roaster',
      logoData: 'source-logo',
      flavorPeriod: oldFlavorPeriod,
      updatedAt: 31,
    };
    const otherConfig: RoasterConfig = {
      roasterName: 'Unchanged Roaster',
      logoData: 'other-logo',
      flavorPeriod: oldFlavorPeriod,
      updatedAt: 32,
    };
    const settings = {
      username: 'settings stay intact',
      roasterConfigs: [targetConfig, sourceConfig, otherConfig],
    } as AppSettings;

    const result = transformRoasterRenameRecords({
      beans,
      notes: [note],
      grinders,
      settings,
      renames: new Map([['Old Roaster', 'New Roaster']]),
      now: 100,
    });

    expect(result.updatedBeans).toEqual([
      {
        ...beans[0],
        name: 'Espresso',
        roaster: 'New Roaster',
        timestamp: 100,
      },
      {
        ...beans[1],
        roaster: 'New Roaster',
        timestamp: 100,
      },
    ]);
    expect(result.beans[2]).toBe(beans[2]);

    expect(result.updatedNotes).toEqual([
      {
        ...note,
        coffeeBeanInfo: {
          ...note.coffeeBeanInfo,
          name: 'Espresso',
          roaster: 'New Roaster',
        },
        updatedAt: 100,
      },
    ]);
    expect(result.updatedNotes[0].image).toBe('inline-image');
    expect(result.updatedNotes[0].images).toEqual([
      'inline-image',
      'inline-image-2',
    ]);

    expect(result.updatedGrinderCount).toBe(1);
    expect(result.grinders[0].grindSizeHistory).toEqual([
      { grindSize: '20', timestamp: 1, coffeeBeanRoaster: 'New Roaster' },
      { grindSize: '21', timestamp: 2, coffeeBeanRoaster: 'Other Roaster' },
      { grindSize: '22', timestamp: 3, coffeeBeanRoaster: 'New Roaster' },
    ]);
    expect(result.grinders[1]).toBe(grinders[1]);

    expect(result.updatedConfigCount).toBe(1);
    expect(result.settings.username).toBe(settings.username);
    expect(result.settings.roasterConfigs).toEqual([
      {
        ...targetConfig,
        flavorPeriod: oldFlavorPeriod,
        updatedAt: 100,
      },
      otherConfig,
    ]);
    expect(result.settings.roasterConfigs?.[0]).toHaveProperty(
      'targetOnlyField',
      'target-wins'
    );
  });
});
