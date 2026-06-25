import type { CoffeeBean } from '../../types/app';
import type { AppSettings } from '../core/db';
import {
  buildBeanCalendarEventCandidates,
  type CalendarEventCandidate,
} from './eventCandidates';
import { getCalendarSyncSettings } from './settings';
import {
  loadCalendarEventLinks,
  saveCalendarEventLinks,
  type CalendarEventLinkMap,
} from './linkStore';
import {
  canUseNativeCalendar,
  createNativeCalendarEvent,
  deleteNativeCalendarEvent,
  ensureBrewGuideCalendarId,
  ensureCalendarWriteAccess,
  updateNativeCalendarEvent,
} from './nativeCalendar';

interface CalendarEventLink {
  stableId: string;
  nativeEventId: string;
  payloadHash: string;
  calendarId?: string;
}

const getCalendarEventPayloadHash = (
  candidate: CalendarEventCandidate
): string =>
  JSON.stringify({
    title: candidate.title,
    date: candidate.date,
  });

const buildCandidates = (
  beans: CoffeeBean[],
  settings: AppSettings
): CalendarEventCandidate[] => {
  const calendarSettings = getCalendarSyncSettings(settings);

  return beans
    .map(bean => buildBeanCalendarEventCandidates(bean, calendarSettings))
    .filter((candidate): candidate is CalendarEventCandidate =>
      Boolean(candidate)
    );
};

const createLink = (
  candidate: CalendarEventCandidate,
  nativeEventId: string,
  calendarId: string
): CalendarEventLink => ({
  stableId: candidate.stableId,
  nativeEventId,
  payloadHash: getCalendarEventPayloadHash(candidate),
  calendarId,
});

export const syncCoffeeBeanCalendarEvents = async (
  beans: CoffeeBean[],
  settings: AppSettings
): Promise<void> => {
  if (typeof window === 'undefined') return;
  if (!canUseNativeCalendar()) return;

  const existingLinks = loadCalendarEventLinks();
  const candidates = buildCandidates(beans, settings);

  if (candidates.length === 0 && Object.keys(existingLinks).length === 0) {
    return;
  }

  const hasPermission = await ensureCalendarWriteAccess();
  if (!hasPermission) return;

  const nextLinks: CalendarEventLinkMap = { ...existingLinks };
  const calendarId = await ensureBrewGuideCalendarId();
  const candidateIds = new Set(candidates.map(candidate => candidate.stableId));

  for (const link of Object.values(existingLinks)) {
    if (candidateIds.has(link.stableId)) continue;

    try {
      await deleteNativeCalendarEvent(link.nativeEventId);
    } catch (error) {
      console.warn('[CalendarSync] Failed to delete calendar event:', error);
    } finally {
      delete nextLinks[link.stableId];
    }
  }

  for (const candidate of candidates) {
    const existing = existingLinks[candidate.stableId];
    const nextHash = getCalendarEventPayloadHash(candidate);

    if (!existing) {
      try {
        const nativeEventId = await createNativeCalendarEvent(
          candidate,
          calendarId
        );
        nextLinks[candidate.stableId] = createLink(
          candidate,
          nativeEventId,
          calendarId
        );
      } catch (error) {
        console.warn('[CalendarSync] Failed to create calendar event:', error);
      }

      continue;
    }

    if (
      existing.payloadHash === nextHash &&
      existing.calendarId === calendarId
    ) {
      continue;
    }

    try {
      await updateNativeCalendarEvent(
        existing.nativeEventId,
        candidate,
        calendarId
      );
      nextLinks[candidate.stableId] = createLink(
        candidate,
        existing.nativeEventId,
        calendarId
      );
    } catch (error) {
      console.warn('[CalendarSync] Failed to update calendar event:', error);
      try {
        await deleteNativeCalendarEvent(existing.nativeEventId);
      } catch (deleteError) {
        console.warn(
          '[CalendarSync] Failed to delete stale calendar event:',
          deleteError
        );
      }

      try {
        const nativeEventId = await createNativeCalendarEvent(
          candidate,
          calendarId
        );
        nextLinks[candidate.stableId] = createLink(
          candidate,
          nativeEventId,
          calendarId
        );
      } catch (createError) {
        console.warn(
          '[CalendarSync] Failed to recreate calendar event:',
          createError
        );
      }
    }
  }

  saveCalendarEventLinks(nextLinks);
};
