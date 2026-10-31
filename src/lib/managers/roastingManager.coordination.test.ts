import { describe, expect, it, vi } from 'vitest';
import type { CoffeeBean } from '@/types/app';

const fixture = vi.hoisted(() => ({
  beans: undefined as unknown,
  notes: undefined as unknown,
  leases: 0,
  save: vi.fn(),
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
  roastingPersistence: { save: fixture.save },
}));
vi.mock('@/lib/notes/relatedNotes', () => ({
  getBrewingNotes: vi.fn(),
  getBrewingNoteById: vi.fn(),
}));
vi.mock('@/lib/utils/beanRepurchaseUtils', () => ({
  parseBeanName: (name: string) => ({ baseName: name }),
  getNextAvailableNumber: () => 2,
}));

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
  it('holds one lease through atomic persistence and store publication', async () => {
    const entered = barrier(),
      resume = barrier();
    const events: string[] = [];
    const green: CoffeeBean = {
      id: 'green',
      timestamp: 1,
      name: 'Green',
      beanState: 'green',
      capacity: '100',
      remaining: '100',
    };
    fixture.beans = {
      beans: [green],
      getBeanById: () => green,
      setBeans: () => events.push('beans:published'),
    };
    fixture.notes = {
      initialized: true,
      notes: [],
      setNotes: () => events.push('notes:published'),
    };
    fixture.save.mockImplementation(async () => {
      events.push('transaction:start');
      entered.release();
      await resume.wait;
      events.push('transaction:committed');
      return { beans: [{ ...green, remaining: '80' }] };
    });
    const roasting = RoastingManager.simpleRoast('green', 20);
    await entered.wait;
    const independent = withDataMutation(async () => {
      events.push('independent-write');
    });
    await Promise.resolve();
    expect(events).toEqual(['transaction:start']);
    resume.release();
    const [result] = await Promise.all([roasting, independent]);
    expect(result.success).toBe(true);
    expect(result.greenBean?.remaining).toBe('80');
    expect(events).toEqual([
      'transaction:start',
      'transaction:committed',
      'beans:published',
      'notes:published',
      'independent-write',
    ]);
    expect(fixture.leases).toBe(2);
  });
});
