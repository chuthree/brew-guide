import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({
  runtime: 'web',
  capacitorPlatform: null as string | null,
  tauriBundled: true,
}));
vi.mock('@/lib/app/runtime', () => ({ detectAppRuntime: () => runtime }));
import { db } from '@/lib/core/db';
import { invalidateDexieBusinessHistory } from '@/lib/data/adapters/dexie/backendDataMaintenance';
import {
  configureBusinessHistoryMaintenance,
  invalidateWebBusinessHistoryInMutation,
  BUSINESS_HISTORY_INVALIDATED_EVENT,
} from './maintenance';
import { withAndroidProviderReset } from '@/lib/provider/resetBoundary';
import { withDataMutation } from '@/lib/data/mutationCoordinator';

beforeEach(async () => {
  configureBusinessHistoryMaintenance(invalidateDexieBusinessHistory);
  runtime.runtime = 'web';
  db.close();
  await Dexie.delete('BrewGuideDB');
  await db.open();
  await db.coffeeBeans.put({ id: 'bean', name: 'Before import', timestamp: 1 });
  await db.businessOperations.add({
    requestId: 'old-operation',
    tool: 'create_bean',
    argsHash: 'hash',
    result: { id: 'bean' },
    createdAt: 1,
  });
  await db.businessPublications.add({
    requestId: 'old-operation',
    changes: [{ entity: 'bean', id: 'bean', before: null, after: {} }],
    createdAt: 1,
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  db.close();
  await Dexie.delete('BrewGuideDB');
});

describe('Web business maintenance history boundary', () => {
  it('invalidates old receipts/publications without changing business records and signals session reset', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    await invalidateWebBusinessHistoryInMutation();
    expect(await db.businessOperations.count()).toBe(0);
    expect(await db.businessPublications.count()).toBe(0);
    expect(await db.coffeeBeans.count()).toBe(1);
    expect(dispatchEvent.mock.calls[0][0].type).toBe(
      BUSINESS_HISTORY_INVALIDATED_EVENT
    );
  });

  it('invalidates before destructive work even when the reset later fails', async () => {
    await expect(
      withAndroidProviderReset(async () => {
        expect(await db.businessOperations.count()).toBe(0);
        expect(await db.businessPublications.count()).toBe(0);
        throw new Error('partial reset');
      })
    ).rejects.toThrow('partial reset');
    expect(await db.businessOperations.count()).toBe(0);
  });

  it('waits for an in-flight mutation before clearing its history', async () => {
    let release!: () => void;
    const blocker = withDataMutation(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        })
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    let resetStarted = false;
    const reset = withAndroidProviderReset(async () => {
      resetStarted = true;
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(resetStarted).toBe(false);
    expect(await db.businessOperations.count()).toBe(1);
    release();
    await blocker;
    await reset;
    expect(resetStarted).toBe(true);
    expect(await db.businessOperations.count()).toBe(0);
  });

  it('does not touch IndexedDB journals for bundled native storage', async () => {
    runtime.runtime = 'tauri';
    await invalidateWebBusinessHistoryInMutation();
    expect(await db.businessOperations.count()).toBe(1);
    expect(await db.businessPublications.count()).toBe(1);
  });
});
