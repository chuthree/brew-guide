import { describe, expect, it, vi } from 'vitest';
import {
  coffeeBeanRepository,
  configureRepositories,
  type DataRepositories,
} from './repositories';

describe('backend-neutral repository registry', () => {
  it('fails explicitly before a backend is bound, then delegates through the stable export', async () => {
    const listBeforeBinding = coffeeBeanRepository.list;

    expect(() => coffeeBeanRepository.list()).toThrow(
      'Data repositories are not configured'
    );

    const list = vi.fn().mockResolvedValue([]);
    const repositories = {
      coffeeBeanRepository: { list },
    } as unknown as DataRepositories;

    configureRepositories(repositories);

    await expect(listBeforeBinding()).resolves.toEqual([]);
    expect(list).toHaveBeenCalledOnce();
  });
});
