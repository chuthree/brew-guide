import { isBeanEmpty } from './preferences';
import { type SortOption, sortBeans } from './SortSelector';
import type {
  ExtendedCoffeeBean,
  BeanFilterMode,
  BeanState,
  BeanType,
} from './types';
import type { CoffeeBeanGroup } from '@/lib/core/db';
import { getBeanRoasterName } from '@/lib/utils/coffeeBeanUtils';
import {
  FlavorPeriodStatus,
  extractUniqueRoasters,
  getBeanFlavorPeriodStatus,
  getBeanOrigins,
  getBeanProcesses,
  getBeanVarieties,
} from '@/lib/utils/beanVarietyUtils';
import { getSortedCoffeeBeanGroups } from '@/lib/utils/coffeeBeanGroupUtils';

type SearchField = {
  text: string;
  weight: number;
};

export interface BeanListRecord {
  bean: ExtendedCoffeeBean;
  beanState: BeanState;
  beanType: Exclude<BeanType, 'all'> | null;
  isEmpty: boolean;
  varieties: string[];
  origins: string[];
  processes: string[];
  roaster: string;
  flavorStatus: FlavorPeriodStatus;
  searchDocument: string;
  searchFields: SearchField[];
}

export interface BeanTypeStats {
  espressoCount: number;
  filterCount: number;
  omniCount: number;
  espressoRemaining: number;
  filterRemaining: number;
  omniRemaining: number;
}

export interface BeanInventorySnapshotOptions {
  filterMode: BeanFilterMode;
  selectedVariety: string | null;
  selectedOrigin: string | null;
  selectedProcessingMethod: string | null;
  selectedFlavorPeriod: FlavorPeriodStatus | null;
  selectedRoaster: string | null;
  selectedBeanGroupId: string | null;
  selectedBeanType: BeanType;
  selectedBeanState: BeanState;
  showEmptyBeans: boolean;
  coffeeBeanGroups?: CoffeeBeanGroup[];
  sortOption?: SortOption;
}

export interface BeanInventorySnapshot {
  filteredRecords: BeanListRecord[];
  emptyRecords: BeanListRecord[];
  tableFilteredRecords: BeanListRecord[];
  tableEmptyRecords: BeanListRecord[];
  filteredBeans: ExtendedCoffeeBean[];
  emptyBeans: ExtendedCoffeeBean[];
  tableFilteredBeans: ExtendedCoffeeBean[];
  tableEmptyBeans: ExtendedCoffeeBean[];
  availableVarieties: string[];
  availableOrigins: string[];
  availableProcessingMethods: string[];
  availableFlavorPeriods: FlavorPeriodStatus[];
  availableRoasters: string[];
  availableBeanGroups: CoffeeBeanGroup[];
  currentStateBeanCount: number;
  hasEmptyBeansInCurrentState: boolean;
  typeStats: BeanTypeStats;
}

const DEFAULT_TYPE_STATS: BeanTypeStats = {
  espressoCount: 0,
  filterCount: 0,
  omniCount: 0,
  espressoRemaining: 0,
  filterRemaining: 0,
  omniRemaining: 0,
};

const EMPTY_GROUPS: CoffeeBeanGroup[] = [];
const FLAVOR_PERIOD_FILTER_PRIORITY: FlavorPeriodStatus[] = [
  FlavorPeriodStatus.OPTIMAL,
  FlavorPeriodStatus.DECLINE,
  FlavorPeriodStatus.AGING,
  FlavorPeriodStatus.FROZEN,
  FlavorPeriodStatus.IN_TRANSIT,
  FlavorPeriodStatus.UNKNOWN,
];

const normalizeSearchText = (value: string): string =>
  value.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

const toSearchTokens = (value: string): string[] =>
  normalizeSearchText(value)
    .split(' ')
    .map(token => token.trim())
    .filter(Boolean);

