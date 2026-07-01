import { describe, expect, it } from 'vitest';
import {
  canSwitchPlainNoteToQuickRecord,
  SHORT_NOTE_QUICK_RECORD_MAX_CHARS,
  type QuickRecordConversionCandidate,
} from './quickRecordConversion';

const baseCandidate: QuickRecordConversionCandidate = {
  noteId: 'note-1',
  canUseNotesModule: true,
  canUseCoffeeBeanModule: true,
  notes: '少量备注',
};

describe('canSwitchPlainNoteToQuickRecord', () => {
  it('allows short existing plain notes and rejects only structural blockers', () => {
    expect(canSwitchPlainNoteToQuickRecord(baseCandidate)).toBe(true);
    expect(
      canSwitchPlainNoteToQuickRecord({
        ...baseCandidate,
        notes: 'x'.repeat(SHORT_NOTE_QUICK_RECORD_MAX_CHARS + 1),
      })
    ).toBe(false);
    expect(
      canSwitchPlainNoteToQuickRecord({
        ...baseCandidate,
        source: 'quick-decrement',
      })
    ).toBe(false);
    expect(
      canSwitchPlainNoteToQuickRecord({ ...baseCandidate, isCopy: true })
    ).toBe(false);
    expect(
      canSwitchPlainNoteToQuickRecord({ ...baseCandidate, noteId: undefined })
    ).toBe(false);
    expect(
      canSwitchPlainNoteToQuickRecord({
        ...baseCandidate,
        canUseNotesModule: false,
      })
    ).toBe(false);
    expect(
      canSwitchPlainNoteToQuickRecord({
        ...baseCandidate,
        canUseCoffeeBeanModule: false,
      })
    ).toBe(false);
  });
});
