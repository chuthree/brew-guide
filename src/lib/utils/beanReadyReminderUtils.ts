import type { CoffeeBean } from '../../types/app';
import { formatCoffeeBeanDisplayName } from './coffeeBeanUtils';
import { normalizeDate } from './dateUtils';

export interface BeanReadyReminderItem {
  beanId: string;
  coffeeBean: string;
  daysUntilReady: number;
  daysText: string;
  readyDate: string;
}

export interface BuildBeanReadyReminderOptions {
  today?: string;
}

const STORAGE_KEY = 'beanReadyReminderLastShownDate';
const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_WINDOW_DAYS = 1;

const parseLocalDate = (date: string): Date | null => {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(normalizeDate(date));
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const formatLocalISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalISODate = (): string => formatLocalISODate(new Date());

const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const diffDays = (fromDate: Date, toDate: Date): number =>
  Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS);

const parseRemainingAmount = (remaining: string | undefined): number => {
  const match = (remaining || '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;

  const amount = Number.parseFloat(match[0]);
  return Number.isFinite(amount) ? amount : 0;
};

const resolveStartDay = (bean: CoffeeBean): number => {
  const beanStartDay = Number(bean.startDay || 0);
  return Number.isFinite(beanStartDay) && beanStartDay > 0 ? beanStartDay : 0;
};

export const formatBeanReadyReminderDays = (daysUntilReady: number): string =>
  daysUntilReady === 0 ? '当天' : `${daysUntilReady}天后`;

export const buildBeanReadyReminderItems = (
  beans: CoffeeBean[],
  options: BuildBeanReadyReminderOptions = {}
): BeanReadyReminderItem[] => {
  const today = parseLocalDate(options.today || getLocalISODate());
  if (!today) return [];

  return beans
    .map(bean => {
      if (bean.beanState === 'green') return null;
      if (bean.isFrozen || bean.isInTransit) return null;
      if (!bean.roastDate) return null;
      if (parseRemainingAmount(bean.remaining) <= 0) return null;

      const roastDate = parseLocalDate(bean.roastDate);
      if (!roastDate) return null;

      const startDay = resolveStartDay(bean);
      if (!Number.isFinite(startDay) || startDay <= 0) return null;

      const readyDate = addDays(roastDate, startDay);
      const daysUntilReady = diffDays(today, readyDate);

      if (daysUntilReady < 0 || daysUntilReady > REMINDER_WINDOW_DAYS) {
        return null;
      }

      return {
        beanId: bean.id,
        coffeeBean: formatCoffeeBeanDisplayName(bean),
        daysUntilReady,
        daysText: formatBeanReadyReminderDays(daysUntilReady),
        readyDate: formatLocalISODate(readyDate),
      };
    })
    .filter((item): item is BeanReadyReminderItem => item !== null)
    .sort((a, b) => {
      if (a.daysUntilReady !== b.daysUntilReady) {
        return a.daysUntilReady - b.daysUntilReady;
      }

      if (a.readyDate !== b.readyDate) {
        return a.readyDate.localeCompare(b.readyDate);
      }

      return a.coffeeBean.localeCompare(b.coffeeBean, 'zh-Hans-CN');
    });
};

export const shouldShowBeanReadyReminderToday = async (
  today = getLocalISODate()
): Promise<boolean> => {
  const { Storage } = await import('../core/storage');
  const lastShownDate = await Storage.get(STORAGE_KEY);
  return lastShownDate !== today;
};

export const markBeanReadyReminderShownToday = async (
  today = getLocalISODate()
): Promise<void> => {
  const { Storage } = await import('../core/storage');
  await Storage.set(STORAGE_KEY, today);
};