const uniqueNormalizedValues = (
  values?: Array<string | number | null | undefined>
): string[] => {
  if (!values) {
    return [];
  }

  const normalized = values
    .map(value => normalizeSearchText(String(value ?? '')))
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const buildSearchFields = (bean: ExtendedCoffeeBean): SearchField[] => {
  const originTexts = uniqueNormalizedValues(
    bean.blendComponents?.map(component => component.origin)
  );
  const estateTexts = uniqueNormalizedValues(
    bean.blendComponents?.map(component => component.estate)
  );
  const processTexts = uniqueNormalizedValues(
    bean.blendComponents?.map(component => component.process)
  );
  const varietyTexts = uniqueNormalizedValues(
    bean.blendComponents?.map(component => component.variety)
  );
  const blendComponentTexts = uniqueNormalizedValues(
    bean.blendComponents?.map(
      component =>
        `${component.percentage ?? ''} ${component.origin ?? ''} ${
          component.estate ?? ''
        } ${component.process ?? ''} ${component.variety ?? ''}`
    )
  );

  const fields: SearchField[] = [
    { text: normalizeSearchText(bean.name || ''), weight: 3 },
    { text: normalizeSearchText(bean.roaster || ''), weight: 3 },
    { text: originTexts.join(' '), weight: 2 },
    { text: estateTexts.join(' '), weight: 2 },
    { text: processTexts.join(' '), weight: 2 },
    { text: normalizeSearchText(bean.notes || ''), weight: 1 },
    { text: normalizeSearchText(bean.roastLevel || ''), weight: 1 },
    {
      text: normalizeSearchText(bean.roastDate || bean.purchaseDate || ''),
      weight: 1,
    },
    { text: normalizeSearchText(bean.price || ''), weight: 1 },
    { text: normalizeSearchText(bean.beanType || ''), weight: 2 },
    { text: uniqueNormalizedValues(bean.flavor || []).join(' '), weight: 2 },
    { text: blendComponentTexts.join(' '), weight: 2 },
    { text: normalizeSearchText(bean.capacity || ''), weight: 1 },
    { text: normalizeSearchText(bean.remaining || ''), weight: 1 },
    {
      text: normalizeSearchText(`${bean.startDay ?? ''} ${bean.endDay ?? ''}`),
      weight: 1,
    },
    { text: varietyTexts.join(' '), weight: 2 },
  ];

  return fields.filter(field => field.text.length > 0);
};

const parseRemaining = (bean: ExtendedCoffeeBean): number => {
  const parsed = Number.parseFloat(bean.remaining || '0');
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortCategoryEntries = (
  counts: Map<string, number>,
  nonEmptyCounts: Map<string, number>
): string[] =>
  Array.from(counts.keys()).sort((left, right) => {
    const leftNonEmpty = nonEmptyCounts.get(left) || 0;
    const rightNonEmpty = nonEmptyCounts.get(right) || 0;

    if (leftNonEmpty !== rightNonEmpty) {
      return rightNonEmpty - leftNonEmpty;
    }

    const leftHasNonEmpty = leftNonEmpty > 0;
    const rightHasNonEmpty = rightNonEmpty > 0;
    if (leftHasNonEmpty !== rightHasNonEmpty) {
      return leftHasNonEmpty ? -1 : 1;
    }

    return left.localeCompare(right, 'zh-CN');
  });

const sortFlavorStatuses = (
  counts: Map<FlavorPeriodStatus, number>
): FlavorPeriodStatus[] =>
  FLAVOR_PERIOD_FILTER_PRIORITY.filter(status => counts.has(status));

const sortInventoryRecords = (
  records: BeanListRecord[],
  sortOption: SortOption,
  isEmptyFilter: boolean
): BeanListRecord[] => {
  if (records.length === 0) return [];

  const shouldUseTimestampSort =
    isEmptyFilter &&
    (sortOption === 'remaining_amount_asc' ||
      sortOption === 'remaining_amount_desc' ||
      sortOption === 'remaining_days_asc' ||
      sortOption === 'remaining_days_desc');

  if (shouldUseTimestampSort) {
    return [...records].sort(
      (left, right) => right.bean.timestamp - left.bean.timestamp
    );
  }

  const beanMap = new Map(records.map(record => [record.bean.id, record]));
  return sortBeans(
    records.map(record => record.bean),
    sortOption
  )
    .map(bean => beanMap.get(bean.id))
    .filter((record): record is BeanListRecord => Boolean(record));
};

const matchesSelectedBeanType = (
  record: BeanListRecord,
  selectedBeanType: BeanType
): boolean =>
  selectedBeanType === 'all' ? true : record.beanType === selectedBeanType;

const matchesSelectedGroup = (
  record: BeanListRecord,
  selectedGroupIds: Set<string> | null
): boolean => (selectedGroupIds ? selectedGroupIds.has(record.bean.id) : true);

const matchesFilterMode = (
  record: BeanListRecord,
  options: BeanInventorySnapshotOptions,
  selectedGroupIds: Set<string> | null
): boolean => {
  switch (options.filterMode) {
    case 'variety':
      return options.selectedVariety
        ? record.varieties.includes(options.selectedVariety)
        : true;
    case 'origin':
      return options.selectedOrigin
        ? record.origins.includes(options.selectedOrigin)
        : true;
    case 'processingMethod':
      return options.selectedProcessingMethod
        ? record.processes.includes(options.selectedProcessingMethod)
        : true;
    case 'flavorPeriod':
      if (!options.selectedFlavorPeriod) return true;
      return (
        !record.isEmpty && record.flavorStatus === options.selectedFlavorPeriod
      );
    case 'roaster':
      return options.selectedRoaster
        ? record.roaster === options.selectedRoaster
        : true;
    case 'group':
      return matchesSelectedGroup(record, selectedGroupIds);
    default:
      return true;
  }
};

const incrementMapCount = <T>(map: Map<T, number>, key: T) => {
  map.set(key, (map.get(key) || 0) + 1);
};

const recordTypeStat = (stats: BeanTypeStats, record: BeanListRecord) => {
  const remaining = parseRemaining(record.bean);

  switch (record.beanType) {
    case 'espresso':
      stats.espressoCount += 1;
      stats.espressoRemaining += remaining;
      break;
    case 'filter':
      stats.filterCount += 1;
      stats.filterRemaining += remaining;
      break;
    case 'omni':
      stats.omniCount += 1;
      stats.omniRemaining += remaining;
      break;
  }
};

export const summarizeBeanTypeStats = (
  beans: ExtendedCoffeeBean[]
): BeanTypeStats => {
  const stats = { ...DEFAULT_TYPE_STATS };

  for (const bean of beans) {
    const beanType = bean.beanType;
    if (!beanType) continue;

    const remaining = parseRemaining(bean);
    if (beanType === 'espresso') {
      stats.espressoCount += 1;
      stats.espressoRemaining += remaining;
    } else if (beanType === 'filter') {
      stats.filterCount += 1;
      stats.filterRemaining += remaining;
    } else if (beanType === 'omni') {
      stats.omniCount += 1;
      stats.omniRemaining += remaining;
    }
  }

  return stats;
};

export const buildBeanListRecords = (
  beans: ExtendedCoffeeBean[]
): BeanListRecord[] =>
  beans.map(bean => {
    const searchFields = buildSearchFields(bean);

    return {
      bean,
      beanState: bean.beanState || 'roasted',
      beanType: bean.beanType || null,
      isEmpty: isBeanEmpty(bean),
      varieties: getBeanVarieties(bean),
      origins: getBeanOrigins(bean),
      processes: getBeanProcesses(bean),
      roaster: getBeanRoasterName(bean),
      flavorStatus: getBeanFlavorPeriodStatus(bean),
      searchDocument: searchFields.map(field => field.text).join('\n'),
      searchFields,
    };
  });

export const searchBeanRecords = (
  records: BeanListRecord[],
  query: string
): BeanListRecord[] => {
  const tokens = toSearchTokens(query);
  if (tokens.length === 0) {
    return records;
  }

  const matches = records
    .map(record => {
      for (const token of tokens) {
        if (!record.searchDocument.includes(token)) {
          return null;
        }
      }

      let score = 0;
      for (const token of tokens) {
        for (const field of record.searchFields) {
          if (!field.text.includes(token)) continue;

          score += field.weight;
          if (field.text === token) {
            score += field.weight * 2;
          }
          if (field.text.startsWith(token)) {
            score += field.weight;
          }
        }
      }

      return { record, score };
    })
    .filter(
      (entry): entry is { record: BeanListRecord; score: number } =>
        entry !== null
    );

  matches.sort((left, right) => right.score - left.score);
  return matches.map(entry => entry.record);
};

export const createBeanInventorySnapshot = (
  records: BeanListRecord[],
  options: BeanInventorySnapshotOptions
): BeanInventorySnapshot => {
  const selectedGroup = getSortedCoffeeBeanGroups(
    options.coffeeBeanGroups || EMPTY_GROUPS
  ).find(group => group.id === options.selectedBeanGroupId);
  const selectedGroupIds = selectedGroup
    ? new Set(selectedGroup.beanIds || [])
    : null;

  const currentStateRecords: BeanListRecord[] = [];
  const filteredRecords: BeanListRecord[] = [];
  const emptyRecords: BeanListRecord[] = [];

  const availableVarietyCounts = new Map<string, number>();
  const availableVarietyNonEmptyCounts = new Map<string, number>();
  const availableOriginCounts = new Map<string, number>();
  const availableOriginNonEmptyCounts = new Map<string, number>();
  const availableProcessCounts = new Map<string, number>();
  const availableProcessNonEmptyCounts = new Map<string, number>();
  const availableFlavorCounts = new Map<FlavorPeriodStatus, number>();
  const availableBeanCandidates: ExtendedCoffeeBean[] = [];

  let currentStateBeanCount = 0;
  let hasEmptyBeansInCurrentState = false;
  const typeStats = { ...DEFAULT_TYPE_STATS };

  for (const record of records) {
    if (record.beanState !== options.selectedBeanState) {
      continue;
    }

    currentStateBeanCount += 1;
    currentStateRecords.push(record);

    if (record.isEmpty) {
      hasEmptyBeansInCurrentState = true;
    }

    const includeByEmpty = options.showEmptyBeans || !record.isEmpty;
    const matchesMode = matchesFilterMode(record, options, selectedGroupIds);
    const matchesBeanType = matchesSelectedBeanType(
      record,
      options.selectedBeanType
    );

    if (includeByEmpty && matchesMode) {
      recordTypeStat(typeStats, record);
    }

    if (includeByEmpty && matchesBeanType) {
      availableBeanCandidates.push(record.bean);
      for (const variety of record.varieties) {
        incrementMapCount(availableVarietyCounts, variety);
        if (!record.isEmpty) {
          incrementMapCount(availableVarietyNonEmptyCounts, variety);
        }
      }
      for (const origin of record.origins) {
        incrementMapCount(availableOriginCounts, origin);
        if (!record.isEmpty) {
          incrementMapCount(availableOriginNonEmptyCounts, origin);
        }
      }
      for (const process of record.processes) {
        incrementMapCount(availableProcessCounts, process);
        if (!record.isEmpty) {
          incrementMapCount(availableProcessNonEmptyCounts, process);
        }
      }
      if (!record.isEmpty) {
        incrementMapCount(availableFlavorCounts, record.flavorStatus);
      }
    }

    if (!(includeByEmpty && matchesBeanType && matchesMode)) {
      continue;
    }

    if (record.isEmpty) {
      emptyRecords.push(record);
    } else {
      filteredRecords.push(record);
    }
  }

  const sortedFilteredRecords = sortInventoryRecords(
    filteredRecords,
    options.sortOption || 'remaining_days_asc',
    false
  );
  const sortedEmptyRecords = sortInventoryRecords(
    emptyRecords,
    options.sortOption || 'remaining_days_asc',
    true
  );

  const tableFilteredBeans = filteredRecords.map(record => record.bean);
  const tableEmptyBeans = options.showEmptyBeans
    ? emptyRecords.map(record => record.bean)
    : [];
  const filteredBeans = sortedFilteredRecords.map(record => record.bean);
  const emptyBeans = options.showEmptyBeans
    ? sortedEmptyRecords.map(record => record.bean)
    : [];

  const availableRoasters = extractUniqueRoasters(availableBeanCandidates);

  return {
    filteredRecords: sortedFilteredRecords,
    emptyRecords: options.showEmptyBeans ? sortedEmptyRecords : [],
    tableFilteredRecords: filteredRecords,
    tableEmptyRecords: options.showEmptyBeans ? emptyRecords : [],
    filteredBeans,
    emptyBeans,
    tableFilteredBeans,
    tableEmptyBeans,
    availableVarieties: sortCategoryEntries(
      availableVarietyCounts,
      availableVarietyNonEmptyCounts
    ),
    availableOrigins: sortCategoryEntries(
      availableOriginCounts,
      availableOriginNonEmptyCounts
    ),
    availableProcessingMethods: sortCategoryEntries(
      availableProcessCounts,
      availableProcessNonEmptyCounts
    ),
    availableFlavorPeriods: sortFlavorStatuses(availableFlavorCounts),
    availableRoasters,
    availableBeanGroups: getSortedCoffeeBeanGroups(
      options.coffeeBeanGroups || EMPTY_GROUPS
    ).filter(group =>
      availableBeanCandidates.some(bean =>
        (group.beanIds || []).includes(bean.id)
      )
    ),
    currentStateBeanCount,
    hasEmptyBeansInCurrentState,
    typeStats,
  };
};
