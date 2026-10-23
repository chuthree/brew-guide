import { useMemo } from 'react';
import type { CoffeeBeanGroup } from '@/lib/data/models';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import type { FlavorPeriodStatus } from '@/lib/utils/beanVarietyUtils';
import type { BeanFieldId } from '@/lib/coffee-beans/beanFields';
import type {
  BeanFilterMode,
  BeanState,
  BeanType,
  ExtendedCoffeeBean,
} from '../types';
import type { SortOption } from '../SortSelector';
import {
  buildBeanListRecords,
  createBeanInventorySnapshot,
  type BeanListRecord,
  type BeanTypeStats,
  type BeanFilterOptionCounts,
} from '../beanListPipeline';

interface UseEnhancedBeanFilteringProps {
  multiFilters?: Partial<Record<BeanFilterMode, string>>;
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
  filterOptionCounts: BeanFilterOptionCounts;
  records: BeanListRecord[];
  filteredRecords: BeanListRecord[];
  emptyRecords: BeanListRecord[];
  searchableEmptyRecords: BeanListRecord[];
  tableFilteredRecords: BeanListRecord[];
  tableEmptyRecords: BeanListRecord[];
  filteredBeans: ExtendedCoffeeBean[];
  emptyBeans: ExtendedCoffeeBean[];
  tableFilteredBeans: ExtendedCoffeeBean[];
  tableEmptyBeans: ExtendedCoffeeBean[];
  availableVarieties: string[];
  availableOrigins: string[];
  availableProcessingMethods: string[];
  availableBeanFieldValues: Partial<Record<BeanFieldId, string[]>>;
  availableFlavorPeriods: FlavorPeriodStatus[];
  availableRoasters: string[];
  availableBeanGroups: CoffeeBeanGroup[];
  currentStateBeanCount: number;
  hasEmptyBeansInCurrentState: boolean;
  typeStats: BeanTypeStats;
}

export const useEnhancedBeanFiltering = ({
  multiFilters,
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
  const coffeeBeanGroups = useSettingsStore(
    state => state.settings.coffeeBeanGroups
  );

  const records = useMemo(() => buildBeanListRecords(beans), [beans]);

  const snapshot = useMemo(
    () =>
      createBeanInventorySnapshot(records, {
        multiFilters,
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
        coffeeBeanGroups,
      }),
    [
      records,
      multiFilters,
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
      coffeeBeanGroups,
    ]
  );

  return {
    filterOptionCounts: snapshot.filterOptionCounts,
    records,
    filteredRecords: snapshot.filteredRecords,
    emptyRecords: snapshot.emptyRecords,
    searchableEmptyRecords: snapshot.searchableEmptyRecords,
    tableFilteredRecords: snapshot.tableFilteredRecords,
    tableEmptyRecords: snapshot.tableEmptyRecords,
    filteredBeans: snapshot.filteredBeans,
    emptyBeans: snapshot.emptyBeans,
    tableFilteredBeans: snapshot.tableFilteredBeans,
    tableEmptyBeans: snapshot.tableEmptyBeans,
    availableVarieties: snapshot.availableVarieties,
    availableOrigins: snapshot.availableOrigins,
    availableProcessingMethods: snapshot.availableProcessingMethods,
    availableBeanFieldValues: snapshot.availableBeanFieldValues,
    availableFlavorPeriods: snapshot.availableFlavorPeriods,
    availableRoasters: snapshot.availableRoasters,
    availableBeanGroups: snapshot.availableBeanGroups,
    currentStateBeanCount: snapshot.currentStateBeanCount,
    hasEmptyBeansInCurrentState: snapshot.hasEmptyBeansInCurrentState,
    typeStats: snapshot.typeStats,
  };
};
