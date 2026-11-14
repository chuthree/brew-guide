'use client';

import type { BrewingNote } from '@/lib/core/config';
import { SORT_OPTIONS, type SortOption } from './types';
import {
  resolveNoteCoffeeBeanInfo,
  type CoffeeBeanLookup,
} from '@/lib/notes/noteDisplay';

interface NoteDeleteDisplay {
  itemName: string;
  itemSuffix?: string;
}

export interface WeightedSearchText {
  text: string;
  weight: number;
}

const NOTE_DELETE_NAME_MAX_LENGTH = 18;

const getNoteTextPreview = (text: string): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= NOTE_DELETE_NAME_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, NOTE_DELETE_NAME_MAX_LENGTH)}...`;
};

export const getNoteDeleteDisplay = (
  note: BrewingNote,
  coffeeBeanLookup?: CoffeeBeanLookup
): NoteDeleteDisplay => {
  const resolvedBeanInfo = resolveNoteCoffeeBeanInfo(note, coffeeBeanLookup);
  const beanName = resolvedBeanInfo?.name?.trim() || '未知咖啡豆';

  if (note.source === 'quick-decrement') {
    return {
      itemName: beanName,
      itemSuffix: '的快捷扣除记录',
    };
  }

  if (note.source === 'capacity-adjustment') {
    return {
      itemName: beanName,
      itemSuffix: '的容量调整记录',
    };
  }

  if (note.source === 'roasting') {
    return {
      itemName: beanName,
      itemSuffix: '的烘焙记录',
    };
  }

  const notePreview = getNoteTextPreview(note.notes || '');
  if (notePreview) {
    return { itemName: notePreview };
  }

  if (resolvedBeanInfo?.name?.trim()) {
    return { itemName: resolvedBeanInfo.name.trim() };
  }

  return { itemName: '此笔记' };
};

const normalizeSearchText = (text: string | undefined | null): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text.trim().toLowerCase();
};

export const splitSearchTerms = (query: string): string[] => {
  return normalizeSearchText(query)
    .split(/\s+/)
    .map(term => term.trim())
    .filter(Boolean);
};

const dedupeWeightedSearchTexts = (
  searchableTexts: WeightedSearchText[]
): WeightedSearchText[] => {
  const weightByText = new Map<string, number>();

  searchableTexts.forEach(({ text, weight }) => {
    const normalizedText = normalizeSearchText(text);

    if (!normalizedText) {
      return;
    }

    const currentWeight = weightByText.get(normalizedText) ?? 0;
    if (weight > currentWeight) {
      weightByText.set(normalizedText, weight);
    }
  });

  return Array.from(weightByText.entries()).map(([text, weight]) => ({
    text,
    weight,
  }));
};

export const buildNoteSearchableTexts = (
  note: BrewingNote,
  coffeeBeanLookup?: CoffeeBeanLookup
): WeightedSearchText[] => {
  const resolvedBeanInfo = resolveNoteCoffeeBeanInfo(note, coffeeBeanLookup);
  const localeDateText = note.timestamp
    ? new Date(note.timestamp).toLocaleDateString()
    : '';
  const absoluteDateText = note.timestamp
    ? formatDateAbsolute(note.timestamp)
    : '';
  const totalTimeText = note.totalTime ? `${note.totalTime}秒` : '';
  const ratingText = note.rating
    ? `评分${note.rating} ${note.rating}分 ${note.rating}星`
    : '';
  const tasteText = `酸度${note.taste?.acidity || 0} 甜度${note.taste?.sweetness || 0} 苦度${note.taste?.bitterness || 0} 醇厚度${note.taste?.body || 0}`;

  return dedupeWeightedSearchTexts([
    { text: note.coffeeBeanInfo?.name || '', weight: 3 },
    { text: resolvedBeanInfo?.name || '', weight: 3 },
    { text: resolvedBeanInfo?.roaster || '', weight: 3 },
    {
      text:
        resolvedBeanInfo?.name && resolvedBeanInfo?.roaster
          ? `${resolvedBeanInfo.roaster} ${resolvedBeanInfo.name}`
          : '',
      weight: 3,
    },
    {
      text:
        resolvedBeanInfo?.name && resolvedBeanInfo?.roaster
          ? `${resolvedBeanInfo.roaster}/${resolvedBeanInfo.name}`
          : '',
      weight: 3,
    },
    { text: note.coffeeBeanInfo?.roastLevel || '', weight: 1 },
    { text: note.equipmentName || note.equipment || '', weight: 2 },
    { text: note.methodName || note.method || '', weight: 2 },
    { text: note.notes || '', weight: 2 },
    { text: note.params?.coffee || '', weight: 1 },
    { text: note.params?.water || '', weight: 1 },
    { text: note.params?.ratio || '', weight: 1 },
    { text: note.params?.grindSize || '', weight: 1 },
    { text: note.params?.temp || '', weight: 1 },
    { text: tasteText, weight: 1 },
    { text: localeDateText, weight: 1 },
    { text: absoluteDateText, weight: 1 },
    { text: totalTimeText, weight: 1 },
    { text: ratingText, weight: 1 },
  ]);
};

const matchesSearchTerms = (
  queryTerms: string[],
  searchableTexts: WeightedSearchText[]
): boolean =>
  queryTerms.every(term =>
    searchableTexts.some(({ text }) => text.includes(term))
  );

export const filterSearchableNotes = (
  entries: Array<{
    note: BrewingNote;
    searchableTexts: WeightedSearchText[];
  }>,
  query: string
): BrewingNote[] => {
  const queryTerms = splitSearchTerms(query);
  if (queryTerms.length === 0) return entries.map(({ note }) => note);

  return entries
    .filter(({ searchableTexts }) =>
      matchesSearchTerms(queryTerms, searchableTexts)
    )
    .map(({ note }) => note);
};

// 日期格式化函数
export const formatDate = (timestamp: number): string => {
  const now = Date.now();
  const date = new Date(timestamp);
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  // 1分钟内：刚刚
  if (seconds < 60) {
    return '刚刚';
  }
  // 1小时内：N分钟前
  else if (minutes < 60) {
    return `${minutes}分钟前`;
  }
  // 今天：N小时前
  else if (isToday(date)) {
    return `${hours}小时前`;
  }
  // 昨天：昨天 HH:mm
  else if (isYesterday(date)) {
    return `昨天 ${formatTime(date)}`;
  }
  // 今年内：MM月DD日 HH:mm
  else if (isThisYear(date)) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${formatTime(date)}`;
  }
  // 更早：YYYY年MM月DD日 HH:mm
  else {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${formatTime(date)}`;
  }
};

// 绝对日期格式（旧版列表使用）
export const formatDateAbsolute = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// 笔记详情使用精确到分钟的固定时间，避免停留在相对时间文案。
export const formatNoteDetailDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${formatTime(date)}`;
};

