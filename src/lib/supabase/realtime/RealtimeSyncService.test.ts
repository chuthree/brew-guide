import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, handleRemoteChangeMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  handleRemoteChangeMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('./handlers', async importOriginal => {
  const actual = await importOriginal<typeof import('./handlers')>();

  return {
    ...actual,
    remoteChangeHandler: { handleChange: handleRemoteChangeMock },
  };
});

import { RealtimeSyncService } from './RealtimeSyncService';

type RealtimeSyncServiceTestAccess = {
  client: unknown;
  setupRealtimeChannel: () => Promise<void>;
  updatePendingCount: () => Promise<void>;
  performBackgroundSync: (...args: unknown[]) => Promise<void>;
  handleRemoteChange: (table: string, payload: never) => Promise<void>;
};

describe('RealtimeSyncService.connect', () => {
  let service: RealtimeSyncService;
  let serviceTestAccess: RealtimeSyncServiceTestAccess;

  beforeEach(async () => {
    service = RealtimeSyncService.getInstance();
    await service.disconnect();
    serviceTestAccess = service as unknown as RealtimeSyncServiceTestAccess;
    createClientMock.mockReturnValue({});
    serviceTestAccess.setupRealtimeChannel = vi
      .fn()
      .mockResolvedValue(undefined);
    serviceTestAccess.updatePendingCount = vi.fn().mockResolvedValue(undefined);
    serviceTestAccess.performBackgroundSync = vi
      .fn()
      .mockResolvedValue(undefined);
    handleRemoteChangeMock.mockReset();
  });

  afterEach(async () => {
    await service.disconnect();
    createClientMock.mockReset();
  });

  it('shares an in-flight connection attempt for the same config', async () => {
    let releaseSubscription!: () => void;
    const subscriptionReady = new Promise<void>(resolve => {
      releaseSubscription = resolve;
    });
    serviceTestAccess.setupRealtimeChannel = vi
      .fn()
      .mockReturnValue(subscriptionReady);

    const config = {
      url: 'https://example.supabase.co',
      anonKey: 'test-publishable-key',
      enableOfflineQueue: true,
    };

    const firstConnection = service.connect(config);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(serviceTestAccess.client).not.toBeNull();
    expect(service.getState().connectionStatus).toBe('connecting');

    const secondConnection = service.connect(config);

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(serviceTestAccess.setupRealtimeChannel).toHaveBeenCalledTimes(1);

    releaseSubscription();

    await expect(
      Promise.all([firstConnection, secondConnection])
    ).resolves.toEqual([true, true]);

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(serviceTestAccess.setupRealtimeChannel).toHaveBeenCalledTimes(1);
  });

  it('serializes remote changes from different tables', async () => {
    let releaseFirstChange!: () => void;
    let markFirstStarted!: () => void;
    const firstChangeStarted = new Promise<void>(resolve => {
      markFirstStarted = resolve;
    });
    const firstChangeGate = new Promise<void>(resolve => {
      releaseFirstChange = resolve;
    });
    const startedTables: string[] = [];

    handleRemoteChangeMock.mockImplementation(async table => {
      startedTables.push(table);
      if (table === 'coffee_beans') {
        markFirstStarted();
        await firstChangeGate;
      }
      return false;
    });

    const beanChange = serviceTestAccess.handleRemoteChange(
      'coffee_beans',
      {} as never
    );
    await firstChangeStarted;
    const noteChange = serviceTestAccess.handleRemoteChange(
      'brewing_notes',
      {} as never
    );

    expect(startedTables).toEqual(['coffee_beans']);

    releaseFirstChange();
    await Promise.all([beanChange, noteChange]);

    expect(startedTables).toEqual(['coffee_beans', 'brewing_notes']);
    expect(handleRemoteChangeMock).toHaveBeenCalledTimes(2);
  });
});
