import type { CoffeeBean } from '../../types/app';
import { formatCoffeeBeanDisplayName } from '../utils/coffeeBeanUtils';

export type CalendarEventKind = 'aging-period' | 'flavor-period';

export interface CalendarSyncSettings {
  enabled: boolean;
  syncAgingPeriod: boolean;
  syncFlavorPeriod: boolean;
}

export interface CalendarEventCandidate {
  stableId: string;
  beanId: string;
  kind: CalendarEventKind;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface BuildCalendarEventCandidatesOptions {
  resolvePeriod?: (bean: CoffeeBean) => { startDay: number; endDay: number };
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
): CalendarEventCandidate[] => {
  if (!settings.enabled) return [];
  if (bean.beanState === 'green') return [];
  if (bean.isFrozen || bean.isInTransit) return [];
  if (!bean.roastDate) return [];
  if (parseRemainingAmount(bean.remaining) <= 0) return [];

  const beanStartDay = Number(bean.startDay || 0);
  const beanEndDay = Number(bean.endDay || 0);
  const fallbackPeriod =
    beanStartDay === 0 && beanEndDay === 0
      ? options.resolvePeriod?.(bean)
      : undefined;
  const startDay = fallbackPeriod?.startDay ?? beanStartDay;
  const endDay = fallbackPeriod?.endDay ?? beanEndDay;

  if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) return [];
  if (startDay < 0 || endDay <= 0 || endDay < startDay) return [];

  const agingStart = bean.roastDate;
  const flavorStart = addDays(bean.roastDate, startDay);
  const agingEndDisplay = addDays(bean.roastDate, startDay - 1);
  const flavorEndInclusive = addDays(bean.roastDate, endDay);
  const flavorEndExclusive = addDays(bean.roastDate, endDay + 1);

  if (
    !flavorStart ||
    !agingEndDisplay ||
    !flavorEndInclusive ||
    !flavorEndExclusive
  ) {
    return [];
  }

  const displayName = formatCoffeeBeanDisplayName(bean);
  const events: CalendarEventCandidate[] = [];

  if (settings.syncAgingPeriod && startDay > 0) {
    events.push({
      stableId: `${bean.id}:aging-period`,
      beanId: bean.id,
      kind: 'aging-period',
      title: `养豆期｜${displayName}`,
      startDate: agingStart,
      endDate: agingEndDisplay,
      description: `Brew Guide 自动同步：${displayName}，烘焙日期 ${bean.roastDate}，养豆期至 ${agingEndDisplay}。`,
    });
  }

  if (settings.syncFlavorPeriod) {
    events.push({
      stableId: `${bean.id}:flavor-period`,
      beanId: bean.id,
      kind: 'flavor-period',
      title: `赏味期｜${displayName}`,
      startDate: flavorStart,
      endDate: flavorEndExclusive,
      description: `Brew Guide 自动同步：${displayName}，赏味期 ${flavorStart} 至 ${flavorEndInclusive}。`,
    });
  }

  return events;
};
