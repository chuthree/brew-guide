import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));
vi.mock('@capacitor-community/safe-area', () => ({
  SafeArea: {},
  initialize: vi.fn(),
}));
import { SafeAreaManager } from './safeArea';
afterEach(() => vi.unstubAllGlobals());

describe('standalone safe area', () => {
  it.each([true, false])(
    'uses the system top inset only in standalone=%s',
    standalone => {
      const setProperty = vi.fn();
      vi.stubGlobal('document', {
        documentElement: { style: { setProperty } },
      });
      vi.stubGlobal('window', {
        innerWidth: 390,
        matchMedia: () => ({ matches: standalone }),
      });
      vi.stubGlobal('navigator', { standalone });
      SafeAreaManager.setupSafeAreaVariables({ top: 42, bottom: 42 });
      expect(setProperty).toHaveBeenCalledWith(
        '--safe-area-top',
        standalone ? 'max(env(safe-area-inset-top, 0px), 42px, 12px)' : '42px'
      );
      expect(setProperty).toHaveBeenCalledWith('--safe-area-bottom', '42px');
    }
  );
});
