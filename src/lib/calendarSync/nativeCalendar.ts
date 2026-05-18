import { Capacitor } from '@capacitor/core';
import type { CalendarEventCandidate } from './eventCandidates';
import { loadCalendarId, saveCalendarId } from './linkStore';

const BREW_GUIDE_CALENDAR_TITLE = 'Brew Guide';
const BREW_GUIDE_CALENDAR_COLOR = '#6F4E37';
const ANDROID_LOCAL_ACCOUNT = 'brew-guide.local';

const isNativeCalendarSupported = (): boolean => {
  const platform = Capacitor.getPlatform();
  return (
    Capacitor.isNativePlatform() &&
    (platform === 'ios' || platform === 'android')
  );
};

export const toNativeCalendarDateTimestamp = (
  date: string,
  platform: string = Capacitor.getPlatform()
): number => {
  const [year, month, day] = date.split('-').map(Number);
  if (platform === 'android') {
    return Date.UTC(year, month - 1, day);
  }

  return new Date(year, month - 1, day).getTime();
};

const toNativeEventPayload = (
  candidate: CalendarEventCandidate,
  calendarId: string
) => ({
  title: candidate.title,
  calendarId,
  startDate: toNativeCalendarDateTimestamp(candidate.startDate),
  endDate: toNativeCalendarDateTimestamp(candidate.endDate),
  isAllDay: true,
  description: candidate.description,
});

export const ensureCalendarWriteAccess = async (): Promise<boolean> => {
  if (!isNativeCalendarSupported()) return false;

  const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
  const permission = await CapacitorCalendar.requestFullCalendarAccess();
  return permission.result === 'granted';
};

export const ensureBrewGuideCalendarId = async (): Promise<string> => {
  const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
  const storedCalendarId = loadCalendarId();
  const calendars = await CapacitorCalendar.listCalendars();

  const storedCalendar = calendars.result.find(
    calendar =>
      calendar.id === storedCalendarId &&
      calendar.allowsContentModifications !== false
  );

  if (storedCalendar) {
    return storedCalendar.id;
  }

  const existingCalendar = calendars.result.find(
    calendar =>
      calendar.title === BREW_GUIDE_CALENDAR_TITLE &&
      calendar.allowsContentModifications !== false
  );

  if (existingCalendar) {
    saveCalendarId(existingCalendar.id);
    return existingCalendar.id;
  }

  const created = await CapacitorCalendar.createCalendar({
    title: BREW_GUIDE_CALENDAR_TITLE,
    color: BREW_GUIDE_CALENDAR_COLOR,
    accountName: ANDROID_LOCAL_ACCOUNT,
    ownerAccount: ANDROID_LOCAL_ACCOUNT,
  });

  saveCalendarId(created.id);
  return created.id;
};

export const createNativeCalendarEvent = async (
  candidate: CalendarEventCandidate,
  calendarId: string
): Promise<string> => {
  const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
  const result = await CapacitorCalendar.createEvent(
    toNativeEventPayload(candidate, calendarId)
  );
  return result.id;
};

export const updateNativeCalendarEvent = async (
  nativeEventId: string,
  candidate: CalendarEventCandidate,
  calendarId: string
): Promise<void> => {
  const { CapacitorCalendar, EventSpan } =
    await import('@ebarooni/capacitor-calendar');
  await CapacitorCalendar.modifyEvent({
    id: nativeEventId,
    ...toNativeEventPayload(candidate, calendarId),
    span: EventSpan.THIS_EVENT,
  });
};

export const deleteNativeCalendarEvent = async (
  nativeEventId: string
): Promise<void> => {
  const { CapacitorCalendar, EventSpan } =
    await import('@ebarooni/capacitor-calendar');
  await CapacitorCalendar.deleteEvent({
    id: nativeEventId,
    span: EventSpan.THIS_EVENT,
  });
};

export const canUseNativeCalendar = isNativeCalendarSupported;
