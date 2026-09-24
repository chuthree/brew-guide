/** Compatibility aliases. New application code should use data/repositories. */
import {
  brewingNoteImageRepository,
  brewingNotePersistence,
} from '@/lib/data/repositories';

export const getBrewingNoteImageRecord = brewingNoteImageRepository.getRecord;
export const getBrewingNoteImageNoteIds = brewingNoteImageRepository.getNoteIds;
export const getBrewingNoteImageCounts =
  brewingNoteImageRepository.getImageCounts;
export const getBrewingNoteImages = brewingNoteImageRepository.getImages;
export const mergeNoteWithStoredImages = brewingNoteImageRepository.mergeNote;
export const mergeNotesWithStoredImages = brewingNoteImageRepository.mergeNotes;
export const exportBrewingNotesWithImages =
  brewingNoteImageRepository.exportAll;
export const saveBrewingNoteWithImages = brewingNotePersistence.saveWithImages;
export const replaceBrewingNotesWithSplitImages =
  brewingNotePersistence.replaceAllWithImages;
