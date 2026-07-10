import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cleanups: [] as Array<() => void>,
  getBrewingNoteImageNoteIds: vi.fn(),
  getBrewingNoteImages: vi.fn(),
}));

vi.mock('react', () => ({
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) mocks.cleanups.push(cleanup);
  },
  useMemo: <T>(factory: () => T) => factory(),
  useState: <T>(initialValue: T | (() => T)) => [
    typeof initialValue === 'function'
      ? (initialValue as () => T)()
      : initialValue,
    vi.fn(),
  ],
}));

vi.mock('@/lib/notes/imageRepository', () => ({
  getBrewingNoteImageCounts: vi.fn(),
  getBrewingNoteImageNoteIds: mocks.getBrewingNoteImageNoteIds,
  getBrewingNoteImages: mocks.getBrewingNoteImages,
}));

vi.mock('./useImageLoadGate', () => ({
  useImageLoadGate: () => ({ ref: vi.fn(), shouldLoad: false }),
}));

import {
  useBrewingNoteImageIds,
  useBrewingNoteImages,
} from './useBrewingNoteImages';

describe('useBrewingNoteImages', () => {
  beforeEach(() => {
    mocks.cleanups.length = 0;
    mocks.getBrewingNoteImageNoteIds.mockReset();
    mocks.getBrewingNoteImageNoteIds.mockResolvedValue(['note-1']);
    mocks.getBrewingNoteImages.mockReset();
    mocks.getBrewingNoteImages.mockResolvedValue(['stored-image']);
    vi.stubGlobal('window', new EventTarget());
  });

  afterEach(() => {
    mocks.cleanups.splice(0).forEach(cleanup => cleanup());
    vi.unstubAllGlobals();
  });

  it('reloads an existing note image after the note is saved', async () => {
    useBrewingNoteImages('note-1');
    useBrewingNoteImageIds(['note-1']);
    await Promise.resolve();

    const otherNoteEvent = Object.assign(
      new Event('brewingNoteDataChanged'),
      {
        detail: { action: 'update', noteId: 'note-2' },
      }
    );
    window.dispatchEvent(otherNoteEvent);
    expect(mocks.getBrewingNoteImages).toHaveBeenCalledTimes(1);
    expect(mocks.getBrewingNoteImageNoteIds).toHaveBeenCalledTimes(1);

    const event = Object.assign(new Event('brewingNoteDataChanged'), {
      detail: { action: 'update', noteId: 'note-1' },
    });
    window.dispatchEvent(event);
    await Promise.resolve();

    expect(mocks.getBrewingNoteImages).toHaveBeenCalledTimes(2);
    expect(mocks.getBrewingNoteImages).toHaveBeenNthCalledWith(2, 'note-1');
    expect(mocks.getBrewingNoteImageNoteIds).toHaveBeenNthCalledWith(2, [
      'note-1',
    ]);

    window.dispatchEvent(new Event('syncCompleted'));
    expect(mocks.getBrewingNoteImages).toHaveBeenCalledTimes(3);
    expect(mocks.getBrewingNoteImageNoteIds).toHaveBeenCalledTimes(3);
  });
});
