// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(async () => {
    throw new Error('database read failed');
  }),
  diagnostics: vi.fn(async () => undefined),
  recordError: vi.fn(),
  exportFile: vi.fn(async () => undefined),
}));
vi.mock('@/lib/core/dataLayer', () => ({
  initializeDataLayer: mocks.initialize,
  getInitializationState: vi.fn(),
}));
vi.mock('@/lib/app/crashDiagnostics', () => ({
  installCrashDiagnostics: mocks.diagnostics,
  recordCrashError: mocks.recordError,
  recordCrashCheckpoint: vi.fn(),
  markCrashDiagnosticsReady: vi.fn(),
  getCurrentCrashDiagnosticSession: async () => ({ startupState: 'failed' }),
  getCrashDiagnosticReport: async () => null,
}));
vi.mock('@/lib/app/runtime', () => ({
  detectAppRuntime: () => ({ runtime: 'capacitor' }),
}));
vi.mock('@/lib/data/runtime', () => ({
  resolveStorageBackend: () => 'native-sqlite',
}));
vi.mock('@/lib/utils/jsonExport', () => ({ exportJsonFile: mocks.exportFile }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/components/common/ui/ActionDrawer', () => ({
  default: Object.assign(
    ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
      isOpen ? children : null,
    {
      Content: ({ children }: { children: React.ReactNode }) => children,
      Actions: ({ children }: { children: React.ReactNode }) => children,
      PrimaryButton: 'button',
      SecondaryButton: 'button',
    }
  ),
}));
import { DataLayerProvider } from './DataLayerProvider';

afterEach(() => {
  vi.clearAllMocks();
});

it('exports diagnostics when startup fails without mounting editable data screens', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div');
  const root = createRoot(container);
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await act(async () => {
      root.render(
        <DataLayerProvider>
          <div>editable screen</div>
        </DataLayerProvider>
      );
    });
    expect(container.textContent).toContain('无法读取本地数据');
    expect(container.textContent).not.toContain('editable screen');
    expect(mocks.diagnostics.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.initialize.mock.invocationCallOrder[0]
    );
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find(element => element.textContent === '诊断信息')!
        .click();
    });
    const button = Array.from(container.querySelectorAll('button')).find(
      element => element.textContent === '导出诊断'
    )!;
    await act(async () => {
      button.click();
    });
    expect(mocks.exportFile).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonData: expect.stringContaining('database read failed'),
      })
    );
  } finally {
    await act(async () => root.unmount());
    consoleError.mockRestore();
  }
});
