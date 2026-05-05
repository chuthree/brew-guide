import { useMemo, useCallback } from 'react';
import {
  ExtendedCoffeeBean,
  BeanType,
  BeanState,
  BeanFilterMode,
} from '../types';
import { SortOption, sortBeans } from '../SortSelector';
import { isBeanEmpty } from '../preferences';
import {
  beanHasVariety,
  extractUniqueVarieties,
  beanHasOrigin,
  extractUniqueOrigins,
  beanHasProcess,
  extractUniqueProcesses,
  beanHasFlavorPeriodStatus,
  extractAvailableFlavorPeriodStatuses,
  beanHasRoaster,
  extractUniqueRoasters,
  FlavorPeriodStatus,
  RoasterSettings,
} from '@/lib/utils/beanVarietyUtils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import type { CoffeeBeanGroup } from '@/lib/core/db';
import {
  beanBelongsToGroup,
  getAvailableCoffeeBeanGroups,
} from '@/lib/utils/coffeeBeanGroupUtils';

interface UseEnhancedBeanFilteringProps {
  beans: ExtendedCoffeeBean[];
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
  sortOption: SortOption;
}

interface UseEnhancedBeanFilteringReturn {
  filteredBeans: ExtendedCoffeeBean[]; // 列表/图片流使用（已应用列表排序）
  emptyBeans: ExtendedCoffeeBean[]; // 已用完的豆子（已应用列表排序）
  tableFilteredBeans: ExtendedCoffeeBean[]; // 表格使用（仅筛选，不应用列表排序）
  tableEmptyBeans: ExtendedCoffeeBean[]; // 表格使用的已用完豆子（仅筛选，不应用列表排序）
  availableVarieties: string[];
  availableOrigins: string[];
  availableProcessingMethods: string[];
  availableFlavorPeriods: FlavorPeriodStatus[];
  availableRoasters: string[];
  availableBeanGroups: CoffeeBeanGroup[];
}

/**
 * 增强的咖啡豆筛选和排序Hook
 * 支持多种分类模式：品种、产地、赏味期、烘焙商
 */
