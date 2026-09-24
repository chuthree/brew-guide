import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingOperation } from './types';

const mocks = vi.hoisted(() => ({
  repository: {
    findByTarget: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    listOrdered: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('@/lib/data/repositories', () => ({
  offlineQueueRepository: mocks.repository,
}));

import { offlineQueue } from './offlineQueue';

const operation = (
  id: string,
  retryCount = 0,
  overrides: Partial<PendingOperation> = {}
): PendingOperation => ({
  id,
  table: 'coffee_beans',
  type: 'upsert',
  recordId: `bean-${id}`,
  timestamp: Number(id.replace(/\D/g, '')) || 1,
  retryCount,
  ...overrides,
});

describe('OfflineQueueManager repository behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repository.findByTarget.mockResolvedValue([]);
    mocks.repository.add.mockResolvedValue(undefined);
    mocks.repository.update.mockResolvedValue(undefined);
    mocks.repository.get.mockResolvedValue(undefined);
    mocks.repository.listOrdered.mockResolvedValue([]);
    mocks.repository.count.mockResolvedValue(0);
    mocks.repository.delete.mockResolvedValue(undefined);
    mocks.repository.clear.mockResolvedValue(undefined);
    offlineQueue.configure({ maxRetries: 3, retryInterval: 5000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds one operation for a new target', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    await offlineQueue.enqueue('coffee_beans', 'upsert', 'bean-1', {
      name: 'Ethiopia',
    });

    expect(mocks.repository.findByTarget).toHaveBeenCalledWith(
      'coffee_beans',
      'bean-1'
    );
    expect(mocks.repository.add).toHaveBeenCalledWith({
      id: expect.any(String),
      table: 'coffee_beans',
      type: 'upsert',
      recordId: 'bean-1',
      data: { name: 'Ethiopia' },
      timestamp: 1000,
      retryCount: 0,
    });
  });

  it('folds a repeat target into only the first existing operation', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const first = operation('first', 2, {
      recordId: 'bean-1',
      lastError: 'failed',
      failedAt: 1500,
    });
    const duplicate = operation('duplicate', 1, { recordId: 'bean-1' });
    mocks.repository.findByTarget.mockResolvedValue([first, duplicate]);

    await offlineQueue.enqueue('coffee_beans', 'delete', 'bean-1', {
      reason: 'removed',
    });

    expect(mocks.repository.update).toHaveBeenCalledOnce();
    expect(mocks.repository.update).toHaveBeenCalledWith('first', {
      type: 'delete',
      data: { reason: 'removed' },
      timestamp: 2000,
      retryCount: 0,
      lastError: undefined,
      failedAt: undefined,
    });
    expect(mocks.repository.add).not.toHaveBeenCalled();
    expect(mocks.repository.delete).not.toHaveBeenCalled();
  });

  it('keeps equal record ids separate across tables and distinct ids', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(3000);

    await offlineQueue.enqueue('coffee_beans', 'upsert', 'record-1');
    await offlineQueue.enqueue('brewing_notes', 'upsert', 'record-1');
    await offlineQueue.enqueue('coffee_beans', 'delete', 'record-2');

    expect(mocks.repository.findByTarget.mock.calls).toEqual([
      ['coffee_beans', 'record-1'],
      ['brewing_notes', 'record-1'],
      ['coffee_beans', 'record-2'],
    ]);
    expect(mocks.repository.add).toHaveBeenCalledTimes(3);
  });

  it('processes the ordered list supplied by the repository', async () => {
    const ordered = [operation('op-1'), operation('op-2'), operation('op-3')];
    mocks.repository.listOrdered.mockResolvedValue(ordered);
    const processed: string[] = [];

    const result = await offlineQueue.processQueue(async item => {
      processed.push(item.id);
      return true;
    });

    expect(processed).toEqual(['op-1', 'op-2', 'op-3']);
    expect(mocks.repository.delete.mock.calls).toEqual([
      ['op-1'],
      ['op-2'],
      ['op-3'],
    ]);
    expect(result).toEqual({ processed: 3, failed: 0, blocked: 0 });
  });

  it('increments retry state and sets failedAt only when the retry limit is reached', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(4000);
    mocks.repository.get
      .mockResolvedValueOnce(operation('op-1', 0))
      .mockResolvedValueOnce(operation('op-1', 2));

    await expect(
      offlineQueue.markFailed('op-1', 'temporary error')
    ).resolves.toBe(true);
    expect(mocks.repository.update).toHaveBeenNthCalledWith(1, 'op-1', {
      retryCount: 1,
      lastError: 'temporary error',
      failedAt: undefined,
    });

    await expect(
      offlineQueue.markFailed('op-1', 'still failing')
    ).resolves.toBe(false);
    expect(mocks.repository.update).toHaveBeenNthCalledWith(2, 'op-1', {
      retryCount: 3,
      lastError: 'still failing',
      failedAt: 4000,
    });
  });

  it('retains already blocked operations without invoking the processor', async () => {
    mocks.repository.listOrdered.mockResolvedValue([operation('blocked', 3)]);
    const processor = vi.fn(async () => true);

    await expect(offlineQueue.processQueue(processor)).resolves.toEqual({
      processed: 0,
      failed: 0,
      blocked: 1,
    });
    expect(processor).not.toHaveBeenCalled();
  });

  it('records a processor false result as the existing retryable failure', async () => {
    mocks.repository.listOrdered.mockResolvedValue([operation('op-1')]);
    mocks.repository.get.mockResolvedValue(operation('op-1'));

    await expect(offlineQueue.processQueue(async () => false)).resolves.toEqual(
      { processed: 0, failed: 0, blocked: 0 }
    );

    expect(mocks.repository.update).toHaveBeenCalledWith('op-1', {
      retryCount: 1,
      lastError: '同步失败，等待下次重试',
      failedAt: undefined,
    });
  });

  it('records processing failures and blocks an operation at its retry limit', async () => {
    mocks.repository.listOrdered.mockResolvedValue([operation('op-1', 2)]);
    mocks.repository.get.mockResolvedValue(operation('op-1', 2));

    await expect(
      offlineQueue.processQueue(async () => {
        throw new Error('upload failed');
      })
    ).resolves.toEqual({ processed: 0, failed: 1, blocked: 1 });

    expect(mocks.repository.update).toHaveBeenCalledWith('op-1', {
      retryCount: 3,
      lastError: 'upload failed',
      failedAt: expect.any(Number),
    });
  });

  it('clears queued records through the repository', async () => {
    await offlineQueue.clear();

    expect(mocks.repository.clear).toHaveBeenCalledOnce();
  });
});
