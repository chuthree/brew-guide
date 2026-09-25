import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import {
  mergeCoffeeBeanImages,
  stripCoffeeBeanImages,
  type CoffeeBeanImageRecord,
  type CoffeeBeanImageThumbnailRecord,
} from '@/lib/coffee-beans/imageRecords';
import {
  getBrewingNoteImages,
  mergeBrewingNoteImages,
  stripBrewingNoteImages,
  type BrewingNoteImageRecord,
  type BrewingNoteImageThumbnailRecord,
} from '@/lib/notes/imageRecords';
import { getUsableThumbnailDataUrl } from '@/lib/images/thumbnail';

export interface LegacyBeanImageCandidate {
  slot: 'front' | 'back';
  variant: 'original' | 'thumbnail';
  origin:
    | 'entity-inline'
    | 'image-record'
    | 'image-record-embedded-thumbnail'
    | 'thumbnail-table';
  data: string;
}

export interface LegacyBeanImageConflict {
  slot: 'front' | 'back';
  inline: string;
  split: string;
  selected: string;
  selectedSource: 'image-record';
}

export interface LegacyBeanImageResolution {
  candidates: LegacyBeanImageCandidate[];
  /** Original chosen by current public merge behavior: split record, then inline. */
  canonicalOriginals: Partial<Record<'front' | 'back', string>>;
  /** Conflicting source values are retained for migration diagnostics. */
  originalConflicts: LegacyBeanImageConflict[];
  mergedBean: CoffeeBean;
  exportedBean: CoffeeBean;
  /** Direct getSource(mode: original) reads imageRecord only. */
  repositoryOriginals: Partial<Record<'front' | 'back', string>>;
  /** The repository uses a usable thumbnail-table entry first. */
  repositoryThumbnails: Partial<Record<'front' | 'back', string>>;
  /** If absent, the repository tries generating one from its split original. */
  thumbnailGenerationFallback: Partial<Record<'front' | 'back', string>>;
  /** Inline entity values overwrite an existing split original during v6 startup migration. */
  startupMigrationInlineOriginals?: Partial<Record<'front' | 'back', string>>;
  startupMigrationWouldReplaceSplitRecord: boolean;
  /** The old startup migration copies these embedded thumbnails, not the thumbnail-table values. */
  startupMigrationEmbeddedThumbnails: Partial<Record<'front' | 'back', string>>;
}

export function mapLegacyCoffeeBeanImages(
  bean: CoffeeBean,
  imageRecord?: CoffeeBeanImageRecord | null,
  thumbnailRecord?: CoffeeBeanImageThumbnailRecord | null
): LegacyBeanImageResolution {
  const candidates: LegacyBeanImageCandidate[] = [];
  const originalConflicts: LegacyBeanImageConflict[] = [];
  const repositoryOriginals: Partial<Record<'front' | 'back', string>> = {};
  const repositoryThumbnails: Partial<Record<'front' | 'back', string>> = {};
  const thumbnailGenerationFallback: Partial<Record<'front' | 'back', string>> =
    {};
  const startupMigrationInlineOriginals = {
    ...(bean.image ? { front: bean.image } : {}),
    ...(bean.backImage ? { back: bean.backImage } : {}),
  };
  const startupMigrationEmbeddedThumbnails = {
    ...(getUsableThumbnailDataUrl(imageRecord?.imageThumbnail)
      ? { front: getUsableThumbnailDataUrl(imageRecord?.imageThumbnail) }
      : {}),
    ...(getUsableThumbnailDataUrl(imageRecord?.backImageThumbnail)
      ? { back: getUsableThumbnailDataUrl(imageRecord?.backImageThumbnail) }
      : {}),
  };
  const fields = [
    {
      slot: 'front' as const,
      inline: bean.image,
      split: imageRecord?.image,
      embeddedThumbnail: imageRecord?.imageThumbnail,
      tableThumbnail: thumbnailRecord?.imageThumbnail,
    },
    {
      slot: 'back' as const,
      inline: bean.backImage,
      split: imageRecord?.backImage,
      embeddedThumbnail: imageRecord?.backImageThumbnail,
      tableThumbnail: thumbnailRecord?.backImageThumbnail,
    },
  ];

  for (const field of fields) {
    if (field.inline) {
      candidates.push({
        slot: field.slot,
        variant: 'original',
        origin: 'entity-inline',
        data: field.inline,
      });
    }
    if (field.split) {
      candidates.push({
        slot: field.slot,
        variant: 'original',
        origin: 'image-record',
        data: field.split,
      });
      repositoryOriginals[field.slot] = field.split;
      thumbnailGenerationFallback[field.slot] = field.split;
    }
    if (field.inline && field.split && field.inline !== field.split) {
      originalConflicts.push({
        slot: field.slot,
        inline: field.inline,
        split: field.split,
        selected: field.split,
        selectedSource: 'image-record',
      });
    }
    if (field.embeddedThumbnail) {
      candidates.push({
        slot: field.slot,
        variant: 'thumbnail',
        origin: 'image-record-embedded-thumbnail',
        data: field.embeddedThumbnail,
      });
    }
    if (field.tableThumbnail) {
      candidates.push({
        slot: field.slot,
        variant: 'thumbnail',
        origin: 'thumbnail-table',
        data: field.tableThumbnail,
      });
      const usable = getUsableThumbnailDataUrl(field.tableThumbnail);
      if (usable) repositoryThumbnails[field.slot] = usable;
    }
  }

  const mergedBean = mergeCoffeeBeanImages(bean, imageRecord);
  const canonicalOriginals = {
    ...(mergedBean.image ? { front: mergedBean.image } : {}),
    ...(mergedBean.backImage ? { back: mergedBean.backImage } : {}),
  };

  return {
    candidates,
    canonicalOriginals,
    originalConflicts,
    mergedBean,
    exportedBean: mergeCoffeeBeanImages(
      stripCoffeeBeanImages(bean),
      imageRecord
    ),
    repositoryOriginals,
    repositoryThumbnails,
    thumbnailGenerationFallback,
    ...(Object.keys(startupMigrationInlineOriginals).length > 0
      ? { startupMigrationInlineOriginals }
      : {}),
    startupMigrationWouldReplaceSplitRecord:
      Object.keys(startupMigrationInlineOriginals).length > 0,
    startupMigrationEmbeddedThumbnails,
  };
}

