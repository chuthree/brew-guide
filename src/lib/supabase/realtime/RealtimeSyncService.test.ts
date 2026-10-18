import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createClientMock,
  handleRemoteChangeMock,
  mergeBeanImagesMock,
  mergeNoteImagesMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  handleRemoteChangeMock: vi.fn(),
  mergeBeanImagesMock: vi.fn(),
  mergeNoteImagesMock: vi.fn(),
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

vi.mock('@/lib/data/repositories', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/data/repositories')>();

  return {
    ...actual,
    coffeeBeanImageRepository: { mergeBean: mergeBeanImagesMock },
    brewingNoteImageRepository: { mergeNote: mergeNoteImagesMock },
  };
});

import { RealtimeSyncService } from './RealtimeSyncService';

type RealtimeSyncServiceTestAccess = {
  client: unknown;
  isOnline: boolean;
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
    mergeBeanImagesMock.mockReset();
    mergeNoteImagesMock.mockReset();
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

describe('RealtimeSyncService local image uploads', () => {
  let service: RealtimeSyncService;
  let serviceTestAccess: RealtimeSyncServiceTestAccess;

  beforeEach(async () => {
    service = RealtimeSyncService.getInstance();
    await service.disconnect();
    serviceTestAccess = service as unknown as RealtimeSyncServiceTestAccess;
    serviceTestAccess.isOnline = true;
  });

  afterEach(async () => {
    await service.disconnect();
  });

  it('keeps hydrated bean images on text-only updates', async () => {
    const image = 'data:image/png;base64,bean-image';
    mergeBeanImagesMock.mockImplementation(async bean => ({
      ...bean,
      image,
    }));
    const upsert = vi.fn(async (_row: Record<string, unknown>) => ({
      error: null,
    }));
    serviceTestAccess.client = { from: vi.fn(() => ({ upsert })) };

    await service.syncLocalChange('coffee_beans', 'update', 'bean-1', {
      name: 'Renamed bean',
      timestamp: 200,
    });

    expect(mergeBeanImagesMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bean-1', name: 'Renamed bean' })
    );
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      data: { id: 'bean-1', name: 'Renamed bean', image },
    });
  });

  it('keeps hydrated note images on text-only updates', async () => {
    const images = [
      'data:image/png;base64,note-image-1',
      'data:image/png;base64,note-image-2',
    ];
    mergeNoteImagesMock.mockImplementation(async note => ({
      ...note,
      image: images[0],
      images,
    }));
    const upsert = vi.fn(async (_row: Record<string, unknown>) => ({
      error: null,
    }));
    serviceTestAccess.client = { from: vi.fn(() => ({ upsert })) };

    await service.syncLocalChange('brewing_notes', 'update', 'note-1', {
      notes: 'Updated tasting note',
      updatedAt: 200,
    });

    expect(mergeNoteImagesMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'note-1', notes: 'Updated tasting note' })
    );
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      data: {
        id: 'note-1',
        notes: 'Updated tasting note',
        image: images[0],
        images,
      },
    });
  });

  it('preserves source image values when hydration has no stored row', async () => {
    const beanImage = 'data:image/png;base64,inline-bean-image';
    const noteImages = ['data:image/png;base64,inline-note-image'];
    mergeBeanImagesMock.mockImplementation(async bean => {
      const { image: _image, backImage: _backImage, ...record } = bean;
      return record;
    });
    mergeNoteImagesMock.mockImplementation(async note => {
      const { image: _image, images: _images, ...record } = note;
      return record;
    });
    const beanUpsert = vi.fn(async (_row: Record<string, unknown>) => ({
      error: null,
    }));
    const noteUpsert = vi.fn(async (_row: Record<string, unknown>) => ({
      error: null,
    }));
    serviceTestAccess.client = {
      from: vi.fn((table: string) => ({
        upsert: table === 'coffee_beans' ? beanUpsert : noteUpsert,
      })),
    };

    await service.syncLocalChange('coffee_beans', 'update', 'bean-3', {
      name: 'Inline image remains available',
      image: beanImage,
      timestamp: 400,
    });
    await service.syncLocalChange('brewing_notes', 'update', 'note-3', {
      notes: 'Inline image remains available',
      image: noteImages[0],
      images: noteImages,
      updatedAt: 400,
    });

    expect(beanUpsert.mock.calls[0]?.[0]).toMatchObject({
      data: { image: beanImage },
    });
    expect(noteUpsert.mock.calls[0]?.[0]).toMatchObject({
      data: { image: noteImages[0], images: noteImages },
    });
  });

  it('marks images as removed when hydration confirms none remain', async () => {
    mergeBeanImagesMock.mockImplementation(async bean => ({ ...bean }));
    mergeNoteImagesMock.mockImplementation(async note => ({ ...note }));
    const beanUpsert = vi.fn(async (_row: Record<string, unknown>) => ({
      error: null,
    }));
    const noteUpsert = vi.fn(async (_row: Record<string, unknown>) => ({
      error: null,
    }));
    serviceTestAccess.client = {
      from: vi.fn((table: string) => ({
        upsert: table === 'coffee_beans' ? beanUpsert : noteUpsert,
      })),
    };

    await service.syncLocalChange('coffee_beans', 'update', 'bean-2', {
      name: 'Image removed',
      timestamp: 300,
    });
    await service.syncLocalChange('brewing_notes', 'update', 'note-2', {
      notes: 'Images removed',
      updatedAt: 300,
    });

    expect(beanUpsert.mock.calls[0]?.[0]).toMatchObject({
      data: { image: '', backImage: '' },
    });
    expect(noteUpsert.mock.calls[0]?.[0]).toMatchObject({
      data: { image: '', images: [] },
    });
  });
});
