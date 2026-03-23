export const APP_VERSION = '1.5.13';

// Types

/**
 * 注水方式类型
 * - center: 中心注水
 * - circle: 绕圈注水
 * - ice: 添加冰块
 * - bypass: Bypass
 * - wait: 等待（新增）
 * - other: 其他
 * - extraction: 意式萃取
 * - beverage: 意式饮料
 * - string: 自定义注水方式 ID
 */
export type PourType =
  | 'center'
  | 'circle'
  | 'ice'
  | 'bypass'
  | 'wait'
  | 'other'
  | 'extraction'
  | 'beverage'
  | string;

/**
 * 冲煮步骤接口
 *
 * 新数据模型使用 duration（阶段用时）和 water（阶段注水量）
 * 旧数据模型使用 time（累计时间）和 pourTime（注水时间）
 *
 * 迁移期间两种格式共存，旧数据在读取时自动转换为新格式
 */
export interface Stage {
  // 核心字段
  pourType?: PourType; // 注水方式
  label: string; // 步骤标题
  water?: string; // 阶段注水量（克），等待步骤可选
  duration?: number; // 阶段用时（秒），bypass/beverage 可选
  detail: string; // 备注说明

  // 特殊字段
  valveStatus?: 'open' | 'closed'; // 阀门状态（聪明杯等）

  // 旧版兼容字段（用于迁移过渡期，读取旧数据时使用）
  time?: number; // 旧版累计时间（秒）
  pourTime?: number; // 旧版注水时间（秒）
}

export interface MethodParams {
  coffee: string;
  water: string;
  ratio: string;
  grindSize: string;
  temp: string;
  stages: Stage[];
}

export interface Method {
  id?: string;
  name: string;
  params: MethodParams;
  timestamp?: number;
}

export interface BrewingMethods {
  [key: string]: Method[];
}

export interface Equipment {
  id: string;
  name: string;
  note?: string;
}

export interface CustomEquipment extends Equipment {
  animationType:
    | 'v60'
    | 'kalita'
    | 'origami'
    | 'clever'
    | 'custom'
    | 'espresso'; // 使用哪种基础器具的动画
  hasValve?: boolean; // 是否有阀门（类似聪明杯）
  isCustom: true; // 标记为自定义器具
  timestamp?: number; // 最后修改时间戳（用于同步冲突解决）
  customShapeSvg?: string; // 自定义杯型的SVG路径数据
  customValveSvg?: string; // 自定义阀门关闭状态的SVG路径数据
  customValveOpenSvg?: string; // 自定义阀门开启状态的SVG路径数据
  customPourAnimations?: Array<{
    id: string;
    name: string;
    customAnimationSvg: string;
    isSystemDefault?: boolean;
    pourType?: 'center' | 'circle' | 'ice' | 'bypass';
    previewFrames?: number;
    frames?: Array<{
      id: string;
      svgData: string;
    }>;
  }>; // 自定义注水动画配置
}

