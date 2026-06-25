import type { CoffeeBean } from '../../types/app';
import { formatCoffeeBeanDisplayName } from '../utils/coffeeBeanUtils';

export interface CalendarSyncSettings {
  enabled: boolean;
}

export interface CalendarEventCandidate {
  stableId: string;
  beanId: string;
  title: string;
  date: string;
}

export interface BuildCalendarEventCandidatesOptions {
  today?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const parseISODateUTC = (date: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, monthIndex, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== monthIndex ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
};

const addDays = (date: string, days: number): string | null => {
  const timestamp = parseISODateUTC(date);
  if (timestamp === null) return null;

  return new Date(timestamp + days * DAY_MS).toISOString().slice(0, 10);
};

const getLocalISODate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseRemainingAmount = (remaining: string | undefined): number => {
  const match = (remaining || '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;

  const amount = Number.parseFloat(match[0]);
  return Number.isFinite(amount) ? amount : 0;
};

export const buildBeanCalendarEventCandidates = (
  bean: CoffeeBean,
  settings: CalendarSyncSettings,
  options: BuildCalendarEventCandidatesOptions = {}
): CalendarEventCandidate | null => {
  if (!settings.enabled) return null;
  if (bean.beanState === 'green') return null;
  if (bean.isFrozen || bean.isInTransit) return null;
  if (!bean.roastDate) return null;
  if (parseRemainingAmount(bean.remaining) <= 0) return null;

  const startDay = Number(bean.startDay || 0);
  if (!Number.isFinite(startDay) || startDay <= 0) return null;

  const flavorStart = addDays(bean.roastDate, startDay);
  if (!flavorStart) return null;
  if (flavorStart < (options.today || getLocalISODate())) return null;

  const displayName = formatCoffeeBeanDisplayName(bean);

  return {
    stableId: bean.id,
    beanId: bean.id,
    title: displayName,
    date: flavorStart,
  };
};
