import { ExtendedCoffeeBean } from '../../types';
import {
  getBeanVarieties,
  beanHasVarietyInfo,
} from '@/lib/utils/beanVarietyUtils';
import { isBeanEmpty } from '../../globalCache';
import { StatsData, FunStatsData } from './types';
import { BrewingNote } from '@/lib/core/config';

// 格式化数字，保留2位小数，处理浮点数精度问题
export const formatNumber = (num: number): string => {
  // 处理 NaN 和无穷大的情况
  if (!isFinite(num)) return '0';

  // 四舍五入到2位小数，避免浮点数精度问题
  const rounded = Math.round(num * 100) / 100;

  // 格式化并移除不必要的 .00
  return rounded.toFixed(2).replace(/\.00$/, '');
};

// 添加序号格式化函数
export const formatNumber2Digits = (num: number): string => {
  return num.toString().padStart(2, '0');
};

// 从数组生成统计行数据
const sortStatsData = (dataArr: [string, number][]): [string, number][] => {
  return [...dataArr].sort((a, b) => b[1] - a[1]);
};

// 计算趣味统计数据
export const calculateFunStats = (notes: BrewingNote[]): FunStatsData => {
  // 过滤掉无效笔记（如容量调整）
  // 注意：quick-decrement 类型的笔记通常只有时间戳和减少的量，没有风味、评分等信息
  // 但它们可以用于计算时间相关的统计（最早/最晚冲煮、活跃时段、连续打卡）
  const validNotes = notes.filter(
    note => note.source !== 'capacity-adjustment'
  );

  // 1. 最早和最晚冲煮时间
  let earliestBrewTime = '-';
  let latestBrewTime = '-';

  if (validNotes.length > 0) {
    // 将凌晨6点作为一天的分界线
    // 6:00 之前的记录会被视为"深夜"（即上一天的延续），在比较时加上24小时
    const DAY_START_HOUR = 6;
    let minMinutes = 48 * 60; // 初始化为一个足够大的值
    let maxMinutes = -1;

    validNotes.forEach(note => {
      if (!note.timestamp) return;
      const date = new Date(note.timestamp);
      const hour = date.getHours();
      const minute = date.getMinutes();

      // 计算分钟数
      let minutes = hour * 60 + minute;

      // 如果是凌晨0-6点，加上24小时（1440分钟），使其排在深夜之后
      if (hour < DAY_START_HOUR) {
        minutes += 24 * 60;
      }

      if (minutes < minMinutes) {
        minMinutes = minutes;
        earliestBrewTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }

      if (minutes > maxMinutes) {
        maxMinutes = minutes;
        latestBrewTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }
    });
  }

  // 2. 最活跃时段
  const timePeriods = {
    '清晨 (5:00-9:00)': 0,
    '上午 (9:00-12:00)': 0,
    '中午 (12:00-14:00)': 0,
    '下午 (14:00-18:00)': 0,
    '傍晚 (18:00-22:00)': 0,
    '深夜 (22:00-5:00)': 0,
  };

  validNotes.forEach(note => {
    if (!note.timestamp) return;
    const hour = new Date(note.timestamp).getHours();
    if (hour >= 5 && hour < 9) timePeriods['清晨 (5:00-9:00)']++;
    else if (hour >= 9 && hour < 12) timePeriods['上午 (9:00-12:00)']++;
    else if (hour >= 12 && hour < 14) timePeriods['中午 (12:00-14:00)']++;
    else if (hour >= 14 && hour < 18) timePeriods['下午 (14:00-18:00)']++;
    else if (hour >= 18 && hour < 22) timePeriods['傍晚 (18:00-22:00)']++;
    else timePeriods['深夜 (22:00-5:00)']++;
  });

  let mostActiveTimePeriod = '-';
  let maxCount = 0;
  Object.entries(timePeriods).forEach(([period, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostActiveTimePeriod = period.split(' ')[0]; // 只取名称，不取时间段
    }
  });

  let favoriteMethod = '-';
  maxCount = 0;

  // 4. 评分统计 (Top 3 & Bottom 3)
  const beanRatings: Record<string, { total: number; count: number }> = {};

  // 只需要有评分的笔记
  const ratedNotes = validNotes.filter(note => note.rating && note.rating > 0);

  ratedNotes.forEach(note => {
    const name = note.coffeeBeanInfo?.name;
    if (name) {
      if (!beanRatings[name]) {
        beanRatings[name] = { total: 0, count: 0 };
      }
      beanRatings[name].total += note.rating;
      beanRatings[name].count += 1;
    }
  });

  const beanAverageRatings = Object.entries(beanRatings).map(
    ([name, data]) => ({
      name,
      rating: data.total / data.count,
    })
  );

  // Sort for Top 3
  const topRatedBeans = [...beanAverageRatings]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3)
    .map(b => ({ name: b.name, rating: Number(b.rating.toFixed(1)) }));

  const highestRatedBeanName =
    topRatedBeans.length > 0 ? topRatedBeans[0].name : '-';

  // Sort for Bottom 3
  const lowestRatedBeans = [...beanAverageRatings]
    .sort((a, b) => a.rating - b.rating)
    .slice(0, 3)
    .map(b => ({ name: b.name, rating: Number(b.rating.toFixed(1)) }));

  // 5. 最长连续打卡天数
  const dates = validNotes
    .filter(note => note.timestamp)
    .map(note => {
      const d = new Date(note.timestamp);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    })
    .filter((value, index, self) => self.indexOf(value) === index) // 去重
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime()); // 排序

  let longestStreak = 0;
  let currentStreak = 0;
  let lastDate: Date | null = null;

  dates.forEach(dateStr => {
    const currentDate = new Date(dateStr);
    if (!lastDate) {
      currentStreak = 1;
    } else {
      const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    }
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    lastDate = currentDate;
  });

  return {
    totalBrews: validNotes.length,
    earliestBrewTime,
    latestBrewTime,
    mostActiveTimePeriod,
    favoriteMethod,
    topRatedBeans,
    highestRatedBeanName,
    lowestRatedBeans,
    longestStreak,
  };
};

