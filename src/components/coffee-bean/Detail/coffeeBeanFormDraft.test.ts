import { describe, expect, it } from 'vitest';
import { normalizeCoffeeBeanFormDraft } from './coffeeBeanFormDraft';

describe('bean form draft component arrays', () => {
  it('round trips arrays within a single component, keeping cultivar names intact', () => {
    const component = {
      origin: ['Ethiopia'],
      variety: ['SL28/34', '74110', '74112'],
      process: ['Natural', 'Anaerobic'],
      percentage: 100,
    };
    const draft = normalizeCoffeeBeanFormDraft({
      name: 'Test',
      blendComponents: [component],
    });
    expect(draft.blendComponents).toHaveLength(1);
    expect(draft.blendComponents?.[0]).toMatchObject(component);
    expect(normalizeCoffeeBeanFormDraft(draft)).toEqual(draft);
  });
  it('leaves legacy single strings compatible', () => {
    expect(
      normalizeCoffeeBeanFormDraft({
        name: 'Test',
        blendComponents: [{ variety: ' SL28/34 ' }],
      }).blendComponents?.[0].variety
    ).toBe('SL28/34');
  });
});
