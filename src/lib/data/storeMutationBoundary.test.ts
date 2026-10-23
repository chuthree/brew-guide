import { describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ leases: 0, active: false }));
vi.mock('@/lib/app/runtime', () => ({
  detectAppRuntime: () => ({
    runtime: 'capacitor',
    capacitorPlatform: 'android',
    capacitorBundled: true,
  }),
}));
vi.mock('./sqlite/providerSqliteDriver', () => ({
  withAndroidDatabaseMutation: async (work: () => Promise<unknown>) => {
    if (native.active) throw new Error('native owner interleaved');
    native.active = true;
    native.leases++;
    try {
      return await work();
    } finally {
      native.active = false;
    }
  },
}));
import {
  coordinateStoreActions,
  callStoreActionInMutation,
} from './storeMutationBoundary';
function barrier() {
  let release!: () => void;
  const wait = new Promise<void>(resolve => {
    release = resolve;
  });
  return { release, wait };
}
describe('explicit Store mutation composition', () => {
  it('holds read/compute/write/publication against another independently invoked public action', async () => {
    const ready = barrier(),
      resume = barrier();
    const seen: string[] = [];
    let value = 0;
    const state = coordinateStoreActions(
      {
        first: async () => {
          seen.push('first:read');
          const before = value;
          ready.release();
          await resume.wait;
          value = before + 1;
          seen.push('first:publish');
        },
        second: async () => {
          seen.push('second:read');
          value += 10;
          seen.push('second:publish');
        },
      },
      ['first', 'second']
    );
    const first = state.first();
    await ready.wait;
    const second = state.second();
    await Promise.resolve();
    expect(seen).toEqual(['first:read']);
    resume.release();
    await Promise.all([first, second]);
    expect(value).toBe(11);
    expect(seen).toEqual([
      'first:read',
      'first:publish',
      'second:read',
      'second:publish',
    ]);
  });
  it('composes explicitly nested actions in one lease without allowing unrelated callers to join', async () => {
    const entered = barrier(),
      resume = barrier();
    const calls: string[] = [];
    const before = native.leases;
    const child = coordinateStoreActions(
      {
        save: async (label: string) => {
          calls.push(label);
        },
      },
      ['save']
    );
    const parent = coordinateStoreActions(
      {
        save: async () => {
          await callStoreActionInMutation(child.save, 'nested');
          entered.release();
          await resume.wait;
        },
      },
      ['save']
    );
    const outer = parent.save();
    await entered.wait;
    const independent = child.save('independent');
    await Promise.resolve();
    expect(calls).toEqual(['nested']);
    resume.release();
    await Promise.all([outer, independent]);
    expect(calls).toEqual(['nested', 'independent']);
    expect(native.leases - before).toBe(2);
  });
  it('a failed owner releases ownership and does not poison later mutations', async () => {
    const state = coordinateStoreActions(
      {
        bad: async () => {
          throw new Error('failure');
        },
        good: async () => 4,
      },
      ['bad', 'good']
    );
    await expect(state.bad()).rejects.toThrow('failure');
    await expect(state.good()).resolves.toBe(4);
    expect(native.active).toBe(false);
  });
});