export interface LegacyNoteImageResolution {
  candidates: Array<{
    position: number;
    variant: 'original' | 'thumbnail';
    origin: 'entity-inline' | 'image-record' | 'thumbnail-table';
    field: 'image' | 'images' | 'imageThumbnail' | 'imageThumbnails';
    data: string;
  }>;
  /** Originals chosen by current public merge behavior, preserving order. */
  canonicalOriginals: string[];
  /** Same-position inline/split disagreements for migration diagnostics. */
  originalConflicts: Array<{
    position: number;
    inline: string;
    split: string;
    selected: string;
    inlineField: 'image' | 'images';
    splitField: 'image' | 'images';
    selectedSource: 'image-record';
  }>;
  mergedNote: BrewingNote;
  exportedNote: BrewingNote;
  publicReadImages: string[];
  /** The current BrewingNoteImageRepository does not read thumbnail rows. */
  publicReadThumbnails: [];
  /** The old startup migration writes the effective inline list when it is non-empty. */
  startupMigrationInlineImages: string[];
  startupMigrationWouldReplaceSplitRecord: boolean;
}

export function mapLegacyBrewingNoteImages(
  note: BrewingNote,
  imageRecord?: BrewingNoteImageRecord | null,
  thumbnailRecord?: BrewingNoteImageThumbnailRecord | null
): LegacyNoteImageResolution {
  const candidates: LegacyNoteImageResolution['candidates'] = [];
  const inlineOriginals = getBrewingNoteImages(note);
  const splitOriginals = imageRecord?.images?.length
    ? imageRecord.images
    : imageRecord?.image
      ? [imageRecord.image]
      : [];
  const inlineField: 'image' | 'images' | undefined =
    Array.isArray(note.images) && note.images.length > 0
      ? 'images'
      : note.image
        ? 'image'
        : undefined;
  const splitField: 'image' | 'images' | undefined = imageRecord?.images?.length
    ? 'images'
    : imageRecord?.image
      ? 'image'
      : undefined;
  if (typeof note.image === 'string') {
    candidates.push({
      position: 0,
      variant: 'original',
      origin: 'entity-inline',
      field: 'image',
      data: note.image,
    });
  }
  note.images?.forEach((data, position) => {
    candidates.push({
      position,
      variant: 'original',
      origin: 'entity-inline',
      field: 'images',
      data,
    });
  });
  if (typeof imageRecord?.image === 'string') {
    candidates.push({
      position: 0,
      variant: 'original',
      origin: 'image-record',
      field: 'image',
      data: imageRecord.image,
    });
  }
  imageRecord?.images?.forEach((data, position) => {
    candidates.push({
      position,
      variant: 'original',
      origin: 'image-record',
      field: 'images',
      data,
    });
  });
  if (typeof thumbnailRecord?.imageThumbnail === 'string') {
    candidates.push({
      position: 0,
      variant: 'thumbnail',
      origin: 'thumbnail-table',
      field: 'imageThumbnail',
      data: thumbnailRecord.imageThumbnail,
    });
  }
  thumbnailRecord?.imageThumbnails?.forEach((data, position) => {
    candidates.push({
      position,
      variant: 'thumbnail',
      origin: 'thumbnail-table',
      field: 'imageThumbnails',
      data,
    });
  });

  const mergedNote = mergeBrewingNoteImages(note, imageRecord);
  const startupMigrationInlineImages = getBrewingNoteImages(note);
  const originalConflicts = splitOriginals.flatMap((split, position) => {
    const inline = inlineOriginals[position];
    if (!inline || !split || inline === split || !inlineField || !splitField) {
      return [];
    }
    return [
      {
        position,
        inline,
        split,
        selected: split,
        inlineField,
        splitField,
        selectedSource: 'image-record' as const,
      },
    ];
  });
  return {
    candidates,
    canonicalOriginals: getBrewingNoteImages(mergedNote),
    originalConflicts,
    mergedNote,
    exportedNote: mergeBrewingNoteImages(
      stripBrewingNoteImages(note),
      imageRecord
    ),
    publicReadImages: getBrewingNoteImages(mergedNote),
    publicReadThumbnails: [],
    startupMigrationInlineImages,
    startupMigrationWouldReplaceSplitRecord:
      startupMigrationInlineImages.length > 0,
  };
}
