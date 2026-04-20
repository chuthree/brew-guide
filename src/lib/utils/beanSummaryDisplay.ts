import type { AppSettings } from '@/lib/core/db';

export const BEAN_SUMMARY_MAX_DISPLAY_CAPACITY_RANGE = {
  min: 250,
  max: 5000,
  step: 250,
} as const;

type BeanSummaryDisplaySettings = Pick<
  AppSettings,
  'enableBeanSummaryCapacityLimit' | 'beanSummaryMaxDisplayCapacity'
>;

export interface BeanSummaryWeightItem {
  label: string;
  weight: number;
}

export interface BeanSummaryWeightAllocation extends BeanSummaryWeightItem {
  displayWeight: number;
  isLimited: boolean;
}

export interface BeanSummaryDisplayValue {
  value: number;
  isLimited: boolean;
}

export interface BeanSummaryCupItem {
  remaining?: string;
  beanType?: 'espresso' | 'filter' | 'omni';
}

const normalizeWeight = (weight: number): number => {
  if (!Number.isFinite(weight) || weight <= 0) {
    return 0;
  }

  return weight;
};

export const formatBeanSummaryWeight = (weight: number): string => {
  const normalizedWeight = normalizeWeight(weight);

  if (normalizedWeight < 1000) {
    return `${Math.round(normalizedWeight)} g`;
  }

  const kilogramText = Number((normalizedWeight / 1000).toFixed(2)).toString();
  return `${kilogramText} kg`;
};

export const formatBeanSummaryDisplayValue = (
  displayValue: BeanSummaryDisplayValue,
  formatter: (value: number) => string
): string =>
  `${formatter(displayValue.value)}${displayValue.isLimited ? '+' : ''}`;

export const getBeanSummaryDisplayLimit = (
  settings?: Partial<BeanSummaryDisplaySettings>
): number | undefined => {
  if (!settings?.enableBeanSummaryCapacityLimit) {
    return undefined;
  }

  const rawLimit = Number(settings.beanSummaryMaxDisplayCapacity);
  if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
    return undefined;
  }

  return Math.round(rawLimit);
};

export const formatBeanSummaryWeightWithLimit = (
  weight: number,
  maxDisplayWeight?: number
): string => {
  return formatBeanSummaryDisplayValue(
    getBeanSummaryWeightDisplay(weight, maxDisplayWeight),
    formatBeanSummaryWeight
  );
};

export const getBeanSummaryWeightDisplay = (
  weight: number,
  maxDisplayWeight?: number
): BeanSummaryDisplayValue => {
  const normalizedWeight = normalizeWeight(weight);
  const normalizedLimit = normalizeWeight(maxDisplayWeight ?? 0);

  if (normalizedLimit > 0 && normalizedWeight > normalizedLimit) {
    return {
      value: normalizedLimit,
      isLimited: true,
    };
  }

  return {
    value: normalizedWeight,
    isLimited: false,
  };
};

export const allocateBeanSummaryWeights = <T extends BeanSummaryWeightItem>(
  items: T[],
  maxDisplayWeight?: number
): Array<T & { displayWeight: number }> => {
  const normalizedItems = items.map(item => ({
    ...item,
    weight: normalizeWeight(item.weight),
  }));
  const normalizedLimit = normalizeWeight(maxDisplayWeight ?? 0);
  const totalWeight = normalizedItems.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  if (normalizedLimit <= 0 || totalWeight <= normalizedLimit) {
    return normalizedItems.map(item => ({
      ...item,
      displayWeight: item.weight,
      isLimited: false,
    }));
  }

  const integerLimit = Math.round(normalizedLimit);
  const allocations = normalizedItems.map((item, index) => {
    if (item.weight <= 0) {
      return {
        index,
        base: 0,
        remainder: 0,
      };
    }

    const scaledWeight = (item.weight / totalWeight) * integerLimit;
    const base = Math.floor(scaledWeight);

    return {
      index,
      base,
      remainder: scaledWeight - base,
    };
  });

  let remainingWeight =
    integerLimit - allocations.reduce((sum, item) => sum + item.base, 0);

  allocations
    .slice()
    .sort((a, b) => {
      if (b.remainder !== a.remainder) {
        return b.remainder - a.remainder;
      }

      return a.index - b.index;
    })
    .forEach(item => {
      if (remainingWeight <= 0) {
        return;
      }

      allocations[item.index].base += 1;
      remainingWeight -= 1;
    });

  return normalizedItems.map((item, index) => ({
    ...item,
    displayWeight: allocations[index]?.base ?? 0,
    isLimited: (allocations[index]?.base ?? 0) < item.weight,
  }));
};

const parseBeanRemainingWeight = (remaining?: string): number => {
  const remainingMatch = (remaining || '0').match(/(\d+(?:\.\d+)?)/);
  return remainingMatch ? normalizeWeight(parseFloat(remainingMatch[1])) : 0;
};

const getDefaultAmountPerCup = (
  beanType: 'espresso' | 'filter' | 'omni' | undefined
): number => (beanType === 'espresso' ? 18 : 15);

export const calculateBeanSummaryEstimatedCups = (
  beans: BeanSummaryCupItem[],
  maxDisplayWeight?: number
): BeanSummaryDisplayValue => {
  if (!beans || beans.length === 0) {
    return { value: 0, isLimited: false };
  }

  const normalizedBeans = beans.map(bean => ({
    beanType: bean.beanType,
    remainingWeight: parseBeanRemainingWeight(bean.remaining),
  }));
  const totalWeight = normalizedBeans.reduce(
    (sum, bean) => sum + bean.remainingWeight,
    0
  );
  const normalizedLimit = normalizeWeight(maxDisplayWeight ?? 0);
  const shouldLimit = normalizedLimit > 0 && totalWeight > normalizedLimit;
  const scale = shouldLimit ? normalizedLimit / totalWeight : 1;

  const totalCups = normalizedBeans.reduce((sum, bean) => {
    if (bean.remainingWeight <= 0) {
      return sum;
    }

    const amountPerCup = getDefaultAmountPerCup(bean.beanType);
    return sum + Math.floor((bean.remainingWeight * scale) / amountPerCup);
  }, 0);

  return {
    value: totalCups,
    isLimited: shouldLimit,
  };
};

export const formatBeanSummaryEstimatedCups = (
  displayValue: BeanSummaryDisplayValue
): string => `${displayValue.value} 杯`;

export const buildBeanSummaryDetailItems = (
  items: BeanSummaryWeightItem[],
  maxDisplayWeight?: number
): string[] =>
  allocateBeanSummaryWeights(items, maxDisplayWeight)
    .filter(item => item.displayWeight > 0)
    .map(
      item => `${item.label} ${formatBeanSummaryWeight(item.displayWeight)}`
    );