// 直接定义变动记录相关类型，避免循环导入
interface ChangeRecordDetails {
  // 快捷扣除相关
  quickDecrementAmount?: number; // 快捷扣除的数量

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

export interface BrewingNote {
  id: string;
  timestamp: number; // 创建时间（不变）
  updatedAt?: number; // 最后修改时间（用于同步）
  equipment: string;
  method: string;
  params: {
    coffee: string;
    water: string;
    ratio: string;
    grindSize: string;
    temp: string;
  };
  coffeeBeanInfo?: {
    name: string;
    roastLevel: string;
    roastDate?: string;
    roaster?: string; // 烘焙商名称（独立字段）
  };
  image?: string; // 添加可选的图片字段
  images?: string[]; // 支持多图（最多9张）
  rating: number;
  taste: {
    [key: string]: number;
  };
  notes: string;
  totalTime: number;
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
}

// Equipment Data
export const equipmentList: Equipment[] = [
  {
    id: 'V60',
    name: 'V60',
  },
  {
    id: 'CleverDripper',
    name: '聪明杯',
  },
  {
    id: 'Kalita',
    name: '蛋糕滤杯',
  },
  {
    id: 'Origami',
    name: '折纸滤杯',
  },
  {
    id: 'Espresso',
    name: '意式咖啡机',
  },
  // 可以在这里添加更多器具
];

// Brewing Methods Data (新格式：使用 duration 和阶段水量，等待作为独立步骤)
export const brewingMethods: BrewingMethods = {
  V60: [
    {
      name: '一刀流',
      params: {
        coffee: '15g',
        water: '225g',
        ratio: '1:15',
        grindSize: '中细',
        temp: '92°C',
        stages: [
          // 原: time=25, pourTime=10, water=30g → duration=10, wait=15
          {
            pourType: 'circle',
            label: '焖蒸(绕圈注水)',
            water: '30',
            duration: 10,
            detail: '中心向外绕圈，确保均匀萃取',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 15,
            detail: '',
          },
          // 原: time=120, pourTime=65, water=225g → duration=65, wait=30, stageWater=195
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '195',
            duration: 65,
            detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 30,
            detail: '',
          },
        ],
      },
    },
    {
      name: '三段式',
      params: {
        coffee: '15g',
        water: '225g',
        ratio: '1:15',
        grindSize: '中细',
        temp: '92°C',
        stages: [
          // 原: time=25, pourTime=10, water=30g → duration=10, wait=15
          {
            pourType: 'circle',
            label: '焖蒸(绕圈注水)',
            water: '30',
            duration: 10,
            detail: '中心向外绕圈，确保均匀萃取',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 15,
            detail: '',
          },
          // 原: time=50, pourTime=25, water=140g → duration=25, stageWater=110
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '110',
            duration: 25,
            detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
          },
          // 原: time=120, pourTime=40, water=225g → duration=40, wait=30, stageWater=85
          {
            pourType: 'center',
            label: '中心注水',
            water: '85',
            duration: 40,
            detail: '中心定点注水，降低萃取率',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 30,
            detail: '',
          },
        ],
      },
    },
    {
      name: '粕谷哲4:6法',
      params: {
        coffee: '20g',
        water: '300g',
        ratio: '1:15',
        grindSize: '中细偏粗',
        temp: '96°C',
        stages: [
          // 原: time=45, pourTime=10, water=50g → duration=10, wait=35
          {
            pourType: 'circle',
            label: '绕圈注水 (1/2)',
            water: '50',
            duration: 10,
            detail: '甜度控制，中心圆形注水，确保均匀浸润',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 35,
            detail: '',
          },
          // 原: time=90, pourTime=7, water=120g → duration=7, wait=38, stageWater=70
          {
            pourType: 'circle',
            label: '绕圈注水 (2/2)',
            water: '70',
            duration: 7,
            detail: '甜度控制，大水流中心圆形注水',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 38,
            detail: '',
          },
          // 原: time=130, pourTime=4, water=180g → duration=4, wait=36, stageWater=60
          {
            pourType: 'circle',
            label: '绕圈注水 (1/3)',
            water: '60',
            duration: 4,
            detail: '酸度控制，大水流中心向外螺旋注水',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 36,
            detail: '',
          },
          // 原: time=165, pourTime=4, water=240g → duration=4, wait=31, stageWater=60
          {
            pourType: 'circle',
            label: '绕圈注水 (2/3)',
            water: '60',
            duration: 4,
            detail: '酸度控制，大水流中心向外螺旋注水',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 31,
            detail: '',
          },
          // 原: time=210, pourTime=4, water=300g → duration=4, wait=41, stageWater=60
          {
            pourType: 'circle',
            label: '绕圈注水 (3/3)',
            water: '60',
            duration: 4,
            detail: '酸度控制，大水流中心向外螺旋注水',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 41,
            detail: '',
          },
        ],
      },
    },
    {
      name: '队长无差别冲煮法',
      params: {
        coffee: '15g',
        water: '225g',
        ratio: '1:15',
        grindSize: '中细偏粗',
        temp: '92°C',
        stages: [
          // 原: time=30, pourTime=10, water=30g → duration=10, wait=20
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '30',
            duration: 10,
            detail: '（1:2）中心向外绕圈，确保均匀萃取',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 20,
            detail: '',
          },
          // 原: time=60, pourTime=30, water=120g → duration=30, stageWater=90
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '90',
            duration: 30,
            detail: '（1:6）中心向外缓慢画圈注水，均匀萃取咖啡风味',
          },
          // 原: time=100, pourTime=30, water=225g → duration=30, wait=10, stageWater=105
          {
            pourType: 'center',
            label: '中心注水',
            water: '105',
            duration: 30,
            detail:
              '（1:X）中心定点注水，初始X值建议5(1:5)，可根据风味调整：过淡用4(1:4)，过浓用6(1:6)',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 10,
            detail: '',
          },
        ],
      },
    },
    {
      name: '温水细粉慢冲LtFS',
      params: {
        coffee: '12g',
        water: '200g',
        ratio: '1:16.7',
        grindSize: '细（摩卡壶研磨度）',
        temp: '45°C',
        stages: [
          // 原: time=90, pourTime=20, water=36g → duration=20, wait=70
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '36',
            duration: 20,
            detail:
              '平铺表面，相当于闷蒸 - 快速湿润与尽量不搅动粉层的方式来进行类闷蒸处理',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 70,
            detail: '',
          },
          // 原: time=240, pourTime=42, water=116g → duration=42, wait=108, stageWater=80
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '80',
            duration: 42,
            detail: '第一段注水后等液面降至粉下后，再进行第二段注水',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 108,
            detail: '',
          },
          // 原: time=360, pourTime=60, water=200g → duration=60, wait=60, stageWater=84
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '84',
            duration: 60,
            detail:
              '第二段注水后等液面降至粉下后，再进行第三段注水。注水完成后等待滴落状态至滴水时，即完成，之后可依据习惯添加水至喜欢的浓淡即可',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 60,
            detail: '',
          },
        ],
      },
    },
    {
      name: '张师傅1:2:3冲煮法',
      params: {
        coffee: '16g',
        water: '240g',
        ratio: '1:15',
        grindSize: '中细',
        temp: '92°C',
        stages: [
          // 原: time=25, pourTime=15, water=40g → duration=15, wait=10
          {
            pourType: 'circle',
            label: '焖蒸（绕圈注水）',
            water: '40',
            duration: 15,
            detail: '中心向外绕圈，确保均匀萃取',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 10,
            detail: '',
          },
          // 原: time=55, pourTime=20, water=120g → duration=20, wait=10, stageWater=80
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '80',
            duration: 20,
            detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 10,
            detail: '',
          },
          // 原: time=70, pourTime=10, water=190g → duration=10, wait=5, stageWater=70
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '70',
            duration: 10,
            detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 5,
            detail: '',
          },
          // 原: time=95, pourTime=5, water=240g → duration=5, wait=20, stageWater=50
          {
            pourType: 'center',
            label: '中心注水',
            water: '50',
            duration: 5,
            detail: '中心定点大水流注水',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 20,
            detail: '',
          },
        ],
      },
    },
    {
      name: '冰手冲',
      params: {
        coffee: '20g',
        water: '200g',
        ratio: '1:10',
        grindSize: '中细',
        temp: '96°C',
        stages: [
          // 原: time=40, pourTime=10, water=40g → duration=10, wait=30
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '40',
            duration: 10,
            detail: '(分享壶中预先放入50g冰块) 绕圈注水，确保均匀萃取',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 30,
            detail: '',
          },
          // 原: time=70, pourTime=10, water=120g → duration=10, wait=20, stageWater=80
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '80',
            duration: 10,
            detail: '绕圈注水，继续萃取',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 20,
            detail: '',
          },
          // 原: time=120, pourTime=10, water=200g → duration=10, wait=40, stageWater=80
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '80',
            duration: 10,
            detail: '绕圈注水至边缘，完成后杯中加满新鲜冰块',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 40,
            detail: '',
          },
        ],
      },
    },
    {
      name: '夏季八冲',
      params: {
        coffee: '0g',
        water: '0g',
        ratio: '1:0',
        grindSize: '(略)',
        temp: '0°C',
        stages: [
          {
            pourType: 'other',
            label: '(略)',
            water: '0',
            duration: 0,
            detail: '(略)',
          },
        ],
      },
    },
  ],
  CleverDripper: [
    {
      name: '简单冲煮方案',
      params: {
        coffee: '16g',
        water: '240g',
        ratio: '1:15',
        grindSize: '中细',
        temp: '97°C',
        stages: [
          // 原: time=180, pourTime=10, water=240g → duration=10, wait=170
          {
            pourType: 'circle',
            label: '[关阀]加水',
            water: '240',
            duration: 10,
            detail: '关闭阀门，加入热水',
            valveStatus: 'closed',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 170,
            detail: '',
          },
          // 原: time=240, pourTime=0, water=240g → duration=60 (开阀等待过滤)
          {
            pourType: 'other',
            label: '[开阀]等待过滤完成',
            water: '0',
            duration: 60,
            detail: '打开阀门，等待过滤完成即可饮用',
            valveStatus: 'open',
          },
        ],
      },
    },
    {
      name: '夏季八冲',
      params: {
        coffee: '0g',
        water: '0g',
        ratio: '1:0',
        grindSize: '(略)',
        temp: '0°C',
        stages: [
          {
            pourType: 'other',
            label: '(略)',
            water: '0',
            duration: 0,
            detail: '(略)',
            valveStatus: 'open',
          },
        ],
      },
    },
  ],
  Kalita: [
    {
      name: '三段式',
      params: {
        coffee: '15g',
        water: '225g',
        ratio: '1:15',
        grindSize: '中细',
        temp: '92°C',
        stages: [
          // 原: time=30, pourTime=10, water=30g → duration=10, wait=20
          {
            pourType: 'circle',
            label: '焖蒸(绕圈注水)',
            water: '30',
            duration: 10,
            detail: '中心向外绕圈，确保均匀萃取',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 20,
            detail: '',
          },
          // 原: time=70, pourTime=10, water=140g → duration=10, wait=30, stageWater=110
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '110',
            duration: 10,
            detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 30,
            detail: '',
          },
          // 原: time=120, pourTime=40, water=225g → duration=40, wait=10, stageWater=85
          {
            pourType: 'center',
            label: '中心注水',
            water: '85',
            duration: 40,
            detail: '中心定点注水，降低萃取率',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 10,
            detail: '',
          },
        ],
      },
    },
    {
      name: '温水细粉慢冲LtFS',
      params: {
        coffee: '12g',
        water: '200g',
        ratio: '1:16.7',
        grindSize: '细（摩卡壶研磨度）',
        temp: '45°C',
        stages: [
          // 原: time=90, pourTime=20, water=36g → duration=20, wait=70
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '36',
            duration: 20,
            detail:
              '平铺表面，相当于闷蒸 - 快速湿润与尽量不搅动粉层的方式来进行类闷蒸处理',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 70,
            detail: '',
          },
          // 原: time=240, pourTime=42, water=116g → duration=42, wait=108, stageWater=80
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '80',
            duration: 42,
            detail: '第一段注水后等液面降至粉下后，再进行第二段注水',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 108,
            detail: '',
          },
          // 原: time=360, pourTime=60, water=200g → duration=60, wait=60, stageWater=84
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '84',
            duration: 60,
            detail:
              '第二段注水后等液面降至粉下后，再进行第三段注水。注水完成后等待滴落状态至滴水时，即完成，之后可依据习惯添加水至喜欢的浓淡即可',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 60,
            detail: '',
          },
        ],
      },
    },
    {
      name: '队长无差别冲煮法',
      params: {
        coffee: '15g',
        water: '225g',
        ratio: '1:15',
        grindSize: '中细偏粗',
        temp: '92°C',
        stages: [
          // 原: time=30, pourTime=10, water=30g → duration=10, wait=20
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '30',
            duration: 10,
            detail: '（1:2）中心向外绕圈，确保均匀萃取',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 20,
            detail: '',
          },
          // 原: time=60, pourTime=30, water=120g → duration=30, stageWater=90
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '90',
            duration: 30,
            detail: '（1:6）中心向外缓慢画圈注水，均匀萃取咖啡风味',
          },
          // 原: time=100, pourTime=30, water=225g → duration=30, wait=10, stageWater=105
          {
            pourType: 'center',
            label: '中心注水',
            water: '105',
            duration: 30,
            detail:
              '（1:X）中心定点注水，初始X值建议5(1:5)，可根据风味调整：过淡用4(1:4)，过浓用6(1:6)',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 10,
            detail: '',
          },
        ],
      },
    },
    {
      name: '夏季八冲',
      params: {
        coffee: '0g',
        water: '0g',
        ratio: '1:0',
        grindSize: '(略)',
        temp: '0°C',
        stages: [
          {
            pourType: 'other',
            label: '(略)',
            water: '0',
            duration: 0,
            detail: '(略)',
          },
        ],
      },
    },
  ],
  Origami: [
    {
      name: '三段式',
      params: {
        coffee: '15g',
        water: '225g',
        ratio: '1:15',
        grindSize: '中细',
        temp: '92°C',
        stages: [
          // 原: time=30, pourTime=10, water=30g → duration=10, wait=20
          {
            pourType: 'circle',
            label: '焖蒸(绕圈注水)',
            water: '30',
            duration: 10,
            detail: '中心向外绕圈，确保均匀萃取',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 20,
            detail: '',
          },
          // 原: time=70, pourTime=15, water=140g → duration=15, wait=25, stageWater=110
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '110',
            duration: 15,
            detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 25,
            detail: '',
          },
          // 原: time=120, pourTime=20, water=225g → duration=20, wait=30, stageWater=85
          {
            pourType: 'center',
            label: '中心注水',
            water: '85',
            duration: 20,
            detail: '中心定点注水，降低萃取率',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 30,
            detail: '',
          },
        ],
      },
    },
    {
      name: '温水细粉慢冲LtFS',
      params: {
        coffee: '12g',
        water: '200g',
        ratio: '1:16.7',
        grindSize: '细（摩卡壶研磨度）',
        temp: '45°C',
        stages: [
          // 原: time=90, pourTime=20, water=36g → duration=20, wait=70
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '36',
            duration: 20,
            detail:
              '平铺表面，相当于闷蒸 - 快速湿润与尽量不搅动粉层的方式来进行类闷蒸处理',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 70,
            detail: '',
          },
          // 原: time=240, pourTime=42, water=116g → duration=42, wait=108, stageWater=80
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '80',
            duration: 42,
            detail: '第一段注水后等液面降至粉下后，再进行第二段注水',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 108,
            detail: '',
          },
          // 原: time=360, pourTime=60, water=200g → duration=60, wait=60, stageWater=84
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '84',
            duration: 60,
            detail:
              '第二段注水后等液面降至粉下后，再进行第三段注水。注水完成后等待滴落状态至滴水时，即完成，之后可依据习惯添加水至喜欢的浓淡即可',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 60,
            detail: '',
          },
        ],
      },
    },
    {
      name: '队长无差别冲煮法',
      params: {
        coffee: '15g',
        water: '225g',
        ratio: '1:15',
        grindSize: '中细偏粗',
        temp: '92°C',
        stages: [
          // 原: time=30, pourTime=10, water=30g → duration=10, wait=20
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '30',
            duration: 10,
            detail: '（1:2）中心向外绕圈，确保均匀萃取',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 20,
            detail: '',
          },
          // 原: time=60, pourTime=30, water=120g → duration=30, stageWater=90
          {
            pourType: 'circle',
            label: '绕圈注水',
            water: '90',
            duration: 30,
            detail: '（1:6）中心向外缓慢画圈注水，均匀萃取咖啡风味',
          },
          // 原: time=100, pourTime=30, water=225g → duration=30, wait=10, stageWater=105
          {
            pourType: 'center',
            label: '中心注水',
            water: '105',
            duration: 30,
            detail:
              '（1:X）中心定点注水，初始X值建议5(1:5)，可根据风味调整：过淡用4(1:4)，过浓用6(1:6)',
          },
          {
            pourType: 'wait',
            label: '等待',
            duration: 10,
            detail: '',
          },
        ],
      },
    },
    {
      name: '夏季八冲',
      params: {
        coffee: '0g',
        water: '0g',
        ratio: '1:0',
        grindSize: '(略)',
        temp: '0°C',
        stages: [
          {
            pourType: 'other',
            label: '(略)',
            water: '0',
            duration: 0,
            detail: '(略)',
          },
        ],
      },
    },
  ],
  Espresso: [
    {
      name: '浓缩',
      params: {
        coffee: '18g',
        water: '36g',
        ratio: '1:2',
        grindSize: '意式',
        temp: '93°C',
        stages: [
          {
            pourType: 'extraction',
            label: '萃取浓缩',
            water: '36',
            duration: 25,
            detail: '标准意式浓缩，风味平衡',
          },
        ],
      },
    },
    {
      name: '美式',
      params: {
        coffee: '18g',
        water: '36g',
        ratio: '1:2',
        grindSize: '意式',
        temp: '93°C',
        stages: [
          {
            pourType: 'extraction',
            label: '萃取浓缩',
            water: '36',
            duration: 25,
            detail: '标准意式浓缩',
          },
          {
            pourType: 'beverage',
            label: '加入饮用水',
            water: '160',
            detail: '',
          },
        ],
      },
    },
    {
      name: '拿铁',
      params: {
        coffee: '18g',
        water: '36g',
        ratio: '1:2',
        grindSize: '意式',
        temp: '93°C',
        stages: [
          {
            pourType: 'extraction',
            label: '萃取浓缩',
            water: '36',
            duration: 25,
            detail: '标准意式浓缩',
          },
          {
            pourType: 'beverage',
            label: '加入牛奶',
            water: '160',
            detail: '',
          },
        ],
      },
    },
  ],
};

