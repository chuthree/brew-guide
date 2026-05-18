import type { CalendarEventCandidate } from './eventCandidates';

export interface CalendarEventLink {
  stableId: string;
  nativeEventId: string;
  payloadHash: string;
  calendarId?: string;
}

export interface CalendarSyncPlan {
  create: CalendarEventCandidate[];
  update: Array<{
    nativeEventId: string;
    candidate: CalendarEventCandidate;
  }>;
  delete: Array<{
    stableId: string;
    nativeEventId: string;
  }>;
}

export interface CalendarSyncPlanOptions {
  targetCalendarId?: string;
}

export const getCalendarEventPayloadHash = (
  candidate: CalendarEventCandidate
): string =>
  JSON.stringify({
    title: candidate.title,
    startDate: candidate.startDate,
    endDate: candidate.endDate,
    description: candidate.description,
  });

export const planCalendarSync = (
  candidates: CalendarEventCandidate[],
  existingLinks: Record<string, CalendarEventLink>,
  options: CalendarSyncPlanOptions = {}
): CalendarSyncPlan => {
  const create: CalendarEventCandidate[] = [];
  const update: CalendarSyncPlan['update'] = [];
  const nextStableIds = new Set(
    candidates.map(candidate => candidate.stableId)
  );

  for (const candidate of candidates) {
    const existing = existingLinks[candidate.stableId];
    if (!existing) {
      create.push(candidate);
      continue;
    }

    const nextHash = getCalendarEventPayloadHash(candidate);
    const isInTargetCalendar =
      !options.targetCalendarId ||
      existing.calendarId === options.targetCalendarId;

    if (existing.payloadHash !== nextHash || !isInTargetCalendar) {
      update.push({
        nativeEventId: existing.nativeEventId,
        candidate,
      });
    }
  }

  const deleted = Object.values(existingLinks)
    .filter(link => !nextStableIds.has(link.stableId))
    .map(link => ({
      stableId: link.stableId,
      nativeEventId: link.nativeEventId,
    }));

  return {
    create,
    update,
    delete: deleted,
  };
};
