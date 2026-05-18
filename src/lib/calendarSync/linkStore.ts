import type { CalendarEventLink } from './syncPlanner';

const STORAGE_KEY = 'brew-guide:calendar-sync:event-links:v1';
const CALENDAR_ID_STORAGE_KEY = 'brew-guide:calendar-sync:calendar-id:v1';

export type CalendarEventLinkMap = Record<string, CalendarEventLink>;

export const loadCalendarEventLinks = (): CalendarEventLinkMap => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    return parsed as CalendarEventLinkMap;
  } catch (error) {
    console.warn('[CalendarSync] Failed to load event links:', error);
    return {};
  }
};

export const saveCalendarEventLinks = (links: CalendarEventLinkMap): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  } catch (error) {
    console.warn('[CalendarSync] Failed to save event links:', error);
  }
};

export const loadCalendarId = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(CALENDAR_ID_STORAGE_KEY);
  } catch (error) {
    console.warn('[CalendarSync] Failed to load calendar id:', error);
    return null;
  }
};

export const saveCalendarId = (calendarId: string): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CALENDAR_ID_STORAGE_KEY, calendarId);
  } catch (error) {
    console.warn('[CalendarSync] Failed to save calendar id:', error);
  }
};
