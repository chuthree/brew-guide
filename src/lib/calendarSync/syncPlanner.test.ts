import { describe, expect, it } from 'vitest';
import { planCalendarSync } from './syncPlanner';
import type { CalendarEventCandidate } from './eventCandidates';

const flavorEvent: CalendarEventCandidate = {
  stableId: 'bean-1:flavor-period',
  beanId: 'bean-1',
  kind: 'flavor-period',
  title: '赏味期｜豆子',
  startDate: '2026-05-08',
  endDate: '2026-06-01',
  description: 'Brew Guide 自动同步：豆子。',
};

describe('planCalendarSync', () => {
  it('plans create, update, keep, and delete actions from candidate payload hashes', () => {
    const nextFlavor = {
      ...flavorEvent,
      title: '赏味期｜豆子 新名称',
    };
    const agingEvent: CalendarEventCandidate = {
      ...flavorEvent,
      stableId: 'bean-1:aging-period',
      kind: 'aging-period',
      title: '养豆期｜豆子',
      startDate: '2026-05-01',
      endDate: '2026-05-08',
    };

    const plan = planCalendarSync([nextFlavor, agingEvent], {
      'bean-1:flavor-period': {
        stableId: 'bean-1:flavor-period',
        nativeEventId: 'native-flavor',
        payloadHash: JSON.stringify(flavorEvent),
      },
      'bean-2:flavor-period': {
        stableId: 'bean-2:flavor-period',
        nativeEventId: 'native-old',
        payloadHash: 'old',
      },
    });

    expect(plan.create.map(item => item.stableId)).toEqual([
      'bean-1:aging-period',
    ]);
    expect(plan.update).toEqual([
      {
        nativeEventId: 'native-flavor',
        candidate: nextFlavor,
      },
    ]);
    expect(plan.delete).toEqual([
      {
        stableId: 'bean-2:flavor-period',
        nativeEventId: 'native-old',
      },
    ]);
  });

  it('plans an update when an existing event is not in the target calendar', () => {
    const plan = planCalendarSync(
      [flavorEvent],
      {
        'bean-1:flavor-period': {
          stableId: 'bean-1:flavor-period',
          nativeEventId: 'native-flavor',
          payloadHash: JSON.stringify({
            title: flavorEvent.title,
            startDate: flavorEvent.startDate,
            endDate: flavorEvent.endDate,
            description: flavorEvent.description,
          }),
          calendarId: 'default-calendar',
        },
      },
      { targetCalendarId: 'brew-guide-calendar' }
    );

    expect(plan.update).toEqual([
      {
        nativeEventId: 'native-flavor',
        candidate: flavorEvent,
      },
    ]);
  });
});
