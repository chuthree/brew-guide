import type { BrewingNote } from '@/lib/core/config';
import type { Grinder } from '@/lib/data/models';

/** Resolve only a unique configured name; never infer a grinder from a bare number. */
export function resolveMcpNoteGrinder(value: string, grinders: Grinder[]) {
  const input = value.trim();
  const matches = grinders
    .filter(grinder => {
      const name = grinder.name.trim();
      if (!name || !input.toLowerCase().startsWith(name.toLowerCase()))
        return false;
      // Compact numeric notation (C4024) is valid; a longer unknown name
      // (C40Pro 24) must not be attributed to C40.
      return /^[·\s\d+.-]/.test(input.slice(name.length));
    })
    .sort((a, b) => b.name.trim().length - a.name.trim().length);
  const grinder = matches[0];
  if (
    !grinder ||
    matches.filter(
      item => item.name.trim().length === grinder.name.trim().length
    ).length !== 1
  )
    return null;

  const scale = input.slice(grinder.name.trim().length).replace(/^[·\s]+/, '');
  if (!scale) return null;
  return { grinder, scale };
}

const numericScale = (value: string) =>
  value.trim().match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(\s*)([^\d]*)$/);
const isClickUnit = (unit: string) => /^(?:格|档|檔|clicks?)$/i.test(unit);

/** Follow this user's scale convention, without converting between physical units. */
export function normalizeMcpGrinderScale(grinder: Grinder, scale: string): string {
  const incoming = numericScale(scale);
  if (!incoming) return scale;
  const reference = [
    grinder.currentGrindSize,
    ...[...(grinder.grindSizeHistory ?? [])]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(entry => entry.grindSize),
  ]
    .map(value => (value ? numericScale(value) : null))
    .find(value => value !== null);
  if (!reference) return scale;

  const incomingUnit = incoming[3].trim();
  const referenceUnit = reference[3].trim();
  // Spoken click suffixes may follow a user's unitless click notation. A
  // different physical unit (e.g. mm vs µm) must remain explicit, never converted.
  if (
    incomingUnit &&
    incomingUnit.toLowerCase() !== referenceUnit.toLowerCase() &&
    !(isClickUnit(incomingUnit) && (!referenceUnit || isClickUnit(referenceUnit)))
  )
    return scale;

  return `${incoming[1]}${referenceUnit ? reference[2] + reference[3] : ''}`;
}

export function isLatestMcpGrinderNote(
  note: BrewingNote,
  notes: BrewingNote[],
  grinders: Grinder[],
  grinderId: string
): boolean {
  return !notes.some(other => {
    if (other.id === note.id || other.source || !other.params?.grindSize)
      return false;
    if (other.timestamp <= note.timestamp) return false;
    return (
      resolveMcpNoteGrinder(other.params.grindSize, grinders)?.grinder.id ===
      grinderId
    );
  });
}
