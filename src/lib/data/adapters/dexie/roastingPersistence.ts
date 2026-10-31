import { db } from '@/lib/core/db';
import {
  prepareRoastingBatch,
  type RoastingCommand,
} from '@/lib/coffee-beans/roastingBatch';

export const roastingPersistence = {
  save(command: RoastingCommand) {
    return db.transaction(
      'rw',
      [
        db.coffeeBeans,
        db.brewingNotes,
        db.coffeeBeanImages,
        db.coffeeBeanImageThumbnails,
        db.brewingNoteImages,
        db.brewingNoteImageThumbnails,
      ],
      async () => {
        const changes = prepareRoastingBatch(
          command,
          await db.coffeeBeans.toArray(),
          await db.brewingNotes.get(command.noteId),
          await db.brewingNotes.toArray()
        );
        await db.coffeeBeans.bulkPut(changes.beans);
        if (changes.deletedBeanId) {
          await db.coffeeBeans.delete(changes.deletedBeanId);
          await db.coffeeBeanImages.delete(changes.deletedBeanId);
          await db.coffeeBeanImageThumbnails.delete(changes.deletedBeanId);
        }
        if (changes.note) await db.brewingNotes.put(changes.note);
        if (changes.deletedNoteId) {
          await db.brewingNoteImages.delete(changes.deletedNoteId);
          await db.brewingNoteImageThumbnails.delete(changes.deletedNoteId);
          await db.brewingNotes.delete(changes.deletedNoteId);
        }
        if (changes.imageSourceId) {
          const images = await db.coffeeBeanImages.get(changes.imageSourceId);
          if (images)
            await db.coffeeBeanImages.put({
              ...images,
              beanId: command.beanId,
              updatedAt: command.now,
            });
        }
        return changes;
      }
    );
  },
};
