export const APP_VERSION = '1.5.5';

// Types
export interface Stage {
  time?: number; // 对于饮料（beverage）类型是可选的
  label: string;
  water: string;
  detail: string;
  pourTime?: number;
  pourType?: string; // 支持自定义注水方式和意式机类型，包括'extraction'和'beverage'等
  valveStatus?: 'open' | 'closed';
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
  timestamp: number;
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
  };
  image?: string; // 添加可选的图片字段
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

// Brewing Methods Data
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
          {
            time: 25,
            pourTime: 10,
            label: '焖蒸(绕圈注水)',
            water: '30g',
            detail: '中心向外绕圈，确保均匀萃取',
            pourType: 'circle',
          },
          {
            time: 120,
            pourTime: 65,
            label: '绕圈注水',
            water: '225g',
            detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
            pourType: 'circle',
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
          {
            time: 25,
            pourTime: 10,
            label: '焖蒸(绕圈注水)',
            water: '30g',
            detail: '中心向外绕圈，确保均匀萃取',
            pourType: 'circle',
          },
          {
            time: 50,
            pourTime: 25,
            label: '绕圈注水',
            water: '140g',
            detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
            pourType: 'circle',
          },
          {
            time: 120,
            pourTime: 40,
            label: '中心注水',
            water: '225g',
            detail: '中心定点注水，降低萃取率',
            pourType: 'center',
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
          {
            time: 45,
            pourTime: 10,
            label: '绕圈注水 (1/2)',
            water: '50g',
            detail: '甜度控制，中心圆形注水，确保均匀浸润',
            pourType: 'circle',
          },
          {
            time: 90,
            pourTime: 7,
            label: '绕圈注水 (2/2)',
            water: '120g',
            detail: '甜度控制，大水流中心圆形注水',
            pourType: 'circle',
          },
          {
            time: 130,
            pourTime: 4,
            label: '绕圈注水 (1/3)',
            water: '180g',
            detail: '酸度控制，大水流中心向外螺旋注水',
            pourType: 'circle',
          },
          {
            time: 165,
            pourTime: 4,
            label: '绕圈注水 (2/3)',
            water: '240g',
            detail: '酸度控制，大水流中心向外螺旋注水',
            pourType: 'circle',
          },
          {
            time: 210,
            pourTime: 4,
            label: '绕圈注水 (3/3)',
            water: '300g',
            detail: '酸度控制，大水流中心向外螺旋注水',
            pourType: 'circle',
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
          {
            time: 30,
            pourTime: 10,
            label: '绕圈注水',
            water: '30g',
            detail: '（1:2）中心向外绕圈，确保均匀萃取',
            pourType: 'circle',
          },
          {
            time: 60,
            pourTime: 30,
            label: '绕圈注水',
            water: '120g',
            detail: '（1:6）中心向外缓慢画圈注水，均匀萃取咖啡风味',
            pourType: 'circle',
          },
          {
            time: 100,
            pourTime: 30,
            label: '中心注水',
            water: '225g',
            detail:
              '（1:X）中心定点注水，初始X值建议5(1:5)，可根据风味调整：过淡用4(1:4)，过浓用6(1:6)',
            pourType: 'center',
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
          {
            time: 90,
            pourTime: 20,
            label: '绕圈注水',
            water: '36g',
            detail:
              '平铺表面，相当于闷蒸 - 快速湿润与尽量不搅动粉层的方式来进行类闷蒸处理',
            pourType: 'circle',
          },
          {
            time: 240,
            pourTime: 42,
            label: '绕圈注水',
            water: '116g',
            detail: '第一段注水后等液面降至粉下后，再进行第二段注水',
            pourType: 'circle',
          },
          {
            time: 360,
            pourTime: 60,
            label: '绕圈注水',
            water: '200g',
            detail:
              '第二段注水后等液面降至粉下后，再进行第三段注水。注水完成后等待滴落状态至滴水时，即完成，之后可依据习惯添加水至喜欢的浓淡即可',
            pourType: 'circle',
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
          {
            time: 25,
            pourTime: 15,
            label: '焖蒸（绕圈注水）',
            water: '40g',
            detail: '中心向外绕圈，确保均匀萃取',
            pourType: 'circle',
          },
          {
            time: 55,
            pourTime: 20,
            label: '绕圈注水',
            water: '120g',
            detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
            pourType: 'circle',
          },
          {
            time: 70,
            pourTime: 10,
            label: '绕圈注水',
            water: '190g',
            detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
            pourType: 'circle',
          },
          {
            time: 95,
            pourTime: 5,
            label: '中心注水',
            water: '240g',
            detail: '中心定点大水流注水',
            pourType: 'center',
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
          {
            time: 40,
            pourTime: 10,
            label: '绕圈注水',
            water: '40g',
            detail: '(分享壶中预先放入50g冰块) 绕圈注水，确保均匀萃取',
            pourType: 'circle',
          },
          {
            time: 70,
            pourTime: 10,
            label: '绕圈注水',
            water: '120g',
            detail: '绕圈注水，继续萃取',
            pourType: 'circle',
          },
          {
            time: 120,
            pourTime: 10,
            label: '绕圈注水',
            water: '200g',
            detail: '绕圈注水至边缘，完成后杯中加满新鲜冰块',
            pourType: 'circle',
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
            time: 0,
            pourTime: 0,
            label: '(略)',
            water: '0g',
            detail: '(略)',
            pourType: 'other',
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
          {
            time: 180,
            pourTime: 10,
            label: '[关阀]加水',
            water: '240g',
            detail: '关闭阀门，加入热水',
            pourType: 'circle',
            valveStatus: 'closed',
          },
          {
            time: 240,
            pourTime: 0,
            label: '[开阀]等待过滤完成',
            water: '240g',
            detail: '打开阀门，等待过滤完成即可饮用',
            pourType: 'other',
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
            time: 0,
            pourTime: 0,
            label: '(略)',
            water: '0g',
            detail: '(略)',
            pourType: 'other',
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
          {
            time: 30,
            pourTime: 10,
            label: '焖蒸(绕圈注水)',
            water: '30g',
            detail: '中心向外绕圈，确保均匀萃取',
            pourType: 'circle',
          },
          {
            time: 70,
            pourTime: 10,
            label: '绕圈注水',
            water: '140g',
            detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
            pourType: 'circle',
          },
          {
            time: 120,
            pourTime: 40,
            label: '中心注水',
            water: '225g',
            detail: '中心定点注水，降低萃取率',
            pourType: 'center',
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
          {
            time: 90,
            pourTime: 20,
            label: '绕圈注水',
            water: '36g',
            detail:
              '平铺表面，相当于闷蒸 - 快速湿润与尽量不搅动粉层的方式来进行类闷蒸处理',
            pourType: 'circle',
          },
          {
            time: 240,
            pourTime: 42,
            label: '绕圈注水',
            water: '116g',
            detail: '第一段注水后等液面降至粉下后，再进行第二段注水',
            pourType: 'circle',
          },
          {
            time: 360,
            pourTime: 60,
            label: '绕圈注水',
            water: '200g',
            detail:
              '第二段注水后等液面降至粉下后，再进行第三段注水。注水完成后等待滴落状态至滴水时，即完成，之后可依据习惯添加水至喜欢的浓淡即可',
            pourType: 'circle',
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
          {
            time: 30,
            pourTime: 10,
            label: '绕圈注水',
            water: '30g',
            detail: '（1:2）中心向外绕圈，确保均匀萃取',
            pourType: 'circle',
          },
          {
            time: 60,
            pourTime: 30,
            label: '绕圈注水',
            water: '120g',
            detail: '（1:6）中心向外缓慢画圈注水，均匀萃取咖啡风味',
            pourType: 'circle',
          },
          {
            time: 100,
            pourTime: 30,
            label: '中心注水',
            water: '225g',
            detail:
              '（1:X）中心定点注水，初始X值建议5(1:5)，可根据风味调整：过淡用4(1:4)，过浓用6(1:6)',
            pourType: 'center',
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
            time: 0,
            pourTime: 0,
            label: '(略)',
            water: '0g',
            detail: '(略)',
            pourType: 'other',
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
          {
            time: 30,
            pourTime: 10,
            label: '焖蒸(绕圈注水)',
            water: '30g',
            detail: '中心向外绕圈，确保均匀萃取',
            pourType: 'circle',
          },
          {
            time: 70,
            pourTime: 15,
            label: '绕圈注水',
            water: '140g',
            detail: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
            pourType: 'circle',
          },
          {
            time: 120,
            pourTime: 20,
            label: '中心注水',
            water: '225g',
            detail: '中心定点注水，降低萃取率',
            pourType: 'center',
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
          {
            time: 90,
            pourTime: 20,
            label: '绕圈注水',
            water: '36g',
            detail:
              '平铺表面，相当于闷蒸 - 快速湿润与尽量不搅动粉层的方式来进行类闷蒸处理',
            pourType: 'circle',
          },
          {
            time: 240,
            pourTime: 42,
            label: '绕圈注水',
            water: '116g',
            detail: '第一段注水后等液面降至粉下后，再进行第二段注水',
            pourType: 'circle',
          },
          {
            time: 360,
            pourTime: 60,
            label: '绕圈注水',
            water: '200g',
            detail:
              '第二段注水后等液面降至粉下后，再进行第三段注水。注水完成后等待滴落状态至滴水时，即完成，之后可依据习惯添加水至喜欢的浓淡即可',
            pourType: 'circle',
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
          {
            time: 30,
            pourTime: 10,
            label: '绕圈注水',
            water: '30g',
            detail: '（1:2）中心向外绕圈，确保均匀萃取',
            pourType: 'circle',
          },
          {
            time: 60,
            pourTime: 30,
            label: '绕圈注水',
            water: '120g',
            detail: '（1:6）中心向外缓慢画圈注水，均匀萃取咖啡风味',
            pourType: 'circle',
          },
          {
            time: 100,
            pourTime: 30,
            label: '中心注水',
            water: '225g',
            detail:
              '（1:X）中心定点注水，初始X值建议5(1:5)，可根据风味调整：过淡用4(1:4)，过浓用6(1:6)',
            pourType: 'center',
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
            time: 0,
            pourTime: 0,
            label: '(略)',
            water: '0g',
            detail: '(略)',
            pourType: 'other',
          },
        ],
      },
    },
  ],
  Espresso: [
    {
      name: '意式浓缩',
      params: {
        coffee: '18g',
        water: '36g',
        ratio: '1:2',
        grindSize: '意式',
        temp: '93°C',
        stages: [
          {
            time: 25,
            label: '萃取浓缩',
            water: '36g',
            detail: '标准意式浓缩，风味平衡',
            pourType: 'extraction',
          },
        ],
      },
    },
    {
      name: '冰美式',
      params: {
        coffee: '18g',
        water: '36g',
        ratio: '1:2',
        grindSize: '意式',
        temp: '93°C',
        stages: [
          {
            time: 25,
            label: '萃取浓缩',
            water: '36g',
            detail: '标准意式浓缩',
            pourType: 'extraction',
          },
          {
            label: '加入饮用水',
            water: '70g',
            detail: '',
            pourType: 'beverage',
          },
          {
            label: '加入冰块',
            water: '180g',
            detail: '',
            pourType: 'beverage',
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
            time: 25,
            label: '萃取浓缩',
            water: '36g',
            detail: '标准意式浓缩',
            pourType: 'extraction',
          },
          {
            label: '加入牛奶',
            water: '200g',
            detail: '',
            pourType: 'beverage',
          },
          {
            label: '加入糖浆',
            water: '10g',
            detail: '',
            pourType: 'beverage',
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
];
