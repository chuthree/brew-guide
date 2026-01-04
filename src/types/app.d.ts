import { Stage } from '@/lib/core/config';

export interface TasteRatings {
  [key: string]: number;
}

// 拼配成分接口定义
export interface BlendComponent {
  percentage?: number; // 百分比 (1-100)，可选
  origin?: string; // 产地
  estate?: string; // 庄园
  process?: string; // 处理法
  variety?: string; // 品种
}

// 待创建的咖啡豆（尚未持久化到数据库）
// 用于笔记表单中"创建并选择"功能，仅在笔记保存时才真正创建咖啡豆
export interface PendingCoffeeBean {
  id?: undefined; // 明确标识为未持久化状态
  name: string; // 咖啡豆名称
  isPending: true; // 类型判别标记
}

// 咖啡豆数据模型 - 重构优化版
export interface CoffeeBean {
  // 核心标识
  id: string; // 唯一标识
  timestamp: number; // 时间戳
  name: string; // 咖啡豆名称

  // 基本信息
  roaster?: string; // 烘焙商名称（可选）
  image?: string; // 正面图片
  backImage?: string; // 背面图片
  capacity?: string; // 容量
  remaining?: string; // 剩余量
  price?: string; // 价格

  // 产品特性
  roastLevel?: string; // 烘焙度
  roastDate?: string; // 烘焙日期
  flavor?: string[]; // 风味描述
  notes?: string; // 备注

  // 时间管理
  startDay?: number; // 开始使用天数
  endDay?: number; // 结束使用天数
  isFrozen?: boolean; // 是否冷冻状态
  isInTransit?: boolean; // 是否在途状态

  // 分类标签
  beanType?: 'espresso' | 'filter' | 'omni'; // 豆子类型：意式/手冲/全能
  beanState?: 'green' | 'roasted'; // 豆子状态：生豆/熟豆，默认为熟豆
  brand?: string; // 品牌

  // 生豆专用字段
  purchaseDate?: string; // 购买日期（生豆使用）

  // 生豆来源追溯（仅烘焙产生的熟豆使用）
  sourceGreenBeanId?: string; // 来源生豆ID

  // 评分相关字段 (榜单功能使用)
  overallRating?: number; // 总体评分/喜好星值 (1-5)
  ratingNotes?: string; // 评价备注

  // 拼配成分
  blendComponents?: BlendComponent[];
}

// 咖啡豆选择器使用的联合类型：已有豆子或待创建豆子
export type SelectableCoffeeBean = CoffeeBean | PendingCoffeeBean;

// 类型守卫：判断是否为待创建的咖啡豆
export function isPendingCoffeeBean(
  bean: SelectableCoffeeBean | null | undefined
): bean is PendingCoffeeBean;

// ExtendedCoffeeBean 已移除，直接使用 CoffeeBean（已包含 blendComponents）

// 变动记录的详细信息接口
export interface ChangeRecordDetails {
  // 容量调整相关
  capacityAdjustment?: {
    originalAmount: number; // 原始容量
    newAmount: number; // 新容量
    changeAmount: number; // 变化量（正数表示增加，负数表示减少）
    changeType: 'increase' | 'decrease' | 'set'; // 变化类型：增加、减少、直接设置
  };
  // 烘焙记录相关
  roastingRecord?: {
    greenBeanId: string; // 生豆ID
    greenBeanName: string; // 生豆名称
    roastedAmount: number; // 烘焙的重量(g)
    roastedBeanId?: string; // 烘焙后的熟豆ID（如果有关联）
    roastedBeanName?: string; // 烘焙后的熟豆名称
  };
}

// 修改 BrewingNoteData 接口，避免使用 any
export interface BrewingNoteData {
  id: string;
  timestamp: number;
  equipment?: string;
  method?: string;
  params?: {
    coffee: string;
    water: string;
    ratio: string;
    grindSize: string;
    temp: string;
  };
  stages?: Stage[];
  totalTime?: number;
  coffeeBeanInfo: {
    name: string;
    roastLevel: string;
    roastDate?: string;
    roaster?: string; // 烘焙商名称（可选，用于动态显示）
  };
  rating: number;
  taste: TasteRatings;
  notes: string;
  source?:
    | 'quick-decrement'
    | 'capacity-adjustment'
    | 'roasting'
    | 'beanconqueror-import'; // 笔记来源：快捷扣除、容量调整、烘焙、导入
  beanId?: string; // 关联的咖啡豆ID

  // 变动记录详细信息
  changeRecord?: ChangeRecordDetails;

  // 向后兼容的字段（保留现有的快捷扣除字段）
  quickDecrementAmount?: number; // 快捷扣除的数量，仅对source为'quick-decrement'的笔记有效

  [key: string]: unknown; // 使用 unknown 代替 any
}

// 磨豆机数据模型
export interface Grinder {
  id: string; // 唯一标识
  name: string; // 磨豆机名称
  currentGrindSize?: string; // 当前刻度
}