export const useEnhancedBeanFiltering = ({
  beans,
  filterMode,
  selectedVariety,
  selectedOrigin,
  selectedProcessingMethod,
  selectedFlavorPeriod,
  selectedRoaster,
  selectedBeanGroupId,
  selectedBeanType,
  selectedBeanState,
  showEmptyBeans,
  sortOption,
}: UseEnhancedBeanFilteringProps): UseEnhancedBeanFilteringReturn => {
  // 获取烘焙商相关设置 - 使用单独的选择器避免无限循环
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const coffeeBeanGroups = useSettingsStore(
    state => state.settings.coffeeBeanGroups
  );

  // 使用 useMemo 缓存 roasterSettings 对象
  const roasterSettings = useMemo<RoasterSettings>(
    () => ({
      roasterFieldEnabled,
      roasterSeparator,
    }),
    [roasterFieldEnabled, roasterSeparator]
  );

  // 提取通用筛选逻辑（不排序）
  const filterBeans = useCallback(
    (beanList: ExtendedCoffeeBean[], isEmptyFilter: boolean) => {
      if (!beanList || beanList.length === 0) return [];

      let filtered = beanList;

      // 1. 按豆子状态筛选（生豆/熟豆）
      filtered = filtered.filter(bean => {
        const beanState = bean.beanState || 'roasted'; // 默认为熟豆
        return beanState === selectedBeanState;
      });

      // 2. 按豆子类型筛选
      if (selectedBeanType && selectedBeanType !== 'all') {
        filtered = filtered.filter(bean => bean.beanType === selectedBeanType);
      }

      // 3. 按是否用完筛选
      filtered = filtered.filter(bean =>
        isEmptyFilter ? isBeanEmpty(bean) : !isBeanEmpty(bean)
      );

      // 4. 根据当前分类模式进行筛选
      switch (filterMode) {
        case 'variety':
          if (selectedVariety) {
            filtered = filtered.filter(bean =>
              beanHasVariety(bean, selectedVariety)
            );
          }
          break;
        case 'origin':
          if (selectedOrigin) {
            filtered = filtered.filter(bean =>
              beanHasOrigin(bean, selectedOrigin)
            );
          }
          break;
        case 'processingMethod':
          if (selectedProcessingMethod) {
            filtered = filtered.filter(bean =>
              beanHasProcess(bean, selectedProcessingMethod)
            );
          }
          break;
        case 'flavorPeriod':
          if (selectedFlavorPeriod) {
            filtered = filtered.filter(bean =>
              beanHasFlavorPeriodStatus(bean, selectedFlavorPeriod)
            );
          }
          break;
        case 'roaster':
          if (selectedRoaster) {
            filtered = filtered.filter(bean =>
              beanHasRoaster(bean, selectedRoaster, roasterSettings)
            );
          }
          break;
        case 'group':
          if (selectedBeanGroupId) {
            const selectedGroup = coffeeBeanGroups?.find(
              group => group.id === selectedBeanGroupId
            );
            filtered = filtered.filter(bean =>
              beanBelongsToGroup(bean, selectedGroup)
            );
          }
          break;
      }

      return filtered;
    },
    [
      filterMode,
      selectedVariety,
      selectedOrigin,
      selectedProcessingMethod,
      selectedFlavorPeriod,
      selectedRoaster,
      selectedBeanGroupId,
      selectedBeanType,
      selectedBeanState,
      roasterSettings,
      coffeeBeanGroups,
    ]
  );

  // 仅对列表/图片流应用排序，表格视图复用筛选结果并交由列头排序控制
  const sortFilteredBeans = useCallback(
    (filtered: ExtendedCoffeeBean[], isEmptyFilter: boolean) => {
      if (!filtered.length) return [];

      const compatibleBeans = filtered.map(bean => ({
        id: bean.id,
        name: bean.name,
        roastDate: bean.roastDate,
        startDay: bean.startDay,
        endDay: bean.endDay,
        roastLevel: bean.roastLevel,
        capacity: bean.capacity,
        remaining: bean.remaining,
        timestamp: bean.timestamp,
        overallRating: bean.overallRating,
        price: bean.price,
        isInTransit: bean.isInTransit,
        isFrozen: bean.isFrozen,
      }));

      // 用完的豆子在使用"剩余量"或"赏味期"排序时，按最近喝完时间（timestamp）从新到旧排序
      const shouldUseTimestampSort =
        isEmptyFilter &&
        (sortOption === 'remaining_amount_asc' ||
          sortOption === 'remaining_amount_desc' ||
          sortOption === 'remaining_days_asc' ||
          sortOption === 'remaining_days_desc');

      let sortedBeans;
      if (shouldUseTimestampSort) {
        // 用完的豆子按 timestamp 降序排列（最近喝完的在前）
        sortedBeans = [...compatibleBeans].sort(
          (a, b) => b.timestamp - a.timestamp
        );
      } else {
        sortedBeans = sortBeans(compatibleBeans, sortOption);
      }

      const beanMap = new Map(filtered.map(bean => [bean.id, bean]));
      return sortedBeans
        .map(bean => beanMap.get(bean.id))
        .filter((bean): bean is ExtendedCoffeeBean => Boolean(bean));
    },
    [sortOption]
  );

  // 仅筛选结果（供表格视图使用）
  const tableFilteredBeans = useMemo(
    () => filterBeans(beans, false),
    [beans, filterBeans]
  );

  const tableEmptyBeans = useMemo(() => {
    if (!showEmptyBeans) return [];
    return filterBeans(beans, true);
  }, [beans, showEmptyBeans, filterBeans]);

  // 列表/图片流结果（应用筛选 + 列表排序）
  const filteredBeans = useMemo(
    () => sortFilteredBeans(tableFilteredBeans, false),
    [tableFilteredBeans, sortFilteredBeans]
  );

  const emptyBeans = useMemo(
    () => sortFilteredBeans(tableEmptyBeans, true),
    [tableEmptyBeans, sortFilteredBeans]
  );

  // 获取基础筛选后的豆子（用于计算可用分类选项）
  const baseFilteredBeans = useMemo(() => {
    if (!beans || beans.length === 0) return [];

    let filtered = beans;

    // 先按 beanState 筛选（生豆/熟豆）
    filtered = filtered.filter(bean => {
      const beanState = bean.beanState || 'roasted';
      return beanState === selectedBeanState;
    });

    // 按豆子类型筛选
    if (selectedBeanType && selectedBeanType !== 'all') {
      filtered = filtered.filter(bean => bean.beanType === selectedBeanType);
    }

    // 按是否显示空豆子筛选
    if (!showEmptyBeans) {
      filtered = filtered.filter(bean => !isBeanEmpty(bean));
    }

    return filtered;
  }, [beans, selectedBeanState, selectedBeanType, showEmptyBeans]);

  // 使用useMemo缓存可用品种列表
  const availableVarieties = useMemo(() => {
    return extractUniqueVarieties(baseFilteredBeans);
  }, [baseFilteredBeans]);

  // 使用useMemo缓存可用产地列表
  const availableOrigins = useMemo(() => {
    return extractUniqueOrigins(baseFilteredBeans);
  }, [baseFilteredBeans]);

  // 使用useMemo缓存可用处理法列表
  const availableProcessingMethods = useMemo(() => {
    return extractUniqueProcesses(baseFilteredBeans);
  }, [baseFilteredBeans]);

  // 使用useMemo缓存可用赏味期状态列表
  const availableFlavorPeriods = useMemo(() => {
    return extractAvailableFlavorPeriodStatuses(baseFilteredBeans);
  }, [baseFilteredBeans]);

  // 使用useMemo缓存可用烘焙商列表
  const availableRoasters = useMemo(() => {
    return extractUniqueRoasters(baseFilteredBeans, roasterSettings);
  }, [baseFilteredBeans, roasterSettings]);

  const availableBeanGroups = useMemo(() => {
    return getAvailableCoffeeBeanGroups(coffeeBeanGroups, baseFilteredBeans);
  }, [baseFilteredBeans, coffeeBeanGroups]);

  return {
    filteredBeans,
    emptyBeans,
    tableFilteredBeans,
    tableEmptyBeans,
    availableVarieties,
    availableOrigins,
    availableProcessingMethods,
    availableFlavorPeriods,
    availableRoasters,
    availableBeanGroups,
  };
};
