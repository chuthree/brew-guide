import type { BrewingNoteData } from '@/types/app';

export const SHORT_NOTE_QUICK_RECORD_MAX_CHARS = 24;

export interface QuickRecordConversionCandidate {
  noteId?: string | null;
  isCopy?: boolean;
  source?: BrewingNoteData['source'];
  canUseNotesModule?: boolean;
  canUseCoffeeBeanModule?: boolean;
  notes?: string | null;
}

const getNormalizedTextLength = (text?: string | null): number =>
  Array.from((text || '').replace(/\s+/g, ' ').trim()).length;

export const canSwitchPlainNoteToQuickRecord = ({
  noteId,
  isCopy,
  source,
  canUseNotesModule,
  canUseCoffeeBeanModule,
  notes,
}: QuickRecordConversionCandidate): boolean =>
  !!noteId &&
  isCopy !== true &&
  !source &&
  canUseNotesModule === true &&
  canUseCoffeeBeanModule === true &&
  getNormalizedTextLength(notes) <= SHORT_NOTE_QUICK_RECORD_MAX_CHARS;
