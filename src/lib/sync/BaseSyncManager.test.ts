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

  it.each([true, false])(
    'uses the verified lock fallback and only advances on success (%s)',
    async success => {
      const { client } = setup();
      const uploadFileWithLock = vi.fn().mockResolvedValue(success);
      const manager = new Manager({ ...client, uploadFileWithLock });
      client.readSyncFile.mockResolvedValue({
        content: document('base'),
        etag: '"v1"',
      });
      manager.local = document('local');
      expect((await manager.sync()).success).toBe(success);
      expect(uploadFileWithLock).toHaveBeenCalledWith(
        'brew-guide-data.json',
        expect.any(String),
        '"v1"',
        expect.stringContaining('.brew-guide-sync-check-')
      );
      expect(
        client.uploadFile.mock.calls.some(
          ([key]) => key === 'brew-guide-data.json'
        )
      ).toBe(false);
      expect(mocks.set).toHaveBeenCalledTimes(success ? 1 : 0);
    }
  );

  it('routes first creation through locks and preserves unlock warnings after a successful commit', async () => {
    const { client } = setup();
    mocks.get.mockResolvedValue(null);
    client.readSyncFile.mockResolvedValue(null);
    client.deleteFile.mockResolvedValue(true);
    const uploadFileWithLock = vi.fn().mockImplementation(async () => {
      client.getLastDiagnostic.mockReturnValue({
        operation: 'unlock',
        error: '等待锁过期',
        status: 500,
      });
      return true;
    });
    const manager = new Manager({ ...client, uploadFileWithLock });
    const result = await manager.sync();
    expect(result.success).toBe(true);
    expect(result.warnings).toContain('等待锁过期');
    expect(uploadFileWithLock).toHaveBeenCalledWith(
      'brew-guide-data.json',
      expect.any(String),
      null,
      expect.any(String)
    );
    expect(mocks.set).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to locks on authentication or transport failures', async () => {
    const { client } = setup();
    client.readSyncFile.mockResolvedValue({
      content: document('base'),
      etag: '"v1"',
    });
    client.uploadFile.mockImplementation(
      async (_key, _content, etag) => etag === undefined
    );
    client.getLastDiagnostic.mockReturnValue({ status: 403 });
    const uploadFileWithLock = vi.fn();
    const manager = new Manager({ ...client, uploadFileWithLock });
    manager.local = document('local');
    expect((await manager.sync()).success).toBe(false);
    expect(uploadFileWithLock).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