// 计算统计数据
export const calculateStats = (
  beans: ExtendedCoffeeBean[],
  showEmptyBeans: boolean,
  todayConsumption: {
    espressoConsumption: number;
    espressoCost: number;
    filterConsumption: number;
    filterCost: number;
    omniConsumption: number;
    omniCost: number;
  }
): StatsData => {
  // 计算咖啡豆总数
  const totalBeans = beans.length;

  // 计算已用完的咖啡豆数量
  const emptyBeans = beans.filter(bean => isBeanEmpty(bean)).length;

  // 计算正在使用的咖啡豆数量
  const activeBeans = totalBeans - emptyBeans;

  // 计算总重量（克）- 使用所有豆子计算，不受showEmptyBeans影响
  const totalWeight = beans.reduce((sum, bean) => {
    const capacity = bean.capacity
      ? parseFloat(bean.capacity.toString().replace(/[^\d.]/g, ''))
      : 0;
    return sum + (isNaN(capacity) ? 0 : capacity);
  }, 0);

  // 计算剩余重量（克）- 使用所有豆子计算，不受showEmptyBeans影响
  const remainingWeight = beans.reduce((sum, bean) => {
    const remaining = bean.remaining
      ? parseFloat(bean.remaining.toString().replace(/[^\d.]/g, ''))
      : 0;
    return sum + (isNaN(remaining) ? 0 : remaining);
  }, 0);

  // 计算已消耗重量（克）
  const consumedWeight = totalWeight - remainingWeight;

  // 计算总花费（元）- 使用所有豆子计算，不受showEmptyBeans影响
  const totalCost = beans.reduce((sum, bean) => {
    const price = bean.price
      ? parseFloat(bean.price.toString().replace(/[^\d.]/g, ''))
      : 0;
    return sum + (isNaN(price) ? 0 : price);
  }, 0);

  // 计算已消耗花费（元）- 基于每个豆子的消耗量和单价计算
  const consumedCost = beans.reduce((sum, bean) => {
    const price = bean.price
      ? parseFloat(bean.price.toString().replace(/[^\d.]/g, ''))
      : 0;
    const capacity = bean.capacity
      ? parseFloat(bean.capacity.toString().replace(/[^\d.]/g, ''))
      : 0;
    const remaining = bean.remaining
      ? parseFloat(bean.remaining.toString().replace(/[^\d.]/g, ''))
      : 0;

    if (isNaN(price) || isNaN(capacity) || capacity <= 0) return sum;

    const consumed = capacity - (isNaN(remaining) ? 0 : remaining);
    const gramPrice = price / capacity;
    return sum + consumed * gramPrice;
  }, 0);

  // 计算平均每豆价格（元）
  const averageBeanPrice = totalBeans > 0 ? totalCost / totalBeans : 0;

  // 计算平均每克价格（元/克）
  const averageGramPrice = totalWeight > 0 ? totalCost / totalWeight : 0;

  // 为了详细分类统计，我们需要根据showEmptyBeans过滤豆子
  // 这样可以在图表和分类数据中反映用户的过滤选择
  const filteredBeans = showEmptyBeans
    ? beans
    : beans.filter(bean => !isBeanEmpty(bean));

  // 根据烘焙度统计
  const roastLevelCount: Record<string, number> = {};
  filteredBeans.forEach(bean => {
    const roastLevel = bean.roastLevel || '未知';
    roastLevelCount[roastLevel] = (roastLevelCount[roastLevel] || 0) + 1;
  });

  // 根据产品类型统计（基于blendComponents数量判断）
  const typeCount = {
    单品: filteredBeans.filter(
      bean => !bean.blendComponents || bean.blendComponents.length <= 1
    ).length,
    拼配: filteredBeans.filter(
      bean => bean.blendComponents && bean.blendComponents.length > 1
    ).length,
  };

  // 根据豆子用途统计
  const beanTypeCount = {
    espresso: filteredBeans.filter(bean => bean.beanType === 'espresso').length,
    filter: filteredBeans.filter(bean => bean.beanType === 'filter').length,
    omni: filteredBeans.filter(bean => bean.beanType === 'omni').length,
    other: filteredBeans.filter(
      bean =>
        !bean.beanType ||
        (bean.beanType !== 'espresso' &&
          bean.beanType !== 'filter' &&
          bean.beanType !== 'omni')
    ).length,
  };

  // 根据产地统计
  const originCount: Record<string, number> = {};
  filteredBeans.forEach(bean => {
    // 只处理 blendComponents 中的产地信息
    if (
      bean.blendComponents &&
      Array.isArray(bean.blendComponents) &&
      bean.blendComponents.length > 0
    ) {
      bean.blendComponents.forEach(comp => {
        if (comp.origin) {
          const origin = comp.origin;
          originCount[origin] = (originCount[origin] || 0) + 1;
        }
      });
    } else {
      // 如果没有 blendComponents 或者为空，归为"未知"
      const origin = '未知';
      originCount[origin] = (originCount[origin] || 0) + 1;
    }
  });

  // 根据处理法统计
  const processCount: Record<string, number> = {};
  filteredBeans.forEach(bean => {
    // 只处理 blendComponents 中的处理法信息
    if (
      bean.blendComponents &&
      Array.isArray(bean.blendComponents) &&
      bean.blendComponents.length > 0
    ) {
      bean.blendComponents.forEach(comp => {
        if (comp.process) {
          const process = comp.process;
          processCount[process] = (processCount[process] || 0) + 1;
        }
      });
    } else {
      // 如果没有 blendComponents 或者为空，归为"未知"
      const process = '未知';
      processCount[process] = (processCount[process] || 0) + 1;
    }
  });

  // 根据品种统计
  const varietyCount: Record<string, number> = {};
  filteredBeans.forEach(bean => {
    // 使用工具函数获取品种信息
    if (beanHasVarietyInfo(bean)) {
      const varieties = getBeanVarieties(bean);
      varieties.forEach(variety => {
        varietyCount[variety] = (varietyCount[variety] || 0) + 1;
      });
    } else {
      // 如果没有品种信息，归为"未分类"
      const variety = '未分类';
      varietyCount[variety] = (varietyCount[variety] || 0) + 1;
    }
  });

  // 统计风味标签
  const flavorCount: Record<string, number> = {};
  let totalFlavorTags = 0;

  filteredBeans.forEach(bean => {
    if (bean.flavor && Array.isArray(bean.flavor)) {
      bean.flavor.forEach(flavor => {
        flavorCount[flavor] = (flavorCount[flavor] || 0) + 1;
        totalFlavorTags++;
      });
    }
  });

  // 按频率排序风味标签
  const topFlavors = Object.entries(flavorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // 只取前10个最常见的风味

  // 赏味期统计
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;

  // 计算豆子的赏味期状态
  const flavorPeriodStatus = {
    inPeriod: 0, // 在赏味期内
    beforePeriod: 0, // 尚未进入赏味期
    afterPeriod: 0, // 已过赏味期
    unknown: 0, // 未知赏味期
  };

  filteredBeans.forEach(bean => {
    // 如果没有烘焙日期或赏味期信息，则归为未知
    if (
      !bean.roastDate ||
      (bean.startDay === undefined && bean.endDay === undefined)
    ) {
      flavorPeriodStatus.unknown++;
      return;
    }

    try {
      // 尝试解析烘焙日期
      const roastDate = new Date(bean.roastDate);

      // 计算从烘焙到现在的天数
      const daysSinceRoast = Math.floor((now - roastDate.getTime()) / dayInMs);

      // 根据开始日和结束日判断赏味期状态
      if (bean.startDay !== undefined && bean.endDay !== undefined) {
        if (daysSinceRoast < bean.startDay) {
          flavorPeriodStatus.beforePeriod++;
        } else if (daysSinceRoast <= bean.endDay) {
          flavorPeriodStatus.inPeriod++;
        } else {
          flavorPeriodStatus.afterPeriod++;
        }
      } else if (bean.startDay !== undefined) {
        // 只有开始日
        if (daysSinceRoast < bean.startDay) {
          flavorPeriodStatus.beforePeriod++;
        } else {
          flavorPeriodStatus.inPeriod++;
        }
      } else if (bean.endDay !== undefined) {
        // 只有结束日
        if (daysSinceRoast <= bean.endDay) {
          flavorPeriodStatus.inPeriod++;
        } else {
          flavorPeriodStatus.afterPeriod++;
        }
      } else {
        flavorPeriodStatus.unknown++;
      }
    } catch (_error) {
      // 日期解析错误，归为未知
      flavorPeriodStatus.unknown++;
    }
  });

  // 计算手冲豆统计
  const filterBeans = beans.filter(bean => bean.beanType === 'filter');
  const activeFilterBeans = filterBeans.filter(bean => !isBeanEmpty(bean));
  const filterTotalWeight = filterBeans.reduce((sum, bean) => {
    const capacity = bean.capacity
      ? parseFloat(bean.capacity.toString().replace(/[^\d.]/g, ''))
      : 0;
    return sum + (isNaN(capacity) ? 0 : capacity);
  }, 0);
  const filterRemainingWeight = filterBeans.reduce((sum, bean) => {
    const remaining = bean.remaining
      ? parseFloat(bean.remaining.toString().replace(/[^\d.]/g, ''))
      : 0;
    return sum + (isNaN(remaining) ? 0 : remaining);
  }, 0);
  const filterConsumedWeight = filterTotalWeight - filterRemainingWeight;
  const filterTotalCost = filterBeans.reduce((sum, bean) => {
    const price = bean.price
      ? parseFloat(bean.price.toString().replace(/[^\d.]/g, ''))
      : 0;
    return sum + (isNaN(price) ? 0 : price);
  }, 0);
  const filterConsumedCost = filterBeans.reduce((sum, bean) => {
    const price = bean.price
      ? parseFloat(bean.price.toString().replace(/[^\d.]/g, ''))
      : 0;
    const capacity = bean.capacity
      ? parseFloat(bean.capacity.toString().replace(/[^\d.]/g, ''))
      : 0;
    const remaining = bean.remaining
      ? parseFloat(bean.remaining.toString().replace(/[^\d.]/g, ''))
      : 0;
    if (isNaN(price) || isNaN(capacity) || capacity <= 0) return sum;
    const consumed = capacity - (isNaN(remaining) ? 0 : remaining);
    return sum + (consumed * price) / capacity;
  }, 0);
  const filterAverageBeanPrice =
    filterBeans.length > 0 ? filterTotalCost / filterBeans.length : 0;
  const filterAverageGramPrice =
    filterTotalWeight > 0 ? filterTotalCost / filterTotalWeight : 0;

  // 计算意式豆统计
  const espressoBeans = beans.filter(bean => bean.beanType === 'espresso');
  const activeEspressoBeans = espressoBeans.filter(bean => !isBeanEmpty(bean));
  const espressoTotalWeight = espressoBeans.reduce((sum, bean) => {
    const capacity = bean.capacity
      ? parseFloat(bean.capacity.toString().replace(/[^\d.]/g, ''))
      : 0;
    return sum + (isNaN(capacity) ? 0 : capacity);
  }, 0);
  const espressoRemainingWeight = espressoBeans.reduce((sum, bean) => {
    const remaining = bean.remaining
      ? parseFloat(bean.remaining.toString().replace(/[^\d.]/g, ''))
      : 0;
    return sum + (isNaN(remaining) ? 0 : remaining);
  }, 0);
  const espressoConsumedWeight = espressoTotalWeight - espressoRemainingWeight;
  const espressoTotalCost = espressoBeans.reduce((sum, bean) => {
    const price = bean.price
      ? parseFloat(bean.price.toString().replace(/[^\d.]/g, ''))
      : 0;
    return sum + (isNaN(price) ? 0 : price);
  }, 0);
  const espressoConsumedCost = espressoBeans.reduce((sum, bean) => {
    const price = bean.price
      ? parseFloat(bean.price.toString().replace(/[^\d.]/g, ''))
      : 0;
    const capacity = bean.capacity
      ? parseFloat(bean.capacity.toString().replace(/[^\d.]/g, ''))
      : 0;
    const remaining = bean.remaining
      ? parseFloat(bean.remaining.toString().replace(/[^\d.]/g, ''))
      : 0;
    if (isNaN(price) || isNaN(capacity) || capacity <= 0) return sum;
    const consumed = capacity - (isNaN(remaining) ? 0 : remaining);
    return sum + (consumed * price) / capacity;
  }, 0);
  const espressoAverageBeanPrice =
    espressoBeans.length > 0 ? espressoTotalCost / espressoBeans.length : 0;
  const espressoAverageGramPrice =
    espressoTotalWeight > 0 ? espressoTotalCost / espressoTotalWeight : 0;

  // 计算全能豆统计
  const omniBeans = beans.filter(bean => bean.beanType === 'omni');
  const activeOmniBeans = omniBeans.filter(bean => !isBeanEmpty(bean));
  const omniTotalWeight = omniBeans.reduce((sum, bean) => {
    const capacity = bean.capacity
      ? parseFloat(bean.capacity.toString().replace(/[^\d.]/g, ''))
      : 0;
    return sum + (isNaN(capacity) ? 0 : capacity);
  }, 0);
  const omniRemainingWeight = omniBeans.reduce((sum, bean) => {
    const remaining = bean.remaining
      ? parseFloat(bean.remaining.toString().replace(/[^\d.]/g, ''))
      : 0;
    return sum + (isNaN(remaining) ? 0 : remaining);
  }, 0);
  const omniConsumedWeight = omniTotalWeight - omniRemainingWeight;
  const omniTotalCost = omniBeans.reduce((sum, bean) => {
    const price = bean.price
      ? parseFloat(bean.price.toString().replace(/[^\d.]/g, ''))
      : 0;
    return sum + (isNaN(price) ? 0 : price);
  }, 0);
  const omniConsumedCost = omniBeans.reduce((sum, bean) => {
    const price = bean.price
      ? parseFloat(bean.price.toString().replace(/[^\d.]/g, ''))
      : 0;
    const capacity = bean.capacity
      ? parseFloat(bean.capacity.toString().replace(/[^\d.]/g, ''))
      : 0;
    const remaining = bean.remaining
      ? parseFloat(bean.remaining.toString().replace(/[^\d.]/g, ''))
      : 0;
    if (isNaN(price) || isNaN(capacity) || capacity <= 0) return sum;
    const consumed = capacity - (isNaN(remaining) ? 0 : remaining);
    return sum + (consumed * price) / capacity;
  }, 0);
  const omniAverageBeanPrice =
    omniBeans.length > 0 ? omniTotalCost / omniBeans.length : 0;
  const omniAverageGramPrice =
    omniTotalWeight > 0 ? omniTotalCost / omniTotalWeight : 0;

  return {
    totalBeans,
    emptyBeans,
    activeBeans,
    totalWeight,
    remainingWeight,
    consumedWeight,
    totalCost,
    consumedCost,
    averageBeanPrice,
    averageGramPrice,
    roastLevelCount,
    typeCount,
    beanTypeCount,
    originCount,
    processCount,
    varietyCount,
    topFlavors,
    totalFlavorTags,
    flavorPeriodStatus,
    espressoStats: {
      totalBeans: espressoBeans.length,
      activeBeans: activeEspressoBeans.length,
      totalWeight: espressoTotalWeight,
      remainingWeight: espressoRemainingWeight,
      consumedWeight: espressoConsumedWeight,
      totalCost: espressoTotalCost,
      consumedCost: espressoConsumedCost,
      averageBeanPrice: espressoAverageBeanPrice,
      averageGramPrice: espressoAverageGramPrice,
      todayConsumption: todayConsumption.espressoConsumption,
      todayCost: todayConsumption.espressoCost,
    },
    filterStats: {
      totalBeans: filterBeans.length,
      activeBeans: activeFilterBeans.length,
      totalWeight: filterTotalWeight,
      remainingWeight: filterRemainingWeight,
      consumedWeight: filterConsumedWeight,
      totalCost: filterTotalCost,
      consumedCost: filterConsumedCost,
      averageBeanPrice: filterAverageBeanPrice,
      averageGramPrice: filterAverageGramPrice,
      todayConsumption: todayConsumption.filterConsumption,
      todayCost: todayConsumption.filterCost,
    },
    omniStats: {
      totalBeans: omniBeans.length,
      activeBeans: activeOmniBeans.length,
      totalWeight: omniTotalWeight,
      remainingWeight: omniRemainingWeight,
      consumedWeight: omniConsumedWeight,
      totalCost: omniTotalCost,
      consumedCost: omniConsumedCost,
      averageBeanPrice: omniAverageBeanPrice,
      averageGramPrice: omniAverageGramPrice,
      todayConsumption: todayConsumption.omniConsumption,
      todayCost: todayConsumption.omniCost,
    },
  };
};

// 计算预计消耗完的时间 - 兼容版本（保持向后兼容）
export const calculateEstimatedFinishDate = (
  stats: StatsData,
  dailyConsumption: number,
  options?: {
    considerSeasonality?: boolean;
    separateByType?: boolean;
    includeConfidenceLevel?: boolean;
    beans?: ExtendedCoffeeBean[];
  }
): string => {
  const result = calculateEstimatedFinishDateAdvanced(
    stats,
    dailyConsumption,
    options
  );
  return typeof result === 'string' ? result : result.date;
};

// 计算预计消耗完的时间 - 简化优化版
export const calculateEstimatedFinishDateAdvanced = (
  stats: StatsData,
  dailyConsumption: number,
  options: {
    considerSeasonality?: boolean;
    separateByType?: boolean;
    includeConfidenceLevel?: boolean;
    beans?: ExtendedCoffeeBean[];
  } = {}
) => {
  const { includeConfidenceLevel = false } = options;

  // 如果没有剩余或平均消耗为0，返回未知
  if (stats.remainingWeight <= 0 || dailyConsumption <= 0) {
    return includeConfidenceLevel ? { date: '-', confidence: 0 } : '-';
  }

  // 使用传入的日消耗量直接计算
  const adjustedDailyConsumption = Math.max(1, dailyConsumption); // 确保至少1克/天

  // 计算剩余天数
  const daysRemaining = Math.ceil(
    stats.remainingWeight / adjustedDailyConsumption
  );

  // 计算预计结束日期
  const finishDate = new Date();
  finishDate.setDate(finishDate.getDate() + daysRemaining);

  // 处理跨年情况
  const now = new Date();
  const isNextYear = finishDate.getFullYear() > now.getFullYear();

  // 格式化日期
  let dateString: string;
  if (isNextYear) {
    // 跨年显示年份
    const year = finishDate.getFullYear().toString().slice(-2);
    const month = formatNumber2Digits(finishDate.getMonth() + 1);
    const day = formatNumber2Digits(finishDate.getDate());
    dateString = `${year}/${month}-${day}`;
  } else {
    // 同年只显示月日
    const month = formatNumber2Digits(finishDate.getMonth() + 1);
    const day = formatNumber2Digits(finishDate.getDate());
    dateString = `${month}-${day}`;
  }

  // 添加时间范围提示
  const today = new Date();

  // 计算本周末（周日）
  const dayOfWeek = today.getDay(); // 0=周日, 1=周一, ..., 6=周六
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek; // 如果今天是周日，就是0天
  const thisWeekEnd = new Date(today);
  thisWeekEnd.setDate(today.getDate() + daysUntilSunday);
  thisWeekEnd.setHours(23, 59, 59, 999); // 设置为当天最后一刻

  // 计算本月末
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  thisMonthEnd.setHours(23, 59, 59, 999); // 设置为当天最后一刻

  // 判断预计完成日期是否在本周内或本月内
  if (finishDate <= thisWeekEnd) {
    dateString += ' (本周内)';
  } else if (finishDate <= thisMonthEnd) {
    dateString += ' (本月内)';
  } else if (daysRemaining > 365) {
    dateString = '1年以上';
  }

  if (includeConfidenceLevel) {
    // 简化的置信度计算
    const confidence = Math.min(
      90,
      Math.max(50, 80 - Math.abs(daysRemaining - 30))
    ); // 30天左右置信度最高
    return {
      date: dateString,
      confidence,
      daysRemaining,
      adjustedConsumption: adjustedDailyConsumption,
    };
  }

  return dateString;
};
