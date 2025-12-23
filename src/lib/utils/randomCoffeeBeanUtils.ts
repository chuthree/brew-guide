import { CoffeeBean } from '@/types/app';
import {
  getBeanFlavorPeriodStatus,
  FlavorPeriodStatus,
} from '@/lib/utils/beanVarietyUtils';
import { SettingsOptions } from '@/components/settings/Settings';
import { getSettingsStore } from '@/lib/stores/settingsStore';

/**
 * 咖啡豆类型
 */
export type BeanType = 'espresso' | 'filter' | 'omni';

/**
 * 随机咖啡豆选择器类
 */
export class RandomCoffeeBeanSelector {
  private settings: SettingsOptions['randomCoffeeBeans'];

  constructor(settings?: SettingsOptions['randomCoffeeBeans']) {
    this.settings = settings;
  }

  /**
   * 根据设置筛选可用的咖啡豆
   * @param beans 所有咖啡豆数组
   * @param beanType 指定的咖啡豆类型（可选）
   * @returns 符合条件的咖啡豆数组
   */
  filterAvailableBeans(beans: CoffeeBean[], beanType?: BeanType): CoffeeBean[] {
    if (!beans || beans.length === 0) return [];

    let filteredBeans = beans;

    // 1. 基础过滤：排除无剩余量的咖啡豆
    filteredBeans = filteredBeans.filter(bean => {
      // 如果没有设置容量，则可用（无法判断是否用完）
      if (!bean.capacity || bean.capacity === '0' || bean.capacity === '0g') {
        return true;
      }

      // 检查剩余量是否大于0
      const remaining = parseFloat(bean.remaining || '0');
      return remaining > 0;
    });

    // 2. 按咖啡豆类型筛选（如果指定了类型）
    if (beanType) {
      filteredBeans = filteredBeans.filter(bean => bean.beanType === beanType);
    }

    // 3. 按赏味期范围筛选（如果有设置）
    if (this.settings?.flavorPeriodRanges) {
      const ranges = this.settings.flavorPeriodRanges;

      // 检查是否有任何赏味期范围被选中
      const hasAnyRangeSelected = Object.values(ranges).some(
        enabled => enabled
      );

      // 如果有选中的范围，则只包含符合条件的咖啡豆
      if (hasAnyRangeSelected) {
        filteredBeans = filteredBeans.filter(bean => {
          const status = getBeanFlavorPeriodStatus(bean);

          switch (status) {
            case FlavorPeriodStatus.AGING:
              return ranges.aging;
            case FlavorPeriodStatus.OPTIMAL:
              return ranges.optimal;
            case FlavorPeriodStatus.DECLINE:
              return ranges.decline;
            case FlavorPeriodStatus.FROZEN:
              return ranges.frozen;
            case FlavorPeriodStatus.IN_TRANSIT:
              return ranges.inTransit;
            case FlavorPeriodStatus.UNKNOWN:
              return ranges.unknown;
            default:
              return false;
          }
        });
      }
      // 如果没有选中任何范围，则包含所有状态的咖啡豆（默认行为）
    }

    return filteredBeans;
  }

  /**
   * 随机选择一个咖啡豆
   * @param espressoBeans 意式咖啡豆数组
   * @param filterBeans 手冲咖啡豆数组
   * @param omniBeans 全能咖啡豆数组
   * @param targetType 指定的咖啡豆类型（可选）
   * @returns 随机选中的咖啡豆和类型，如果没有可用咖啡豆则返回null
   */
  selectRandomBean(
    espressoBeans: CoffeeBean[],
    filterBeans: CoffeeBean[],
    omniBeans: CoffeeBean[] = [],
    targetType?: BeanType
  ): { bean: CoffeeBean; beanType: BeanType } | null {
    if (targetType) {
      // 如果指定了类型，从该类型中选择，并且全能豆总是包含在意式和手冲中
      let beansToSelect: CoffeeBean[] = [];

      if (targetType === 'espresso') {
        beansToSelect = [...espressoBeans, ...omniBeans];
      } else if (targetType === 'filter') {
        beansToSelect = [...filterBeans, ...omniBeans];
      } else {
        // targetType === 'omni'
        beansToSelect = omniBeans;
      }

      // 不传入 beanType 参数，避免过滤掉全能豆
      const availableBeans = this.filterAvailableBeans(beansToSelect);

      if (availableBeans.length === 0) {
        return null;
      }

      // Math.random() is safe here: used for UI random selection, not cryptography // NOSONAR
      const randomIndex = Math.floor(Math.random() * availableBeans.length); // NOSONAR
      const selectedBean = availableBeans[randomIndex];

      // 返回豆子的实际类型
      return {
        bean: selectedBean,
        beanType: selectedBean.beanType || targetType,
      };
    }

    // 如果没有指定类型，从所有可用咖啡豆中选择
    const availableEspresso = this.filterAvailableBeans(
      espressoBeans,
      'espresso'
    );
    const availableFilter = this.filterAvailableBeans(filterBeans, 'filter');
    const availableOmni = this.filterAvailableBeans(omniBeans, 'omni');

    const allAvailable = [
      ...availableEspresso.map(bean => ({
        bean,
        beanType: 'espresso' as BeanType,
      })),
      ...availableFilter.map(bean => ({
        bean,
        beanType: 'filter' as BeanType,
      })),
      ...availableOmni.map(bean => ({
        bean,
        beanType: 'omni' as BeanType,
      })),
    ];

    if (allAvailable.length === 0) {
      return null;
    }

    // Math.random() is safe here: used for UI random selection, not cryptography // NOSONAR
    const randomIndex = Math.floor(Math.random() * allAvailable.length); // NOSONAR
    return allAvailable[randomIndex];
  }

