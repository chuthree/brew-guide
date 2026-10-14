import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('rejects non-desktop runtimes without invoking native storage', async () => {
  const { createTauriImageFileStore } = await import('./tauriImageFileStore');
  await expect(createTauriImageFileStore()).rejects.toThrow('requires Tauri');
  expect(mocks.invoke).not.toHaveBeenCalled();
});

it('uses opaque keys and preserves binary bytes across the desktop bridge', async () => {
  vi.stubGlobal('window', { __TAURI__: {} });
  const { createTauriImageFileStore } = await import('./tauriImageFileStore');
  const files = new Map<string, string>();
  mocks.invoke.mockImplementation(async (_name, { request }) => {
    const { operation, objectKey, data } = request;
    if (operation === 'write') files.set(objectKey, data);
    if (operation === 'read') {
      const encoded = files.get(objectKey);
      return encoded
        ? [...Uint8Array.from(atob(encoded), char => char.charCodeAt(0))]
        : undefined;
    }
    if (operation === 'exists') return files.has(objectKey);
    if (operation === 'list') return [...files.keys()];
    if (operation === 'delete') files.delete(objectKey);
  });
  const store = await createTauriImageFileStore();
  const bytes = new Uint8Array([0, 255, 128]);
  await store.write('migration_1', bytes);
  await expect(store.read('migration_1')).resolves.toEqual(bytes);
  await expect(store.exists('migration_1')).resolves.toBe(true);
  await expect(store.listObjectKeys()).resolves.toEqual(['migration_1']);
  await store.delete('migration_1');
  await expect(store.exists('migration_1')).resolves.toBe(false);
  mocks.invoke.mockClear();
  await expect(store.read('../outside')).rejects.toThrow(
    'Invalid image object key'
  );
  expect(mocks.invoke).not.toHaveBeenCalled();
});
