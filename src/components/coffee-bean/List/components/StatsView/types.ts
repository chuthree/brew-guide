import { ExtendedCoffeeBean } from '../../types';

export interface StatsViewProps {
  beans: ExtendedCoffeeBean[];
  showEmptyBeans: boolean;
}

export interface StatsData {
  totalBeans: number;
  emptyBeans: number;
  activeBeans: number;
  totalWeight: number;
  remainingWeight: number;
  consumedWeight: number;
  totalCost: number;
  consumedCost: number;
  averageBeanPrice: number;
  averageGramPrice: number;
  roastLevelCount: Record<string, number>;
  typeCount: {
    单品: number;
    拼配: number;
  };
  beanTypeCount: {
    espresso: number;
    filter: number;
    omni: number;
    other: number;
  };
  originCount: Record<string, number>;
  processCount: Record<string, number>;
  varietyCount: Record<string, number>;
  topFlavors: [string, number][];
  totalFlavorTags: number;
  flavorPeriodStatus: {
    inPeriod: number;
    beforePeriod: number;
    afterPeriod: number;
    unknown: number;
  };
  // 新增：手冲和意式分别统计
  espressoStats: {
    totalBeans: number;
    activeBeans: number;
    totalWeight: number;
    remainingWeight: number;
    consumedWeight: number;
    totalCost: number;
    consumedCost: number;
    averageBeanPrice: number;
    averageGramPrice: number;
    todayConsumption: number;
    todayCost: number;
  };
  filterStats: {
    totalBeans: number;
    activeBeans: number;
    totalWeight: number;
    remainingWeight: number;
    consumedWeight: number;
    totalCost: number;
    consumedCost: number;
    averageBeanPrice: number;
    averageGramPrice: number;
    todayConsumption: number;
    todayCost: number;
  };
  omniStats: {
    totalBeans: number;
    activeBeans: number;
    totalWeight: number;
    remainingWeight: number;
    consumedWeight: number;
    totalCost: number;
    consumedCost: number;
    averageBeanPrice: number;
    averageGramPrice: number;
    todayConsumption: number;
    todayCost: number;
  };
}

export interface StatItemProps {
  label: string;
  value: string;
  unit?: string;
}

export interface StatSectionProps {
  title: string;
  children: React.ReactNode;
}

export interface TodayConsumptionData {
  consumption: number;
  cost: number;
  espressoConsumption: number;
  espressoCost: number;
  filterConsumption: number;
  filterCost: number;
  omniConsumption: number;
  omniCost: number;
}

export interface StatCategoryProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

// 时间分组模式
export type DateGroupingMode = 'year' | 'month' | 'day';

// 计算方式选项
export type CalculationMode = 'natural' | 'coffee';

export interface RatedBean {
  name: string;
  rating: number;
}

export interface FunStatsData {
  totalBrews: number;
  earliestBrewTime: string;
  latestBrewTime: string;
  mostActiveTimePeriod: string;
  favoriteMethod: string;
  topRatedBeans: RatedBean[];
  highestRatedBeanName: string;
  lowestRatedBeans: RatedBean[];
  longestStreak: number;
}

export interface StatsCategoriesProps {
  stats: StatsData;
  funStats?: FunStatsData;
  beans: ExtendedCoffeeBean[];
  todayConsumption: number;
  todayCost: number;
}
