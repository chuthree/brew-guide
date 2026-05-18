import type { CoffeeBean } from '../../types/app';
import type { AppSettings } from '../core/db';
import { getBeanRoasterName } from '../utils/coffeeBeanUtils';
import { getDefaultFlavorPeriodByRoastLevelSync } from '../utils/flavorPeriodUtils';
import {
  buildBeanCalendarEventCandidates,
  type CalendarEventCandidate,
} from './eventCandidates';
import {
  getCalendarEventPayloadHash,
  planCalendarSync,
  type CalendarEventLink,
} from './syncPlanner';
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

const buildCandidates = (
  beans: CoffeeBean[],
  settings: AppSettings
): CalendarEventCandidate[] => {
  const calendarSettings = getCalendarSyncSettings(settings);

  return beans.flatMap(bean =>
    buildBeanCalendarEventCandidates(bean, calendarSettings, {
      resolvePeriod: targetBean => {
        const roasterName = getBeanRoasterName(targetBean) || undefined;
        return getDefaultFlavorPeriodByRoastLevelSync(
          targetBean.roastLevel || '',
          settings.customFlavorPeriod,
          roasterName
        );
      },
    })
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

  const calendarId = await ensureBrewGuideCalendarId();
  const plan = planCalendarSync(candidates, existingLinks, {
    targetCalendarId: calendarId,
  });

  if (
    plan.create.length === 0 &&
    plan.update.length === 0 &&
    plan.delete.length === 0
  ) {
    return;
  }

  const nextLinks: CalendarEventLinkMap = { ...existingLinks };

  for (const item of plan.delete) {
    try {
      await deleteNativeCalendarEvent(item.nativeEventId);
    } catch (error) {
      console.warn('[CalendarSync] Failed to delete calendar event:', error);
    } finally {
      delete nextLinks[item.stableId];
    }
  }

  for (const item of plan.update) {
    try {
      await updateNativeCalendarEvent(
        item.nativeEventId,
        item.candidate,
        calendarId
      );
      nextLinks[item.candidate.stableId] = createLink(
        item.candidate,
        item.nativeEventId,
        calendarId
      );
    } catch (error) {
      console.warn('[CalendarSync] Failed to update calendar event:', error);
      try {
        await deleteNativeCalendarEvent(item.nativeEventId);
      } catch (deleteError) {
        console.warn(
          '[CalendarSync] Failed to delete stale calendar event:',
          deleteError
        );
      }

      try {
        const nativeEventId = await createNativeCalendarEvent(
          item.candidate,
          calendarId
        );
        nextLinks[item.candidate.stableId] = createLink(
          item.candidate,
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

  for (const candidate of plan.create) {
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
  }

  saveCalendarEventLinks(nextLinks);
};
