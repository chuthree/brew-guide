import type { Schema } from './toolDefinitions';
import { invalid, validate } from './validation';
import { ratingSchema } from '@/lib/ratings';

export type TastePatch = Record<string, number | null>;

export const tastePatchSchema: Schema = {
  type: 'object',
  additionalProperties: {
    anyOf: [ratingSchema('taste'), { type: 'null' }],
  },
  maxProperties: 100,
  description:
    'Patch scores by exact dimension ID from the note/form and get_flavor_dimensions. Omitted keys (including an empty object) preserve scores; 0 is unrated, not deletion. A number updates a current or existing historical score. null explicitly removes that one score, only when the user requests removal. Never infer deletion from a dimension no longer being configured. Preserve user scores; identify any user-authorized estimates in the reply.',
};

export function applyTastePatch(
  previous: Record<string, number> | undefined,
  patch: TastePatch,
  currentIds: string[]
): Record<string, number> {
  validate(patch, tastePatchSchema, 'taste');
  const next = { ...previous };
  for (const [id, value] of Object.entries(patch)) {
    if (!currentIds.includes(id) && !Object.hasOwn(next, id))
      invalid(
        'Unknown flavor dimensions; read the current note and dimensions first.'
      );
    if (value === null) delete next[id];
    else next[id] = value;
  }
  return next;
}