  /**
   * 根据是否长按选择不同类型的咖啡豆
   * @param espressoBeans 意式咖啡豆数组
   * @param filterBeans 手冲咖啡豆数组
   * @param omniBeans 全能咖啡豆数组
   * @param isLongPress 是否为长按操作
   * @returns 选中的咖啡豆类型和咖啡豆
   */
  selectRandomBeanByPressType(
    espressoBeans: CoffeeBean[],
    filterBeans: CoffeeBean[],
    omniBeans: CoffeeBean[] = [],
    isLongPress: boolean = false
  ): { beanType: BeanType; bean: CoffeeBean | null } {
    // 如果启用了长按随机类型功能
    if (this.settings?.enableLongPressRandomType) {
      const defaultType = this.settings.defaultRandomType || 'espresso';

      // 长按时使用默认类型，点击时使用非默认类型
      const targetType = isLongPress
        ? defaultType
        : defaultType === 'espresso'
          ? 'filter'
          : 'espresso';
      const result = this.selectRandomBean(
        espressoBeans,
        filterBeans,
        omniBeans,
        targetType
      );

      return {
        beanType: result?.beanType || targetType,
        bean: result?.bean || null,
      };
    }

    // 如果没有启用长按随机类型，随机所有类型的咖啡豆
    const result = this.selectRandomBean(espressoBeans, filterBeans, omniBeans);

    return {
      beanType: result?.beanType || 'filter',
      bean: result?.bean || null,
    };
  }

  /**
   * 获取可用咖啡豆数量统计
   * @param espressoBeans 意式咖啡豆数组
   * @param filterBeans 手冲咖啡豆数组
   * @param omniBeans 全能咖啡豆数组
   * @returns 按类型分组的可用咖啡豆数量统计
   */
  getAvailableBeansStats(
    espressoBeans: CoffeeBean[],
    filterBeans: CoffeeBean[],
    omniBeans: CoffeeBean[] = []
  ): {
    total: number;
    espresso: number;
    filter: number;
    omni: number;
    byFlavorPeriod: Record<FlavorPeriodStatus, number>;
  } {
    const availableEspresso = this.filterAvailableBeans(
      espressoBeans,
      'espresso'
    );
    const availableFilter = this.filterAvailableBeans(filterBeans, 'filter');
    const availableOmni = this.filterAvailableBeans(omniBeans, 'omni');
    const allAvailable = [
      ...availableEspresso,
      ...availableFilter,
      ...availableOmni,
    ];

    const stats = {
      total: allAvailable.length,
      espresso: availableEspresso.length,
      filter: availableFilter.length,
      omni: availableOmni.length,
      byFlavorPeriod: {
        [FlavorPeriodStatus.AGING]: 0,
        [FlavorPeriodStatus.OPTIMAL]: 0,
        [FlavorPeriodStatus.DECLINE]: 0,
        [FlavorPeriodStatus.FROZEN]: 0,
        [FlavorPeriodStatus.IN_TRANSIT]: 0,
        [FlavorPeriodStatus.UNKNOWN]: 0,
      },
    };

    allAvailable.forEach(bean => {
      // 按赏味期状态统计
      const status = getBeanFlavorPeriodStatus(bean);
      stats.byFlavorPeriod[status]++;
    });

    return stats;
  }
}

/**
 * 获取随机咖啡豆设置的工具函数
 */
export const getRandomCoffeeBeanSettings =
  (): SettingsOptions['randomCoffeeBeans'] => {
    try {
      const settings = getSettingsStore().settings;
      return settings.randomCoffeeBeans as SettingsOptions['randomCoffeeBeans'];
    } catch (error) {
      console.error('获取随机咖啡豆设置失败:', error);
      return undefined;
    }
  };