// 辅助函数：判断是否是今天
const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

// 辅助函数：判断是否是昨天
const isYesterday = (date: Date): boolean => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
};

// 辅助函数：判断是否是今年
const isThisYear = (date: Date): boolean => {
  const today = new Date();
  return date.getFullYear() === today.getFullYear();
};

// 辅助函数：格式化时间为 HH:mm
const formatTime = (date: Date): string => {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 评分格式化函数
export const formatRating = (rating: number): string => {
  return `[ ${rating}/5 ]`;
};

// 计算总咖啡消耗量的函数
export const calculateTotalCoffeeConsumption = (
  notes: BrewingNote[]
): number => {
  return notes.reduce((total, note) => {
    // 只排除容量调整记录，快捷扣除记录需要计入统计
    if (note.source === 'capacity-adjustment') {
      return total;
    }

    // 处理快捷扣除记录
    if (note.source === 'quick-decrement' && note.quickDecrementAmount) {
      const coffeeAmount = note.quickDecrementAmount;
      if (!isNaN(coffeeAmount)) {
        return total + coffeeAmount;
      }
    } else if (note.params && note.params.coffee) {
      // 处理普通冲煮笔记
      // 提取咖啡量中的数字部分
      const match = note.params.coffee.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const coffeeAmount = parseFloat(match[0]);
        if (!isNaN(coffeeAmount)) {
          return total + coffeeAmount;
        }
      }
    }
    return total;
  }, 0);
};

// 笔记排序函数
export const sortNotes = (
  notes: BrewingNote[],
  sortOption: SortOption
): BrewingNote[] => {
  switch (sortOption) {
    case SORT_OPTIONS.TIME_DESC:
      return [...notes].sort((a, b) => b.timestamp - a.timestamp);
    case SORT_OPTIONS.TIME_ASC:
      return [...notes].sort((a, b) => a.timestamp - b.timestamp);
    case SORT_OPTIONS.RATING_DESC:
      return [...notes].sort((a, b) => b.rating - a.rating);
    case SORT_OPTIONS.RATING_ASC:
      return [...notes].sort((a, b) => a.rating - b.rating);
    default:
      return notes;
  }
};

// 消耗量显示格式的函数
export const formatConsumption = (amount: number): string => {
  if (amount < 1000) {
    return `${Math.round(amount)}g`;
  } else {
    return `${(amount / 1000).toFixed(2)}kg`;
  }
};
