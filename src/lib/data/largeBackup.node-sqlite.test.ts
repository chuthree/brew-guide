import { openAsBlob } from 'node:fs';
import {
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { readBackupStream } from './backupStream';
import { createNodeSqliteTestDatabase } from './sqlite/repositories/testing/nodeSqliteTestDriver';
import { createSqliteRuntimeRepositories } from './sqlite/runtimeRepositories';
import type { CoffeeBean } from '@/types/app';

it.skipIf(process.env.LARGE_BACKUP_TEST !== '1')(
  'imports an 800 MiB file through real SQLite and disk image storage with bounded memory',
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'brew-guide-large-import-'));
    const database = await createNodeSqliteTestDatabase();
    try {
      const path = join(directory, 'backup.json');
      const output = await open(path, 'w');
      const image = `data:image/png;base64,${Buffer.alloc(768 * 1024, 1).toString('base64')}`;
      try {
        await output.write('{"data":{"coffeeBeans":[');
        for (let index = 0; index < 800; index++)
          await output.write(
            `${index ? ',' : ''}${JSON.stringify({ id: `bean-${index}`, name: 'Large backup', timestamp: 1, image })}`
          );
        await output.write(']}}');
      } finally {
        await output.close();
      }
      const file = await openAsBlob(path);
      let count = 0;
      let peakRss = process.memoryUsage().rss;
      const initialRss = peakRss;
      const progress = () => {
        peakRss = Math.max(peakRss, process.memoryUsage().rss);
      };
      // First pass is the same structural preflight used by DataManager.
      for await (const event of readBackupStream(file, progress))
        if (event.section === 'coffeeBeans') count++;
      expect(count).toBe(800);
      const repositories = createSqliteRuntimeRepositories(database.driver, {
        write: async (key, bytes) => {
          await writeFile(join(directory, key), bytes, { flag: 'wx' });
        },
        read: async key => new Uint8Array(await readFile(join(directory, key))),
        delete: async key => {
          await rm(join(directory, key), { force: true });
        },
        exists: async key => {
          try {
            await stat(join(directory, key));
            return true;
          } catch {
            return false;
          }
        },
        listObjectKeys: async () =>
          (await readdir(directory)).filter(name => name !== 'backup.json'),
      });
      await repositories.dataImportPersistence.importData({
        legacy: {},
        streamed: {
          sections: new Set(['coffeeBeans']),
          records: (async function* () {
            for await (const event of readBackupStream(file, progress)) {
              if (event.section === 'coffeeBeans')
                yield {
                  section: 'coffeeBeans' as const,
                  value: event.value as unknown as CoffeeBean,
                };
            }
          })(),
        },
      });
      expect(await repositories.coffeeBeanRepository.count()).toBe(800);
      const sizes = await database.driver.query(
        'SELECT COUNT(*) AS count, SUM(size_bytes) AS bytes FROM coffee_bean_images'
      );
      expect(sizes[0]).toMatchObject({ count: 800, bytes: 800 * 768 * 1024 });
      expect(peakRss - initialRss).toBeLessThan(400 * 1024 * 1024);
      console.warn(
        JSON.stringify({
          fileBytes: file.size,
          images: count,
          peakRssBytes: peakRss,
          rssGrowthBytes: peakRss - initialRss,
        })
      );
    } finally {
      await database.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
  300_000
);
