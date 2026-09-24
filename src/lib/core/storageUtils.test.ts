import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exportBeans: vi.fn(),
  exportNotes: vi.fn(),
  getLegacySetting: vi.fn(),
  setLegacySetting: vi.fn(),
  deleteLegacySetting: vi.fn(),
  clearBackendData: vi.fn(),
  preferencesGet: vi.fn(),
  preferencesSet: vi.fn(),
  preferencesClear: vi.fn(),
  isNativePlatform: vi.fn(() => false),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: mocks.preferencesGet,
    set: mocks.preferencesSet,
    remove: vi.fn(),
    clear: mocks.preferencesClear,
    keys: vi.fn(),
  },
}));
vi.mock('@/lib/utils/coffeeBeanUtils', () => ({
  normalizeCoffeeBeans: (beans: unknown) => beans,
}));
vi.mock('@/lib/data/repositories', () => ({
  coffeeBeanImageRepository: { exportAll: mocks.exportBeans },
  brewingNoteImageRepository: { exportAll: mocks.exportNotes },
  coffeeBeanPersistence: { clearWithImages: vi.fn() },
  brewingNotePersistence: { clearWithImages: vi.fn() },
  backendDataMaintenance: { clearAllData: mocks.clearBackendData },
  legacySettingsRepository: {
    get: mocks.getLegacySetting,
    set: mocks.setLegacySetting,
    delete: mocks.deleteLegacySetting,
  },
}));

import { StorageUtils } from './storageUtils';

describe('StorageUtils IndexedDB reads', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mocks.exportBeans.mockReset();
    mocks.exportNotes.mockReset();
    mocks.getLegacySetting.mockReset();
    mocks.setLegacySetting.mockReset();
    mocks.deleteLegacySetting.mockReset();
    mocks.clearBackendData.mockReset().mockResolvedValue(undefined);
    mocks.preferencesGet.mockReset();
    mocks.preferencesSet.mockReset();
    mocks.preferencesClear.mockReset();
    mocks.isNativePlatform.mockReturnValue(false);
  });

  it('propagates a coffee bean read failure instead of returning an empty list', async () => {
    const error = new Error('IndexedDB unavailable');
    mocks.exportBeans.mockRejectedValue(error);

    await expect(StorageUtils.getData('coffeeBeans')).rejects.toBe(error);
  });

  it('still serializes a genuinely empty coffee bean collection as an empty list', async () => {
    mocks.exportBeans.mockResolvedValue([]);

    await expect(StorageUtils.getData('coffeeBeans')).resolves.toBe('[]');
  });

  it('propagates a brewing note read failure instead of returning an empty list', async () => {
    const error = new Error('Notes store unavailable');
    mocks.exportNotes.mockRejectedValue(error);

    await expect(StorageUtils.getData('brewingNotes')).rejects.toBe(error);
  });

  it('routes custom equipment and dynamic methods through raw legacy KV values', async () => {
    const methods = '[{"id":"method-1","name":"Pulse"}]';
    const equipments = '[{"id":"custom-1","name":"Origami"}]';
    mocks.getLegacySetting.mockImplementation(async key =>
      key === 'customMethods_v60' ? methods : equipments
    );

    await expect(StorageUtils.getData('customMethods_v60')).resolves.toBe(
      methods
    );
    await expect(StorageUtils.getData('customEquipments')).resolves.toBe(
      equipments
    );
    await StorageUtils.saveData('customEquipments', '[]');
    await StorageUtils.removeData('customEquipments');

    expect(mocks.getLegacySetting).toHaveBeenCalledWith('customMethods_v60');
    expect(mocks.getLegacySetting).toHaveBeenCalledWith('customEquipments');
    expect(mocks.setLegacySetting).toHaveBeenCalledWith(
      'customEquipments',
      '[]'
    );
    expect(mocks.deleteLegacySetting).toHaveBeenCalledWith('customEquipments');
  });

  it('keeps onboarding completion on Preferences as the primary storage path', async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.preferencesGet.mockResolvedValue({ value: 'true' });

    await expect(StorageUtils.getData('onboardingCompleted')).resolves.toBe(
      'true'
    );
    await StorageUtils.saveData('onboardingCompleted', 'true');

    expect(mocks.preferencesGet).toHaveBeenCalledWith({
      key: 'onboardingCompleted',
    });
    expect(mocks.preferencesSet).toHaveBeenCalledWith({
      key: 'onboardingCompleted',
      value: 'true',
    });
    expect(mocks.getLegacySetting).not.toHaveBeenCalled();
    expect(mocks.setLegacySetting).not.toHaveBeenCalled();
  });

  it('clears backend data before native Preferences', async () => {
    const callOrder: string[] = [];
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.clearBackendData.mockImplementation(async () => {
      callOrder.push('backend');
    });
    mocks.preferencesClear.mockImplementation(async () => {
      callOrder.push('preferences');
    });

    await StorageUtils.clearAllData();

    expect(callOrder).toEqual(['backend', 'preferences']);
  });

  it('clears localStorage on web after backend data', async () => {
    const callOrder: string[] = [];
    const localStorageClear = vi.fn(() => callOrder.push('localStorage'));
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { clear: localStorageClear });
    mocks.clearBackendData.mockImplementation(async () => {
      callOrder.push('backend');
    });

    await StorageUtils.clearAllData();

    expect(callOrder).toEqual(['backend', 'localStorage']);
    expect(mocks.preferencesClear).not.toHaveBeenCalled();
  });

  it('does not clear Preferences when backend clearing fails', async () => {
    const error = new Error('backend clear failed');
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.clearBackendData.mockRejectedValue(error);

    await expect(StorageUtils.clearAllData()).rejects.toBe(error);

    expect(mocks.preferencesClear).not.toHaveBeenCalled();
  });
});
