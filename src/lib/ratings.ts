import type { AppSettings } from '@/lib/data/models';
import type { Schema } from '@/lib/mcp/toolDefinitions';
import { invalid } from '@/lib/mcp/validation';

export function ratingSteps(settings?: Partial<AppSettings>) {
  return {
    bean: settings?.beanRatingTenthStep ? 0.1 : 0.5,
    overall: settings?.flavorRatingTenthStep ? 0.1 : 0.5,
    taste: settings?.flavorRatingTenthStep
      ? 0.1
      : settings?.flavorRatingHalfStep
        ? 0.5
        : 1,
  };
}

export function ratingSchema(
  kind: keyof ReturnType<typeof ratingSteps>
): Schema {
  return {
    type: 'number',
    minimum: 0,
    maximum: 5,
    enum: Array.from({ length: 51 }, (_, index) => index / 10),
    description: `0 means unrated. ${kind === 'bean' ? 'Bean: step 0.5 by default, 0.1 only with beanRatingTenthStep.' : kind === 'overall' ? 'Note overall: step 0.5, or 0.1 with flavorRatingTenthStep.' : 'Taste: step 1, 0.5 with flavorRatingHalfStep, or 0.1 with flavorRatingTenthStep.'} Current settings are enforced on write; never round user input.`,
  };
}

export function validateRatingInput(
  fields: Record<string, unknown>,
  settings?: Partial<AppSettings>
) {
  const steps = ratingSteps(settings);
  const check = (value: unknown, step: number, path: string) => {
    // Enumerating the UI's values avoids floating point modulo errors at 0.1.
    if (
      !Array.from({ length: 5 / step + 1 }, (_, i) =>
        Number((i * step).toFixed(1))
      ).includes(value as number)
    )
      invalid(
        `${path} must be between 0 and 5 in steps of ${step}; do not round.`
      );
  };
  if (fields.overallRating !== undefined)
    check(fields.overallRating, steps.bean, 'overallRating');
  if (fields.rating !== undefined)
    check(fields.rating, steps.overall, 'rating');
  if (fields.taste && typeof fields.taste === 'object')
    for (const [key, value] of Object.entries(fields.taste))
      if (value !== null) check(value, steps.taste, `taste.${key}`);
}
