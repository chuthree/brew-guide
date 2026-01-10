/**
 * Beanconqueror 数据导入器
 * 用于将 Beanconqueror 软件导出的 JSON 数据转换为本应用的数据格式
 */

import { nanoid } from 'nanoid';
import { CoffeeBean, BrewingNoteData } from '@/types/app';

/**
 * Beanconqueror 数据结构定义
 */
interface BeanconquerorData {
  BEANS?: BeanconquerorBean[];
  BREWS?: BeanconquerorBrew[];
  MILL?: BeanconquerorMill[];
  PREPARATION?: BeanconquerorPreparation[];
  SETTINGS?: unknown[];
  VERSION?: unknown[];
}

interface BeanconquerorBean {
  name: string;
  buyDate?: string;
  roastingDate?: string;
  note?: string;
  roaster?: string;
  roast?: string;
  roast_range?: number;
  roast_custom?: string;
  beanMix?: string;
  aromatics?: string;
  weight?: number;
  finished?: boolean;
  cost?: number;
  attachments?: string[];
  rating?: number;
  bean_roasting_type?: string;
  bean_information?: Array<{
    country?: string;
    region?: string;
    farm?: string;
    farmer?: string;
    elevation?: string;
    harvest_time?: string;
    variety?: string;
    processing?: string;
    percentage?: number;
  }>;
  config?: {
    uuid?: string;
    unix_timestamp?: number;
  };
}

interface BeanconquerorBrew {
  grind_size?: string;
  grind_weight?: number;
  brew_time?: number;
  brew_temperature?: number;
  brew_quantity?: number;
  brew_beverage_quantity?: number;
  note?: string;
  rating?: number;
  coffee_blooming_time?: number;
  coffee_first_drip_time?: number;
  tds?: number;
  bean?: string;
  method_of_preparation?: string;
  mill?: string;
  brew_creation_date?: number;
  config?: {
    uuid?: string;
    unix_timestamp?: number;
  };
  attachments?: string[];
}

interface BeanconquerorMill {
  name: string;
  note?: string;
  finished?: boolean;
  attachments?: string[];
  config?: {
    uuid?: string;
    unix_timestamp?: number;
  };
}

interface BeanconquerorPreparation {
  name: string;
  note?: string;
  type?: string;
  style_type?: string;
  finished?: boolean;
  config?: {
    uuid?: string;
    unix_timestamp?: number;
  };
}

/**
 * 转换结果
 */
export interface ImportResult {
  success: boolean;
  message: string;
  data?: {
    coffeeBeans: CoffeeBean[];
    brewingNotes: BrewingNoteData[];
    grinders: string[]; // 磨豆机名称列表
    equipments: string[]; // 器具名称列表
  };
  stats?: {
    beansCount: number;
    brewsCount: number;
    grindersCount: number;
    equipmentsCount: number;
  };
}

/**
 * 映射冲煮器具到应用预设器具
 * 支持的预设器具：V60、折纸滤杯、蛋糕滤杯、聪明杯、Espresso
 */
function mapBrewEquipment(preparationName?: string): string {
  if (!preparationName) return '';

  // 转换为小写以便匹配
  const name = preparationName.toLowerCase();

  // 映射到预设器具
  if (name.includes('v60') || name.includes('v-60')) {
    return 'V60';
  }
  if (name.includes('折纸')) {
    return '折纸滤杯';
  }
  if (name.includes('蛋糕') || name.includes('kalita')) {
    return '蛋糕滤杯';
  }
  if (name.includes('聪明') || name.includes('clever')) {
    return '聪明杯';
  }
  if (
    name.includes('意式') ||
    name.includes('espresso') ||
    name.includes('过滤手柄') ||
    name.includes('咖啡机') ||
    name.includes('portafilter')
  ) {
    return 'Espresso';
  }

  // 如果无法映射到预设器具，返回原始名称
  return preparationName;
}

/**
 * 转换 Beanconqueror 咖啡豆数据
 */
