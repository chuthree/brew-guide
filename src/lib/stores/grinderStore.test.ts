import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncGrinderScale, useGrinderStore } from './grinderStore';

const mocks = vi.hoisted(() => ({
  put: vi.fn().mockResolvedValue(undefined),
  toArray: vi.fn().mockResolvedValue([]),
  bulkPut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/core/db', () => ({
  db: {
    grinders: {
      put: mocks.put,
      toArray: mocks.toArray,
      bulkPut: mocks.bulkPut,
    },
  },
}));

describe('syncGrinderScale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGrinderStore.setState({
      grinders: [
        {
          id: 'c40',
          name: 'C40',
          currentGrindSize: '22',
          grindSizeHistory: [],
        },
      ],
      initialized: true,
      isLoading: false,
      currentSyncState: { grinderId: null, isSyncEnabled: true },
    });
  });

  it('uses the selected grinder when the input only contains a scale', async () => {
    useGrinderStore.setState({
      currentSyncState: { grinderId: 'c40', isSyncEnabled: true },
    });

    const synced = await syncGrinderScale('24');

    expect(synced).toBe(true);
    expect(mocks.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'c40',
        currentGrindSize: '24',
        grindSizeHistory: [
          expect.objectContaining({ grindSize: '24' }),
        ],
      })
    );
  });

  it('keeps supporting grinder-name prefixed grind size values', async () => {
    const synced = await syncGrinderScale('C40 25');

    expect(synced).toBe(true);
    expect(mocks.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'c40',
        currentGrindSize: '25',
      })
    );
  });

  it('does not update grinders when sync is disabled', async () => {
    useGrinderStore.setState({
      currentSyncState: { grinderId: 'c40', isSyncEnabled: false },
    });

    const synced = await syncGrinderScale('24');

    expect(synced).toBe(false);
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