// 将现有的通用方案重命名为 commonMethods
export const commonMethods: BrewingMethods = {
  V60: brewingMethods.V60,
  CleverDripper: brewingMethods.CleverDripper,
  Kalita: brewingMethods.Kalita,
  Origami: brewingMethods.Origami,
  Espresso: brewingMethods.Espresso,
};

/**
 * 从通用方案创建一个自定义方案副本
 * @param method 通用方案
 * @param equipmentId 设备ID
 * @returns 可编辑的方案副本
 */
export function createEditableMethodFromCommon(
  method: Method,
  namePrefix: string = ''
): Method {
  return {
    id: `method-${Date.now()}`,
    name: namePrefix ? `${namePrefix}${method.name}` : `${method.name}(自定义)`,
    params: JSON.parse(JSON.stringify(method.params)), // 深拷贝参数
    timestamp: Date.now(),
  };
}

// 赞助者列表
export const sponsorsList = [
  'Asura',
  'QD',
  'dio哒哒哒',
  'H.M.S Cheshire',
  'Peter',
  'Wang王',
  'Winsun月餅',
  'ZhAOZzzzz',
  'Liquor',
  '五彩野牛',
  '云峰',
  '凡千百',
  '叫我彩笔就好了',
  '大只赖克宝',
  '忙',
  '橘橘橘です',
  '空青',
  '胡子哥',
  '莫',
  '陈杰',
  'qwq',
  '洛',
  'Loki',
  '🥠',
  '火羽飘飘',
  'Atom Heart',
  '梁炜东',
  'Mr.Wrong',
  '醒来',
  'Nicole',
  'Azkabaner',
  '薄荷蘑菇汤',
  '▲',
  'Arbalest',
  '林書晨',
  'Fanghan',
  'Collins',
  'Litlw',
  '面包狗',
  'Jiao',
  '阿大',
  'Liang桑',
  'Operatong',
  '阿姆斯壮 Pro Max',
  '有無咖屿所',
  'skyyoung',
  '柏',
  '。。。',
  '陆玖叁',
  '西河咖啡',
  '智慧机智帅气的博博',
  '小兔子乖乖',
  '万默咖啡',
  '🐶',
  '假的流浪貓頭目',
  '🎾',
  '404 not found',
  'Gilonblue',
  '志文',
  'Z先生',
  'D',
  'Lemueno',
  '匿名',
  'JayGoaler',
  '汉唐',
  '宝玉妹妹',
  'Jarod',
  'Typnosis',
  '一拂',
  '章本振',
  '橙成姜成橙',
  '1',
  'fragile:)',
  'keyball',
  'yoyo',
  '别处咖啡',
  '黑糖曲奇',
  '🧶',
  '米帝帝要战斗',
  'zc',
  '云龙',
  'Fabian',
  '早睡先生',
  '唔咦咦啊',
  '阳阳:-*',
  '王猛',
  'KinWai_',
  '之鹿',
  'Cc',
  '大葱葱葱葱葱葱葱头',
  'Hans',
  '杨源',
  'Jerry_li',
  'Polaris',
  'Mooner',
  '已经成为美女',
  '果汁',
  '熊孩子',
  '飓风咖啡',
  '枫桦',
  '🥥🥥🥥',
  '明汀',
  '银河',
  '虾滑',
  '贞贞锤',
];
