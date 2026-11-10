import { describe, expect, it, vi } from 'vitest';
import { readBackupStream } from './backupStream';

describe('streamed backup reader', () => {
  it('releases image-bearing records and preserves metadata, empty and absent sections', async () => {
    const beans = Array.from({ length: 5 }, (_, index) => ({
      id: String(index),
      name: '豆子☕',
      image: 'a'.repeat(100_000),
    }));
    const file = new Blob([
      JSON.stringify({
        data: {
          coffeeBeans: beans,
          brewingNotes: [],
          customPresets: { origins: ['云南'] },
        },
      }),
    ]);
    const wholeFileRead = vi
      .spyOn(file, 'text')
      .mockRejectedValue(new Error('whole-file read'));
    const events = [];
    for await (const event of readBackupStream(file)) events.push(event);
    expect(events.slice(0, 5).map(event => event.value)).toEqual(beans);
    expect(events.at(-1)).toEqual({
      section: 'document',
      value: {
        data: {
          coffeeBeans: [],
          brewingNotes: [],
          customPresets: { origins: ['云南'] },
        },
      },
    });
    expect(wholeFileRead).not.toHaveBeenCalled();
  });

  it.each([
    '{"data":{"coffeeBeans":[{"id":"a"}]',
    '{"data":{"coffeeBeans":[{"id":"a"},{"id":"a"}]}}',
    '{"data":{"coffeeBeans":{}}}',
    '{"data":{"coffeeBeans":[null]}}',
    '{"data":{"coffeeBeans":[],"coffeeBeans":[]}}',
    '{"data":{}} trailing',
    '{"data":null}',
    '{"data":{"coffeeBeans":[{"id":"a"}]},"data":{}}',
  ])('rejects malformed or ambiguous backups: %s', async json => {
    await expect(
      (async () => {
        for await (const event of readBackupStream(new Blob([json])))
          void event;
      })()
    ).rejects.toThrow();
  });

  it('stops reading before an oversized record can fill memory', async () => {
    const file = new Blob([
      '{"data":{"coffeeBeans":[{"id":"a","image":"',
      'a'.repeat(33 * 1024 * 1024),
      '"}]}}',
    ]);
    const slice = vi.spyOn(file, 'slice');
    await expect(
      (async () => {
        for await (const event of readBackupStream(file)) void event;
      })()
    ).rejects.toThrow('单条记录超过 32 MB');
    expect(slice.mock.calls.at(-1)![1]).toBeLessThan(file.size);
  });

  it('explains truncated JSON while preserving the parser error', async () => {
    try {
      for await (const event of readBackupStream(
        new Blob(['{"data":{"coffeeBeans":[{"id":"a"}'])
      )) void event;
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toMatchObject({
        message: '备份文件格式无效或不完整，请重新选择完整的备份',
        cause: expect.any(Error),
      });
    }
  });
});