function convertBean(
  bean: BeanconquerorBean,
  remainingCapacity: number
): CoffeeBean {
  const name = bean.roaster ? `${bean.roaster} ${bean.name}` : bean.name;

  return {
    name,
    roastLevel: '', // Beanconqueror 没有烘焙度信息，留空
    roastDate: bean.roastingDate || '',
    price: bean.cost?.toString() || '',
    capacity: `${bean.weight}g`,
    remaining: `${remainingCapacity}g`,
    notes: bean.note || '',
    flavor: [],
    overallRating: bean.rating || 0,
    beanType: 'espresso',
    id: nanoid(),
    timestamp: Date.now(),
    blendComponents: [
      {
        origin: '',
        process: '',
        variety: '',
      },
    ],
  };
}

/**
 * 转换 Beanconqueror 冲煮记录数据
 */
function convertBrew(
  brew: BeanconquerorBrew,
  beansMap: Map<string, CoffeeBean>,
  beanUuidToNameMap: Map<string, string>,
  preparationsMap: Map<string, BeanconquerorPreparation>,
  millsMap: Map<string, BeanconquerorMill>
): BrewingNoteData | null {
  // 查找对应的咖啡豆
  // brew.bean 存储的是咖啡豆的 UUID
  const beanUuid = brew.bean;
  let coffeeBean: CoffeeBean | undefined;

  if (beanUuid) {
    // 先通过 UUID 找到咖啡豆的原始名称
    const originalBeanName = beanUuidToNameMap.get(beanUuid);
    if (originalBeanName) {
      // 然后通过原始名称从 beansMap 中获取转换后的咖啡豆
      coffeeBean = beansMap.get(originalBeanName);
    }
  }

  // 如果没有匹配的咖啡豆，跳过这条记录
  if (!coffeeBean) {
    console.warn(`未找到咖啡豆 UUID: ${beanUuid}，跳过此冲煮记录`);
    return null;
  }

  const timestamp = brew.config?.unix_timestamp
    ? brew.config.unix_timestamp * 1000
    : Date.now();

  // 查找器具名称
  let equipmentName = '';
  if (brew.method_of_preparation) {
    const preparation = preparationsMap.get(brew.method_of_preparation);
    if (preparation) {
      equipmentName = mapBrewEquipment(preparation.name);
    }
  }

  // 查找磨豆机名称并组合研磨度
  let grindSizeWithMill = brew.grind_size || '';
  if (brew.mill) {
    const mill = millsMap.get(brew.mill);
    if (mill && mill.name) {
      // 将磨豆机名称添加到研磨度前面
      grindSizeWithMill = `${mill.name} ${brew.grind_size || ''}`.trim();
    }
  }

  return {
    id:
      brew.config?.uuid ||
      `imported-brew-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp,
    equipment: equipmentName,
    method: '', // Beanconqueror 没有方案概念，留空
    params: {
      coffee: brew.grind_weight ? `${brew.grind_weight}g` : '',
      water: brew.brew_quantity ? `${brew.brew_quantity}ml` : '',
      ratio:
        brew.grind_weight && brew.brew_quantity
          ? `1:${(brew.brew_quantity / brew.grind_weight).toFixed(1)}`
          : '',
      grindSize: grindSizeWithMill,
      temp: brew.brew_temperature ? `${brew.brew_temperature}°C` : '',
    },
    totalTime: brew.brew_time || 0,
    coffeeBeanInfo: {
      name: coffeeBean.name,
      roastLevel: coffeeBean.roastLevel || '',
      roastDate: coffeeBean.roastDate,
      roaster: coffeeBean.roaster,
    },
    rating: brew.rating || 0,
    taste: {},
    notes: brew.note || '',
    beanId: coffeeBean.id,
    source: 'beanconqueror-import',
  };
}

/**
 * 计算咖啡豆的剩余量
 * @param bean 咖啡豆数据
 * @param brews 冲煮记录列表
 * @returns 剩余量（克）
 */
function calculateRemainingCapacity(
  bean: BeanconquerorBean,
  brews: BeanconquerorBrew[]
): number {
  // 如果咖啡豆已归档（finished: true），剩余量为 0
  if (bean.finished) {
    return 0;
  }

  // 如果没有总量，返回 0
  if (!bean.weight) return 0;

  // 计算该咖啡豆的所有冲煮记录消耗的总量
  const totalUsed = brews
    .filter(brew => brew.bean === bean.config?.uuid)
    .reduce((sum, brew) => sum + (brew.grind_weight || 0), 0);

  // 计算剩余量
  const remaining = bean.weight - totalUsed;

  return Math.max(0, remaining);
}

/**
 * 解析并转换 Beanconqueror 数据
 */
export async function importBeanconquerorData(
  jsonString: string
): Promise<ImportResult> {
  try {
    // 解析 JSON 数据
    const data: BeanconquerorData = JSON.parse(jsonString);

    // 验证数据格式
    if (!data.BEANS && !data.BREWS && !data.MILL && !data.PREPARATION) {
      return {
        success: false,
        message: '无效的 Beanconqueror 数据格式',
      };
    }

    // 转换咖啡豆数据，同时计算剩余量
    const coffeeBeans: CoffeeBean[] = [];
    const beansMap = new Map<string, CoffeeBean>();
    const beanUuidToNameMap = new Map<string, string>(); // UUID 到咖啡豆名称的映射

    if (data.BEANS && Array.isArray(data.BEANS)) {
      for (const bean of data.BEANS) {
        // 计算剩余量
        const remaining = calculateRemainingCapacity(bean, data.BREWS || []);
        const convertedBean = convertBean(bean, remaining);
        coffeeBeans.push(convertedBean);

        // 使用原始名称作为 key，方便后续匹配
        beansMap.set(bean.name, convertedBean);
        // 同时保存 UUID 映射
        if (bean.config?.uuid) {
          beanUuidToNameMap.set(bean.config.uuid, bean.name);
        }
      }
    }

    // 构建器具和磨豆机的映射表
    const preparationsMap = new Map<string, BeanconquerorPreparation>();
    if (data.PREPARATION && Array.isArray(data.PREPARATION)) {
      for (const prep of data.PREPARATION) {
        if (prep.config?.uuid) {
          preparationsMap.set(prep.config.uuid, prep);
        }
      }
    }

    const millsMap = new Map<string, BeanconquerorMill>();
    if (data.MILL && Array.isArray(data.MILL)) {
      for (const mill of data.MILL) {
        if (mill.config?.uuid) {
          millsMap.set(mill.config.uuid, mill);
        }
      }
    }

    // 转换冲煮记录数据
    const brewingNotes: BrewingNoteData[] = [];
    if (data.BREWS && Array.isArray(data.BREWS)) {
      for (const brew of data.BREWS) {
        const convertedBrew = convertBrew(
          brew,
          beansMap,
          beanUuidToNameMap,
          preparationsMap,
          millsMap
        );
        if (convertedBrew) {
          brewingNotes.push(convertedBrew);
        }
      }
    }

    // 收集磨豆机列表
    const grinders: string[] = [];
    if (data.MILL && Array.isArray(data.MILL)) {
      for (const mill of data.MILL) {
        if (mill.name && !mill.finished) {
          grinders.push(mill.name);
        }
      }
    }

    // 收集器具列表
    const equipments: string[] = [];
    if (data.PREPARATION && Array.isArray(data.PREPARATION)) {
      for (const prep of data.PREPARATION) {
        if (prep.name && !prep.finished) {
          equipments.push(mapBrewEquipment(prep.name));
        }
      }
    }

    return {
      success: true,
      message: '导入成功',
      data: {
        coffeeBeans,
        brewingNotes,
        grinders,
        equipments,
      },
      stats: {
        beansCount: coffeeBeans.length,
        brewsCount: brewingNotes.length,
        grindersCount: grinders.length,
        equipmentsCount: equipments.length,
      },
    };
  } catch (error) {
    console.error('导入 Beanconqueror 数据失败:', error);
    return {
      success: false,
      message: `导入失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/**
 * 检测是否为 Beanconqueror 数据格式
 */
export function isBeanconquerorData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    return !!(
      data &&
      typeof data === 'object' &&
      (data.BEANS ||
        data.BREWS ||
        data.MILL ||
        data.PREPARATION ||
        data.SETTINGS ||
        data.VERSION)
    );
  } catch {
    return false;
  }
}
