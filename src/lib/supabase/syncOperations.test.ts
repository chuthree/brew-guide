import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchRemoteRecordsByIds, upsertRecords } from './syncOperations';

function createMockClient(options: {
  upsert?: ReturnType<typeof vi.fn>;
  maybeSingle?: ReturnType<typeof vi.fn>;
}): SupabaseClient {
  return {
    from: vi.fn(() => ({
      upsert: options.upsert,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: options.maybeSingle,
          })),
        })),
      })),
    })),
  } as unknown as SupabaseClient;
}

describe('upsertRecords', () => {
  it('uploads records one by one and reports progress after each success', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = createMockClient({ upsert });
    const progress: Array<[number, number]> = [];

    const result = await upsertRecords(
      client,
      'brewing_notes',
      Array.from({ length: 5 }, (_, index) => ({ id: String(index) })),
      record => ({
        id: record.id,
        data: record,
        updated_at: new Date(0).toISOString(),
      }),
      {
        onProgress: (uploaded, total) => progress.push([uploaded, total]),
      }
    );

    expect(result).toMatchObject({ success: true, affectedCount: 5 });
    expect(upsert).toHaveBeenCalledTimes(5);
    expect(upsert.mock.calls.map(call => call[0].id)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
    ]);
    expect(progress).toEqual([
      [1, 5],
      [2, 5],
      [3, 5],
      [4, 5],
      [5, 5],
    ]);
  });

  it('stops on the first failed record without retrying hidden batches', async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: { message: 'canceling statement due to statement timeout' },
      });
    const client = createMockClient({ upsert });

    const result = await upsertRecords(
      client,
      'brewing_notes',
      Array.from({ length: 4 }, (_, index) => ({ id: String(index) })),
      record => ({
        id: record.id,
        data: record,
        updated_at: new Date(0).toISOString(),
      })
    );

    expect(result).toMatchObject({
      success: false,
      affectedCount: 1,
      error: 'canceling statement due to statement timeout',
    });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls.map(call => call[0].id)).toEqual(['0', '1']);
  });
});

describe('fetchRemoteRecordsByIds', () => {
  it('downloads records one by one and reports progress after each success', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: 'a', data: { name: 'A' } } })
      .mockResolvedValueOnce({ data: { id: 'b', data: { name: 'B' } } })
      .mockResolvedValueOnce({ data: { id: 'c', data: { name: 'C' } } });
    const client = createMockClient({ maybeSingle });
    const progress: Array<[number, number]> = [];

    const result = await fetchRemoteRecordsByIds(
      client,
      'coffee_beans',
      ['a', 'b', 'c'],
      {
        onProgress: (downloaded, total) => progress.push([downloaded, total]),
      }
    );

    expect(result).toMatchObject({ success: true, affectedCount: 3 });
    expect(result.data?.map(record => record.id)).toEqual(['a', 'b', 'c']);
    expect(maybeSingle).toHaveBeenCalledTimes(3);
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('stops on the first failed download without reading later ids', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: 'a', data: { name: 'A' } } })
      .mockResolvedValueOnce({
        error: { message: 'server responded with a status of 500' },
      });
    const client = createMockClient({ maybeSingle });

    const result = await fetchRemoteRecordsByIds(client, 'coffee_beans', [
      'a',
      'b',
      'c',
    ]);

    expect(result).toMatchObject({
      success: false,
      affectedCount: 1,
      error: 'server responded with a status of 500',
    });
    expect(result.data?.map(record => record.id)).toEqual(['a']);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });
});
