import { useMemo, useCallback } from 'react';
import { debounce } from 'lodash';
import { ExtendedCoffeeBean, BeanType } from '../types';
import { SortOption, sortBeans } from '../SortSelector';
import { isBeanEmpty } from '../globalCache';
import {
  beanHasVariety,
  extractUniqueVarieties,
} from '@/lib/utils/beanVarietyUtils';

interface UseOptimizedBeanFilteringProps {
  beans: ExtendedCoffeeBean[];
  selectedVariety: string | null;
  selectedBeanType: BeanType;
  showEmptyBeans: boolean;
  sortOption: SortOption;
}

interface UseOptimizedBeanFilteringReturn {
  filteredBeans: ExtendedCoffeeBean[];
  availableVarieties: string[];
  debouncedUpdateFilters: (
    filters: Partial<UseOptimizedBeanFilteringProps>
  ) => void;
}

/**
 * 优化的咖啡豆筛选和排序Hook
 * 使用React.useMemo缓存计算结果，避免重复计算
 */
export const useOptimizedBeanFiltering = ({
  beans,
  selectedVariety,
  selectedBeanType,
  showEmptyBeans,
  sortOption,
}: UseOptimizedBeanFilteringProps): UseOptimizedBeanFilteringReturn => {
  // 使用useMemo缓存筛选后的豆子，只在依赖项变化时重新计算
  const filteredBeans = useMemo(() => {
    if (!beans || beans.length === 0) return [];

    let filtered = beans;

    // 1. 按豆子类型筛选
    if (selectedBeanType && selectedBeanType !== 'all') {
      filtered = filtered.filter(bean => bean.beanType === selectedBeanType);
    }

    // 2. 按是否显示空豆子筛选
    if (!showEmptyBeans) {
      filtered = filtered.filter(bean => !isBeanEmpty(bean));
    }

    // 3. 按品种筛选
    if (selectedVariety) {
      filtered = filtered.filter(bean => beanHasVariety(bean, selectedVariety));
    }

    // 4. 排序
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
      // variety 现在在 blendComponents 中
      price: bean.price,
    }));

    const sortedBeans = sortBeans(compatibleBeans, sortOption);

    // 按照排序后的顺序收集原始豆子
    const resultBeans: ExtendedCoffeeBean[] = [];
    for (const sortedBean of sortedBeans) {
      const originalBean = filtered.find(b => b.id === sortedBean.id);
      if (originalBean) {
        resultBeans.push(originalBean);
      }
    }

    return resultBeans;
  }, [beans, selectedBeanType, showEmptyBeans, selectedVariety, sortOption]);

  // 使用useMemo缓存可用品种列表
  const availableVarieties = useMemo(() => {
    if (!beans || beans.length === 0) return [];

    // 先按豆子类型筛选
    let typeFilteredBeans = beans;
    if (selectedBeanType && selectedBeanType !== 'all') {
      typeFilteredBeans = beans.filter(
        bean => bean.beanType === selectedBeanType
      );
    }

    // 再按是否显示空豆子筛选
    let beansForVarieties = typeFilteredBeans;
    if (!showEmptyBeans) {
      beansForVarieties = typeFilteredBeans.filter(bean => !isBeanEmpty(bean));
    }

    // 使用工具函数提取品种并去重
    const varieties = extractUniqueVarieties(beansForVarieties);

    return varieties;
  }, [beans, selectedBeanType, showEmptyBeans]);

  // 防抖的筛选更新函数
  const debouncedUpdateFilters = useCallback(
    (filters: Partial<UseOptimizedBeanFilteringProps>) => {
      const debouncedHandler = debounce(() => {
        // 这个函数主要用于外部调用时的防抖处理
        // 实际的筛选逻辑已经通过useMemo优化
        console.warn('Filters updated:', filters);
      }, 300);

      debouncedHandler();
    },
    []
  );

  return {
    filteredBeans,
    availableVarieties,
    debouncedUpdateFilters,
  };
};
