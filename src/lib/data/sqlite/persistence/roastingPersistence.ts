import type { SqliteDriver } from '../driver';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import { cleanupUnreferencedPaths } from './brewingNoteImagePersistence';
import {
  listCoffeeBeans,
  upsertManyCoffeeBeans,
  deleteCoffeeBean,
} from '../repositories/coffeeBean';
import {
  getBrewingNote,
  saveBrewingNote,
  deleteBrewingNote,
  listBrewingNotes,
} from '../repositories/brewingNote';
import {
  listCoffeeBeanImageMetadata,
  replaceCoffeeBeanImageMetadata,
} from '../imageMetadataExecutor';
import {
  prepareRoastingBatch,
  type RoastingCommand,
} from '@/lib/coffee-beans/roastingBatch';

export function createSqliteRoastingPersistence(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore
) {
  return {
    async save(command: RoastingCommand) {
      const cleanupPaths: string[] = [];
      const changes = await driver.transaction(async tx => {
        const changes = prepareRoastingBatch(
          command,
          await listCoffeeBeans(tx),
          await getBrewingNote(tx, command.noteId),
          await listBrewingNotes(tx)
        );
        await upsertManyCoffeeBeans(tx, changes.beans);
        if (changes.deletedBeanId) {
          const images = await listCoffeeBeanImageMetadata(
            tx,
            changes.deletedBeanId
          );
          for (const image of images)
            if (image.sourceKind === 'file')
              cleanupPaths.push(image.relativePath);
          await replaceCoffeeBeanImageMetadata(tx, changes.deletedBeanId, []);
          await deleteCoffeeBean(tx, changes.deletedBeanId);
        }
        if (changes.note) await saveBrewingNote(tx, changes.note);
        if (changes.deletedNoteId) {
          const images = await tx.query(
            "SELECT relative_path FROM brewing_note_images WHERE note_id = ? AND source_kind = 'file'",
            [changes.deletedNoteId]
          );
          for (const image of images)
            if (typeof image.relative_path === 'string')
              cleanupPaths.push(image.relative_path);
          await tx.execute(
            'DELETE FROM brewing_note_images WHERE note_id = ?',
            [changes.deletedNoteId]
          );
          await deleteBrewingNote(tx, changes.deletedNoteId);
        }
        if (changes.imageSourceId) {
          const images = await listCoffeeBeanImageMetadata(
            tx,
            changes.imageSourceId
          );
          await replaceCoffeeBeanImageMetadata(
            tx,
            command.beanId,
            images.map(image => ({
              ...image,
              imageId: `${command.beanId}:${image.slot}:${image.variant}`,
              beanId: command.beanId,
              updatedAt: command.now,
            }))
          );
        }
        return changes;
      });
      await cleanupUnreferencedPaths(driver, fileStore, cleanupPaths, message =>
        console.error(message)
      );
      return changes;
    },
  };
}
