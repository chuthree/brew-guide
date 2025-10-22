import { Stage } from '@/lib/core/config';

export interface TasteRatings {
  [key: string]: number;
}

// 拼配成分接口定义
export interface BlendComponent {
  percentage?: number; // 百分比 (1-100)，可选
  origin?: string; // 产地
  process?: string; // 处理法
  variety?: string; // 品种
}

// 咖啡豆数据模型 - 重构优化版
export interface CoffeeBean {
  // 核心标识
  id: string; // 唯一标识
  timestamp: number; // 时间戳
  name: string; // 咖啡豆名称

  // 基本信息
  image?: string; // 图片
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
  beanType?: 'espresso' | 'filter'; // 豆子类型：意式/手冲
  brand?: string; // 品牌

  // 评分相关字段 (榜单功能使用)
  overallRating?: number; // 总体评分/喜好星值 (1-5)
  ratingNotes?: string; // 评价备注

  // 博主榜单专用字段
  ratingEspresso?: number; // 美式评分 (博主榜单 - 意式豆)
  ratingMilkBased?: number; // 奶咖评分 (博主榜单 - 意式豆)
  purchaseChannel?: string; // 购买渠道 (博主榜单)

  // 拼配成分
  blendComponents?: BlendComponent[];
}

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
  };
  rating: number;
  taste: TasteRatings;
  notes: string;
  source?: string; // 笔记来源，如'quick-decrement'表示快捷扣除自动生成，'capacity-adjustment'表示容量调整
  beanId?: string; // 关联的咖啡豆ID

  // 变动记录详细信息
  changeRecord?: ChangeRecordDetails;

  // 向后兼容的字段（保留现有的快捷扣除字段）
  quickDecrementAmount?: number; // 快捷扣除的数量，仅对source为'quick-decrement'的笔记有效

  [key: string]: unknown; // 使用 unknown 代替 any
}
