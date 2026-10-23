import { describe, expect, it, vi } from 'vitest';
import type { CoffeeBean } from '@/types/app';

const fixture = vi.hoisted(() => ({
  beans: undefined as unknown,
  notes: undefined as unknown,
  leases: 0,
}));
vi.mock('@/lib/app/runtime', () => ({
  detectAppRuntime: () => ({
    runtime: 'capacitor',
    capacitorPlatform: 'android',
    capacitorBundled: true,
  }),
}));
vi.mock('@/lib/data/sqlite/providerSqliteDriver', () => ({
  withAndroidDatabaseMutation: async (work: () => Promise<unknown>) => {
    fixture.leases++;
    return work();
  },
}));
vi.mock('@/lib/stores/coffeeBeanStore', () => ({
  getCoffeeBeanStore: () => fixture.beans,
  increaseBeanRemaining: vi.fn(),
}));
vi.mock('@/lib/stores/brewingNoteStore', () => ({
  getBrewingNoteStore: () => fixture.notes,
}));
vi.mock('@/lib/data/repositories', () => ({
  coffeeBeanImageRepository: { mergeBean: async (bean: CoffeeBean) => bean },
  brewingNotePersistence: {},
}));
vi.mock('@/lib/notes/relatedNotes', () => ({
  getBrewingNotes: vi.fn(),
  getBrewingNoteById: vi.fn(),
}));
vi.mock('@/lib/utils/beanRepurchaseUtils', () => ({
  parseBeanName: (name: string) => ({ baseName: name }),
  getNextAvailableNumber: () => 2,
}));

import { coordinateStoreActions } from '@/lib/data/storeMutationBoundary';
import { withDataMutation } from '@/lib/data/mutationCoordinator';
import { RoastingManager } from './roastingManager';

function barrier() {
  let release!: () => void;
  const wait = new Promise<void>(resolve => {
    release = resolve;
  });
  return { release, wait };
}

describe('roasting workflow mutation ownership', () => {
  it('holds one lease through nested simple roast, stock, output bean and note publication', async () => {
    const entered = barrier(),
      resume = barrier();
    const events: string[] = [];
    let green: CoffeeBean = {
      id: 'green',
      timestamp: 1,
      name: 'Green',
      beanState: 'green',
      capacity: '100',
      remaining: '100',
    };
    fixture.beans = coordinateStoreActions(
      {
        beans: [green],
        getBeanById: () => green,
        updateBean: async (_id: string, patch: Partial<CoffeeBean>) => {
          events.push('stock:start');
          entered.release();
          await resume.wait;
          green = { ...green, ...patch };
          events.push('stock:end');
          return green;
        },
        addBean: async (bean: Partial<CoffeeBean>) => {
          events.push('roasted-bean');
          return { ...bean, id: 'roasted', timestamp: 2 } as CoffeeBean;
        },
      },
      ['updateBean', 'addBean']
    );
    fixture.notes = coordinateStoreActions(
      {
        addNote: async () => {
          events.push('roasting-note');
        },
      },
      ['addNote']
    );

    const roasting = RoastingManager.simpleRoast('green', 20);
    await entered.wait;
    const independent = withDataMutation(async () => {
      events.push('independent-write');
    });
    await Promise.resolve();
    expect(events).toEqual(['stock:start']);
    resume.release();
    const [result] = await Promise.all([roasting, independent]);
    expect(result.success).toBe(true);
    expect(green.remaining).toBe('80');
    expect(events).toEqual([
      'stock:start',
      'stock:end',
      'roasted-bean',
      'roasting-note',
      'independent-write',
    ]);
    expect(fixture.leases).toBe(2);
  });
});
