import type { DataRepositories } from './repositories';
import type { AppSettings, Grinder } from './models';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment } from '@/lib/core/config';
import type { CustomMethodRecord } from './contracts';

export interface DataImportPlan {
  streamed?: {
    sections: ReadonlySet<'coffeeBeans' | 'brewingNotes'>;
    records: AsyncIterable<
      | { section: 'coffeeBeans'; value: CoffeeBean }
      | { section: 'brewingNotes'; value: BrewingNote }
    >;
  };
  coffeeBeans?: CoffeeBean[];
  brewingNotes?: BrewingNote[];
  customEquipments?: CustomEquipment[];
  grinders?: Grinder[];
  methods?: CustomMethodRecord[];
  settings?: AppSettings;
  legacy: Record<string, string>;
}

/** Called inside the backend's whole-backup transaction, without inventory side effects. */
export async function applyStreamedDataImport(
  repositories: Pick<
    DataRepositories,
    | 'coffeeBeanRepository'
    | 'brewingNoteRepository'
    | 'coffeeBeanPersistence'
    | 'brewingNotePersistence'
  >,
  stream: NonNullable<DataImportPlan['streamed']>,
  waitForRead: <T>(promise: Promise<T>) => Promise<T> = promise => promise
): Promise<void> {
  const staleBeans = new Set(
    stream.sections.has('coffeeBeans')
      ? (await repositories.coffeeBeanRepository.list()).map(row => row.id)
      : []
  );
  const staleNotes = new Set(
    stream.sections.has('brewingNotes')
      ? (await repositories.brewingNoteRepository.list()).map(row => row.id)
      : []
  );
  const iterator = stream.records[Symbol.asyncIterator]();
  try {
    for (;;) {
      const next = await waitForRead(iterator.next());
      if (next.done) break;
      const { section, value } = next.value;
      if (section === 'coffeeBeans') {
        staleBeans.delete(value.id);
        // Backup image fields replace both sides; absent fields preserve existing images.
        if (Object.hasOwn(value, 'image') || Object.hasOwn(value, 'backImage'))
          await repositories.coffeeBeanPersistence.deleteWithImages(value.id);
        await repositories.coffeeBeanPersistence.saveWithImages(value, {
          generateThumbnails: false,
        });
      } else {
        staleNotes.delete(value.id);
        await repositories.brewingNotePersistence.saveWithImages(value);
      }
    }
    for (const id of staleBeans)
      await repositories.coffeeBeanPersistence.deleteWithImages(id);
    for (const id of staleNotes)
      await repositories.brewingNotePersistence.deleteWithImages(id);
  } finally {
    await iterator.return?.();
  }
}

export interface DataImportPersistence {
  importData(plan: DataImportPlan): Promise<void>;
}

/** Only the backend calls this, with repositories bound to one transaction. */
export async function applyDataImport(
  repositories: Pick<
    DataRepositories,
    | 'coffeeBeanPersistence'
    | 'brewingNotePersistence'
    | 'customEquipmentRepository'
    | 'grinderRepository'
    | 'customMethodRepository'
    | 'appSettingsRepository'
    | 'legacySettingsRepository'
  >,
  plan: DataImportPlan
): Promise<void> {
  if (plan.coffeeBeans)
    await repositories.coffeeBeanPersistence.replaceAllWithImages(
      plan.coffeeBeans,
      { allowDestructiveReplace: true }
    );
  if (plan.brewingNotes)
    await repositories.brewingNotePersistence.replaceAllWithImages(
      plan.brewingNotes,
      { allowDestructiveReplace: true }
    );
  if (plan.customEquipments) {
    await repositories.customEquipmentRepository.replaceAll(
      plan.customEquipments
    );
    await repositories.legacySettingsRepository.delete('customEquipments');
  }
  if (plan.grinders)
    await repositories.grinderRepository.replaceAll(plan.grinders);
  if (plan.methods) {
    await repositories.customMethodRepository.clear();
    await repositories.customMethodRepository.upsertMany(plan.methods);
  }
  if (plan.settings)
    await repositories.appSettingsRepository.save(plan.settings);
  for (const [key, value] of Object.entries(plan.legacy)) {
    await repositories.legacySettingsRepository.set(key, value);
  }
}
