import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseSyncManager, type IStorageClient } from './BaseSyncManager';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  importAllData: vi.fn(),
}));
vi.mock('@/lib/core/storage', () => ({ Storage: mocks }));
vi.mock('@/lib/core/dataManager', () => ({
  DataManager: { importAllData: mocks.importAllData },
}));
vi.mock('@/lib/s3/utils', () => ({
  createFilesMetadataFromData: vi.fn().mockResolvedValue({}),
}));

const document = (name: string) =>
  JSON.stringify({
    data: {
      coffeeBeans: [{ id: 'bean', name }],
      brewingNotes: [],
      customEquipments: [],
      grinders: [],
    },
  });

class Manager extends BaseSyncManager {
  local = document('base');
  constructor(client: IStorageClient) {
    super();
    this.client = client;
    this.baselineKey = 'target';
    this.metadataManager = {
      getRemoteMetadata: vi.fn().mockResolvedValue(null),
      getLocalMetadata: vi.fn().mockResolvedValue(null),
      saveLocalMetadata: vi.fn(),
      saveRemoteMetadata: vi.fn(),
    };
  }
  async initialize() {
    return true;
  }
  getServiceName() {
    return 'test';
  }
  protected async getFileContent() {
    return this.local;
  }
}

function setup() {
  const client = {
    uploadFile: vi.fn().mockResolvedValue(true),
    readSyncFile: vi
      .fn()
      .mockResolvedValue({ content: document('remote'), etag: '"v1"' }),
    getLastDiagnostic: vi.fn().mockReturnValue({ status: 412 }),
    clearDiagnostic: vi.fn(),
    deleteFile: vi.fn(),
    listFilesSimple: vi.fn().mockResolvedValue([]),
    testConnection: vi.fn(),
    downloadFile: vi.fn(),
    copyFile: vi.fn(),
  };
  return { client, manager: new Manager(client) };
}

describe('safe cloud sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(document('base'));
    mocks.importAllData.mockResolvedValue({ success: true });
  });

  it('does not write either side or advance the baseline on conflict', async () => {
    const { client, manager } = setup();
    manager.local = document('local');
    const result = await manager.sync({ preferredDirection: 'auto' });
    expect(result.conflict).toBe(true);
    expect(client.uploadFile).not.toHaveBeenCalled();
    expect(mocks.importAllData).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('never treats a read error as an empty cloud', async () => {
    const { client, manager } = setup();
    client.readSyncFile.mockRejectedValue(new Error('HTTP 403'));
    expect((await manager.sync()).success).toBe(false);
    expect(client.uploadFile).not.toHaveBeenCalled();
  });

  it('stops before import if a recovery backup fails', async () => {
    const { client, manager } = setup();
    client.uploadFile.mockResolvedValue(false);
    expect((await manager.sync()).success).toBe(false);
    expect(mocks.importAllData).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('does not report success or advance the baseline when import fails', async () => {
    const { manager } = setup();
    mocks.importAllData.mockResolvedValue({
      success: false,
      message: '磁盘已满',
    });
    const result = await manager.sync();
    expect(result.success).toBe(false);
    expect(result.message).toContain('磁盘已满');
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('preserves the downloaded version when conditionally uploading', async () => {
    const { client, manager } = setup();
    client.readSyncFile.mockResolvedValue({
      content: document('base'),
      etag: '"v1"',
    });
    manager.local = document('local');
    client.uploadFile.mockImplementation(
      async (key: string, _content: string, expectedEtag?: string | null) =>
        key.startsWith('.brew-guide-sync-check-') && expectedEtag !== undefined
          ? false
          : true
    );
    expect((await manager.sync()).success).toBe(true);
    expect(client.uploadFile).toHaveBeenCalledWith(
      'brew-guide-data.json',
      expect.any(String),
      '"v1"'
    );
    expect(mocks.set).toHaveBeenCalledWith('target', expect.any(String));
  });

  it('refuses a server that ignores conditional headers', async () => {
    const { client, manager } = setup();
    client.readSyncFile.mockResolvedValue({
      content: document('base'),
      etag: '"v1"',
    });
    manager.local = document('local');
    expect((await manager.sync()).success).toBe(false);
    expect(
      client.uploadFile.mock.calls.some(
        ([key]) => key === 'brew-guide-data.json'
      )
    ).toBe(false);
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
