import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncGrinderScale, useGrinderStore } from './grinderStore';

const mocks = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/data/repositories', () => ({
  grinderRepository: {
    save: mocks.save,
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
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'c40',
        currentGrindSize: '24',
        grindSizeHistory: [expect.objectContaining({ grindSize: '24' })],
      })
    );
  });

  it('keeps supporting grinder-name prefixed grind size values', async () => {
    const synced = await syncGrinderScale('C40 25');

    expect(synced).toBe(true);
    expect(mocks.save).toHaveBeenCalledWith(
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
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('saves the chosen quick-adjust value and settings together', async () => {
    const settings = { step: '2', max: '30' };
    await useGrinderStore.getState().saveGrinderScale('c40', '24', settings);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'c40',
        currentGrindSize: '24',
        quickAdjust: settings,
        grindSizeHistory: [expect.objectContaining({ grindSize: '24' })],
      })
    );

    await useGrinderStore
      .getState()
      .saveGrinderScale('c40', '24', { max: '40' });
    expect(
      useGrinderStore.getState().grinders[0].grindSizeHistory
    ).toHaveLength(1);
    expect(useGrinderStore.getState().grinders[0].quickAdjust).toEqual({
      max: '40',
    });
  });
});
