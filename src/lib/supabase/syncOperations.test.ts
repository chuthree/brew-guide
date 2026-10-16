import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchRemoteAllRecords,
  fetchRemoteRecordsByIds,
  upsertRecords,
} from './syncOperations';

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

function createRows(start: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const value = start + index;
    return {
      id: String(value).padStart(5, '0'),
      data: { value },
      updated_at: new Date(value).toISOString(),
      deleted_at: null,
    };
  });
}

function createPaginatedMockClient(
  pages: Array<{
    data: ReturnType<typeof createRows>;
    count: number | null;
    error?: unknown;
  }>
) {
  const range = vi.fn().mockImplementation(async () => {
    return pages.shift() || { data: [], count: 0, error: null };
  });
  const order = vi.fn(() => ({ range }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));

  return {
    client: {
      from: vi.fn(() => ({ select })),
    } as unknown as SupabaseClient,
    select,
    order,
    range,
  };
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
        error: {
          message: 'canceling statement due to statement timeout',
          code: '57014',
          details: 'statement timeout while upserting row',
          hint: 'Try a smaller payload',
        },
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
      diagnostic: {
        operation: 'upsert-record',
        table: 'brewing_notes',
        recordId: '1',
        recordIndex: 2,
        total: 4,
        affectedCount: 1,
        code: '57014',
        details: 'statement timeout while upserting row',
        hint: 'Try a smaller payload',
      },
    });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls.map(call => call[0].id)).toEqual(['0', '1']);
  });

  it('learns the required equipment_id once per batch without double-counting progress', async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({
        error: {
          code: '23502',
          message:
            'null value in column "equipment_id" of relation "custom_methods" violates not-null constraint',
        },
        status: 400,
      })
      .mockResolvedValue({ error: null, status: 201 });
    const onProgress = vi.fn();
    const result = await upsertRecords(
      createMockClient({ upsert }),
      'custom_methods',
      [{ id: 'equipment-1' }, { id: 'equipment-2' }],
      record => ({
        id: record.id,
        data: { equipmentId: record.id, methods: [] },
      }),
      { onProgress }
    );

    expect(result).toMatchObject({ success: true, affectedCount: 2 });
    expect(upsert).toHaveBeenCalledTimes(3);
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('equipment_id');
    expect(
      upsert.mock.calls.slice(1).map(call => call[0].equipment_id)
    ).toEqual(['equipment-1', 'equipment-2']);
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('reports mapping failures with the record id before uploading', async () => {
    const upsert = vi.fn();
    const client = createMockClient({ upsert });

    const result = await upsertRecords(
      client,
      'coffee_beans',
      [{ id: 'bad-record' }],
      () => ({
        id: 'bad-record',
        data: {},
        updated_at: new Date(Number.NaN).toISOString(),
      })
    );

    expect(result).toMatchObject({
      success: false,
      affectedCount: 0,
      diagnostic: {
        operation: 'map-record-for-upsert',
        table: 'coffee_beans',
        recordId: 'bad-record',
        recordIndex: 1,
        total: 1,
        affectedCount: 0,
      },
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('fetchRemoteAllRecords', () => {
  it('fetches records across Supabase 1000-row pages', async () => {
    const { client, select, order, range } = createPaginatedMockClient([
      { data: createRows(0, 1000), count: 1205 },
      { data: createRows(1000, 205), count: 1205 },
    ]);

    const result = await fetchRemoteAllRecords(
      client,
      'brewing_notes',
      'id, updated_at, deleted_at'
    );

    expect(result).toMatchObject({ success: true, affectedCount: 1205 });
    expect(result.data).toHaveLength(1205);
    expect(result.data?.at(0)?.id).toBe('00000');
    expect(result.data?.at(-1)?.id).toBe('01204');
    expect(select).toHaveBeenCalledWith('id, updated_at, deleted_at', {
      count: 'exact',
    });
    expect(order).toHaveBeenCalledWith('id', { ascending: true });
    expect(range.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('continues when the API returns fewer rows than requested but count says more exist', async () => {
    const { client, range } = createPaginatedMockClient([
      { data: createRows(0, 500), count: 1200 },
      { data: createRows(500, 500), count: 1200 },
      { data: createRows(1000, 200), count: 1200 },
    ]);

    const result = await fetchRemoteAllRecords(client, 'coffee_beans');

    expect(result).toMatchObject({ success: true, affectedCount: 1200 });
    expect(result.data).toHaveLength(1200);
    expect(range.mock.calls).toEqual([
      [0, 999],
      [500, 1499],
      [1000, 1999],
    ]);
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
        error: {
          message: 'permission denied for table coffee_beans',
          code: '42501',
          hint: 'GRANT SELECT ON public.coffee_beans TO anon;',
        },
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
      error: 'permission denied for table coffee_beans',
      diagnostic: {
        operation: 'fetch-record-by-id',
        table: 'coffee_beans',
        recordId: 'b',
        recordIndex: 2,
        total: 3,
        affectedCount: 1,
        code: '42501',
        hint: 'GRANT SELECT ON public.coffee_beans TO anon;',
      },
    });
    expect(result.data?.map(record => record.id)).toEqual(['a']);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });
});
