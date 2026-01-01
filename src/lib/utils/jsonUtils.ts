import {
  type Method,
  type CustomEquipment,
  type Stage,
} from '@/lib/core/config';
import { type CoffeeBean, type BlendComponent } from '@/types/app';
import {
  isLegacyFormat,
  migrateStages,
  type LegacyStage,
} from '@/lib/brewing/stageMigration';

// 定义Stage类型的接口，用于解析JSON（支持新旧两种格式）
interface StageData {
  // 新格式字段
  duration?: number;
  // 旧格式字段
  time?: number;
  pourTime?: number;
  // 通用字段
  label?: string;
  water?: string;
  detail?: string;
  pourType?: string;
  valveStatus?: string;
}

// CoffeeBean 类型现在从 @/types/app 导入，移除本地定义

interface BrewingNote {
  id: string;
  beanId: string;
  methodId: string;
  methodName: string;
  equipment: string;
  date: string;
  method?: string;
  coffeeBeanInfo?: {
    name: string;
    roastLevel: string;
  };
  params: {
    coffee: string;
    water: string;
    ratio: string;
    grindSize: string;
    temp: string;
  };
  rating: number;
  notes: string;
  taste: {
    acidity: number;
    sweetness: number;
    bitterness: number;
    body: number;
  };
  brewTime?: string;
  timestamp: number;
}

// BlendComponent 类型现在从 @/types/app 导入，移除本地定义

// 定义ParsedStage接口（新格式）
interface ParsedStage {
  pourType?: string;
  label: string;
  water?: string;
  duration?: number;
  detail: string;
  valveStatus?: 'open' | 'closed';
}

/**
 * 清理JSON字符串，移除不必要的包装
 * @param jsonString 可能需要清理的JSON字符串
 * @returns 清理后的JSON字符串
 */
export function cleanJsonString(jsonString: string): string {
  // 去除首尾空白字符
  let cleanedString = jsonString.trim();

  // 检查是否被```json和```包裹，如常见的复制格式
  if (cleanedString.startsWith('```json') && cleanedString.endsWith('```')) {
    cleanedString = cleanedString.slice(7, -3).trim();
  } else if (cleanedString.startsWith('```') && cleanedString.endsWith('```')) {
    cleanedString = cleanedString.slice(3, -3).trim();
  }

  // 处理掐头掐尾的情况，即前后都有多余内容
  try {
    // 直接尝试解析，如果成功则无需进一步处理
    JSON.parse(cleanedString);
  } catch (_err) {
    // 如果解析失败，尝试查找有效的JSON部分

    // 1. 查找第一个 { 和最后一个 } 之间的内容
    const firstBrace = cleanedString.indexOf('{');
    const lastBrace = cleanedString.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const potentialJson = cleanedString.slice(firstBrace, lastBrace + 1);

      try {
        // 验证提取的内容是否是有效的JSON
        JSON.parse(potentialJson);
        cleanedString = potentialJson;
        // Log in development only
        if (process.env.NODE_ENV === 'development') {
          console.warn('成功从文本中提取有效JSON');
        }
      } catch (_extractErr) {
        // 如果提取的内容仍然不是有效的JSON，保持原样
        if (process.env.NODE_ENV === 'development') {
          console.error('尝试提取JSON失败:', _extractErr);
        }
      }
    }
  }

  return cleanedString;
}

/**
 * 从文本中提取数据
 * @param text 包含数据的文本
 * @param customEquipment 自定义器具配置（可选）
 * @returns 提取的JSON数据或null
 */
export function extractJsonFromText(
  text: string,
  customEquipment?: CustomEquipment
):
  | Method
  | CoffeeBean
  | Partial<CoffeeBean>
  | BrewingNote
  | CustomEquipment
  | CoffeeBean[]
  | null {
  try {
    // 首先检查是否为自然语言格式的文本
    const originalText = text.trim();

    // 检查是否是冲煮方案文本格式
    if (originalText.startsWith('【冲煮方案】')) {
      // Log in development only
      if (process.env.NODE_ENV === 'development') {
        console.warn('检测到冲煮方案文本格式');
      }
      return parseMethodText(originalText, customEquipment);
    }

    // 检查是否是咖啡豆文本格式
    if (
      originalText.startsWith('【咖啡豆】') ||
      originalText.startsWith('【咖啡豆信息】')
    ) {
      // Log in development only
      if (process.env.NODE_ENV === 'development') {
        console.warn('检测到咖啡豆文本格式');
      }
      // 检查是否包含多个咖啡豆（使用 ---\n 分隔）
      const beanSections = originalText.split(/\n---\n/).filter(section => {
        const trimmed = section.trim();
        return (
          trimmed.startsWith('【咖啡豆】') ||
          trimmed.startsWith('【咖啡豆信息】')
        );
      });

      if (beanSections.length > 1) {
        // 批量导入：解析多个咖啡豆
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `检测到批量咖啡豆文本格式，共 ${beanSections.length} 个`
          );
        }
        const beans: Partial<CoffeeBean>[] = [];
        for (const section of beanSections) {
          const bean = parseCoffeeBeanText(section.trim());
          if (bean && bean.name) {
            beans.push(bean);
          }
        }
        return beans.length > 0 ? (beans as CoffeeBean[]) : null;
      }

      // 单个咖啡豆
      return parseCoffeeBeanText(originalText);
    }

    // 检查是否是冲煮记录文本格式
    if (originalText.startsWith('【冲煮记录】')) {
      // Log in development only
      if (process.env.NODE_ENV === 'development') {
        console.warn('检测到冲煮记录文本格式');
      }
      return parseBrewingNoteText(originalText);
    }

    // 如果不是明确的文本格式，尝试按JSON处理
    const cleanedJson = cleanJsonString(text);

    // 尝试解析JSON
    const data = JSON.parse(cleanedJson);

    // 检查是否是咖啡豆数组
    if (Array.isArray(data)) {
      // 验证每个元素是否都是咖啡豆数据 - 只检查name字段
      if (
        data.every(
          item =>
            typeof item === 'object' &&
            item !== null &&
            'name' in item &&
            typeof (item as Record<string, unknown>).name === 'string' &&
            ((item as Record<string, unknown>).name as string).trim() !== ''
        )
      ) {
        // Log in development only
        if (process.env.NODE_ENV === 'development') {
          console.warn('检测到咖啡豆数组格式');
        }
        return data as CoffeeBean[];
      }
      // Log in development only
      if (process.env.NODE_ENV === 'development') {
        console.warn('无法识别的数组JSON结构:', data);
      }
      return null;
    }

    // 如果数据不是对象，返回null
    if (typeof data !== 'object' || data === null) {
      return null;
    }

    // 检查是否是器具数据
    if ('equipment' in data) {
      const equipment = data.equipment;

      // 验证必要的字段
      if (!equipment.name) {
        throw new Error('器具数据缺少名称');
      }

      if (
        !equipment.animationType ||
        !['v60', 'kalita', 'origami', 'clever', 'custom', 'espresso'].includes(
          equipment.animationType
        )
      ) {
        throw new Error('无效的器具动画类型');
      }

      // 验证自定义SVG（如果是自定义类型且不是意式机）
      if (equipment.animationType === 'custom' && !equipment.customShapeSvg) {
        throw new Error('自定义器具缺少形状SVG');
      }

      // 如果有阀门，验证阀门SVG
      if (equipment.hasValve) {
        if (!equipment.customValveSvg || !equipment.customValveOpenSvg) {
          throw new Error('带阀门的器具缺少阀门SVG');
        }
      }

      // 验证methods数组（如果存在）
      if ('methods' in data && data.methods) {
        if (!Array.isArray(data.methods)) {
          throw new Error('methods字段必须是数组');
        }
      }

      return data;
    }

    // 检查是否是方案数据
    if ('params' in data && 'stages' in data.params) {
      return parseMethodFromJson(cleanedJson);
    }

    // 检查是否是咖啡豆数据 - 只要求有名称即可
    if (
      'name' in data &&
      typeof data.name === 'string' &&
      data.name.trim() !== ''
    ) {
      return data as CoffeeBean;
    } // 检查是否是笔记数据
    if ('methodName' in data && 'equipment' in data) {
      return data as BrewingNote;
    }

    // Log in development only
    if (process.env.NODE_ENV === 'development') {
      console.warn('无法识别的JSON结构:', data);
    }
    return null;
  } catch (error) {
    // Log error in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('解析JSON失败:', error);
    }
    return null;
  }
}

/**
 * 从优化JSON中解析出Method对象
 * 支持新旧两种数据格式：
 * - 新格式：使用 duration（阶段用时）和 water（阶段注水量）
 * - 旧格式：使用 time（累计时间）和 pourTime（注水时间）
 *
 * Requirements: 5.1, 5.3
 */
export function parseMethodFromJson(jsonString: string): Method | null {
  try {
    // 清理输入的JSON字符串
    const cleanedJsonString = cleanJsonString(jsonString);

    // 解析JSON
    const parsedData = JSON.parse(cleanedJsonString);

    // 验证必要字段 - 优先使用name字段，其次是method字段
    const methodName =
      parsedData.name ||
      parsedData.method ||
      parsedData.coffeeBeanInfo?.method ||
      `${parsedData.equipment}优化方案`;

    if (!methodName && !parsedData.equipment) {
      throw new Error('导入的JSON缺少必要字段 (name或method)');
    }

    // 检查是否是意式咖啡方案 - 改进识别逻辑
    const isEspresso =
      parsedData.equipment === 'Espresso' ||
      parsedData.equipment === '意式咖啡机' ||
      parsedData.isEspresso === true ||
      (parsedData.params?.stages &&
        Array.isArray(parsedData.params.stages) &&
        parsedData.params.stages.some(
          (stage: StageData) =>
            stage.pourType === 'extraction' || stage.pourType === 'beverage'
        ));

    // 构建Method对象 - 始终生成新的ID，避免ID冲突
    const method: Method = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: methodName,
      params: {
        coffee: parsedData.params?.coffee || '15g',
        water: parsedData.params?.water || '225g',
        ratio: parsedData.params?.ratio || '1:15',
        grindSize: parsedData.params?.grindSize || '中细',
        temp: parsedData.params?.temp || '93°C',
        stages: [],
      },
    };

    // 处理stages
    if (parsedData.params?.stages && Array.isArray(parsedData.params.stages)) {
      const rawStages = parsedData.params.stages;

      // 检测是否为旧格式并进行迁移
      if (isLegacyFormat(rawStages)) {
        // 旧格式：使用迁移服务转换
        if (process.env.NODE_ENV === 'development') {
          console.warn('检测到旧版数据格式，正在迁移...');
        }
        method.params.stages = migrateStages(rawStages as LegacyStage[]);
      } else {
        // 新格式：直接解析
        method.params.stages = rawStages.map((stage: StageData) => {
          // 确保pourType是有效的值
          let pourType = stage.pourType || 'circle';
          if (
            ![
              'center',
              'circle',
              'ice',
              'other',
              'extraction',
              'beverage',
              'wait',
              'bypass',
            ].includes(pourType)
          ) {
            // 映射可能的pourType值
            if (pourType === 'spiral') pourType = 'circle';
            // 保留自定义注水方式ID
          }

          // 确保阀门状态是有效的值
          let valveStatus = stage.valveStatus || '';
          if (valveStatus && !['open', 'closed'].includes(valveStatus)) {
            valveStatus = ''; // 如果不是有效值，则设置为空
          }

          // 构建新格式的步骤对象
          const parsedStage: Stage = {
            pourType: pourType,
            label: stage.label || '',
            detail: stage.detail || '',
          };

          // 处理 water 字段
          if (stage.water !== undefined) {
            parsedStage.water = stage.water;
          }

          // 处理 duration 字段
          // bypass 和 beverage 类型不需要 duration
          if (pourType !== 'bypass' && pourType !== 'beverage') {
            if (stage.duration !== undefined) {
              parsedStage.duration = stage.duration;
            }
          }

          // 处理阀门状态
          if (valveStatus) {
            parsedStage.valveStatus = valveStatus as 'open' | 'closed';
          }

          return parsedStage;
        });
      }
    }

    // 验证stages
    if (!method.params.stages || method.params.stages.length === 0) {
      throw new Error('导入的JSON缺少冲煮步骤');
    }

    // 强制确保name字段不为空
    if (!method.name) {
      method.name = `${parsedData.equipment || ''}优化冲煮方案`;
    }

    // 调试信息
    if (process.env.NODE_ENV === 'development') {
      console.warn('解析后的Method对象:', method);
    }

    return method;
  } catch (err) {
    // Log error in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('解析方法JSON出错:', err);
    }
    return null;
  }
}

/**
 * 获取示例JSON
 */
function getExampleJson() {
  return `{
  "equipment": "V60",
  "method": "改良分段式一刀流",
  "coffeeBeanInfo": {
    "name": "",
    "roastLevel": "中度烘焙",
    "roastDate": ""
  },
  "params": {
    "coffee": "15g",
    "water": "225g",
    "ratio": "1:15",
    "grindSize": "中细",
    "temp": "94°C",
    "videoUrl": "",
    "stages": [
      {
        "time": 30,
        "pourTime": 15,
        "label": "螺旋焖蒸",
        "water": "45g",
        "detail": "加大注水搅拌力度，充分激活咖啡粉层",
        "pourType": "circle"
      },
      {
        "time": 60,
        "pourTime": 20,
        "label": "快节奏中心注水",
        "water": "90g",
        "detail": "高水位快速注入加速可溶性物质释放",
        "pourType": "center"
      },
      {
        "time": 120,
        "pourTime": 30,
        "label": "分层绕圈注水",
        "water": "225g",
        "detail": "分三次间隔注水控制萃取节奏",
        "pourType": "circle"
      }
    ]
  },
  "notes": ""
}`;
}

/**
 * 将Method对象转换为JSON字符串，用于分享
 * 导出使用新格式：duration（阶段用时）和 water（阶段注水量）
 *
 * Requirements: 5.2
 */
function methodToJson(method: Method): string {
  // 检查是否是意式咖啡方案
  const isEspresso = method.params.stages.some(
    stage => stage.pourType === 'extraction' || stage.pourType === 'beverage'
  );

  // 创建深拷贝
  const methodCopy = JSON.parse(JSON.stringify(method));

  // 清理 stages，确保导出新格式
  const cleanedStages = methodCopy.params.stages.map((stage: Stage) => {
    const cleanStage: Record<string, unknown> = {
      pourType: stage.pourType || 'circle',
      label: stage.label || '',
      detail: stage.detail || '',
    };

    // 添加 water 字段（等待阶段可能没有）
    if (stage.water !== undefined) {
      cleanStage.water = stage.water;
    }

    // 添加 duration 字段（bypass/beverage 类型没有）
    if (
      stage.duration !== undefined &&
      stage.pourType !== 'bypass' &&
      stage.pourType !== 'beverage'
    ) {
      cleanStage.duration = stage.duration;
    }

    // 添加阀门状态（如果有）
    if (stage.valveStatus) {
      cleanStage.valveStatus = stage.valveStatus;
    }

    return cleanStage;
  });

  // 创建配置对象
  const configObject = {
    method: methodCopy.name,
    isEspresso: isEspresso,
    params: {
      coffee: methodCopy.params.coffee,
      water: methodCopy.params.water,
      ratio: methodCopy.params.ratio,
      grindSize: methodCopy.params.grindSize,
      temp: methodCopy.params.temp,
      stages: cleanedStages,
    },
  };

  // 返回格式化的JSON字符串
  return JSON.stringify(configObject, null, 2);
}

/**
 * 生成咖啡豆识别模板JSON
 * 用于生成AI识别咖啡豆图片的提示词
 */
function generateBeanTemplateJson() {
  return `{
  "name": "",
  "image": "",
  "price": "",
  "capacity": "",
  "remaining": "",
  "roastLevel": "",
  "roastDate": "",
  "flavor": [],
  "blendComponents": [
    {
      "percentage": 100,
      "origin": "",
      "estate": "",
      "process": "",
      "variety": ""
    }
  ],
  "notes": ""
}`;
}

/**
 * 将咖啡豆对象转换为可读文本格式
 * @param bean 咖啡豆对象
 * @param options 可选配置
 * @param options.includeMetadata 是否包含元数据标记，默认为 true
 * @returns 格式化的可读文本
 */
export function beanToReadableText(
  bean: CoffeeBean,
  options?: { includeMetadata?: boolean }
): string {
  const { includeMetadata = true } = options || {};
  let text = `【咖啡豆信息】${bean.name}\n`;

  // 确定豆子类型（单品/拼配）
  const isBlend =
    bean.blendComponents &&
    Array.isArray(bean.blendComponents) &&
    bean.blendComponents.length > 1;

  // 如果有beanType字段（手冲/意式/全能），添加用途信息
  if (bean.beanType) {
    text += `用途: ${
      bean.beanType === 'filter'
        ? '手冲'
        : bean.beanType === 'espresso'
          ? '意式'
          : bean.beanType === 'omni'
            ? '全能'
            : '未知'
    }\n`;
  }

  // 原始咖啡豆属性
  if (bean.price) {
    text += `价格: ${bean.price}元\n`;
  }

  if (bean.capacity) {
    text += `容量: ${bean.capacity}g\n`;
  }

  if (bean.roastLevel) {
    text += `烘焙度: ${bean.roastLevel}\n`;
  }

  if (bean.roastDate) {
    text += `烘焙日期: ${bean.roastDate}\n`;
  }

  // 显示成分信息（统一处理单品和拼配）
  if (
    bean.blendComponents &&
    Array.isArray(bean.blendComponents) &&
    bean.blendComponents.length > 0
  ) {
    if (isBlend) {
      // 拼配豆：检查是否有有效的成分信息
      const hasValidBlendInfo = bean.blendComponents.some(
        component =>
          component.origin ||
          component.estate ||
          component.process ||
          component.variety
      );

      if (hasValidBlendInfo) {
        text += `拼配成分:\n`;
        bean.blendComponents.forEach((component, index) => {
          const componentText = [
            component.origin || '',
            component.estate || '',
            component.process || '',
            component.variety || '',
          ]
            .filter(v => v) // 过滤掉空值
            .join(' | ');

          const percentageText = component.percentage
            ? `${component.percentage}% `
            : '';

          text += `${index + 1}. ${percentageText}${componentText}\n`;
        });
      }
    } else {
      // 单品豆：检查是否有有效的成分信息
      const component = bean.blendComponents[0];
      if (
        component &&
        (component.origin ||
          component.estate ||
          component.process ||
          component.variety)
      ) {
        text += `成分信息:\n`;
        if (component.origin) text += `产地: ${component.origin}\n`;
        if (component.estate) text += `庄园: ${component.estate}\n`;
        if (component.process) text += `处理法: ${component.process}\n`;
        if (component.variety) text += `品种: ${component.variety}\n`;
      }
    }
  }

  // 风味和备注
  if (bean.flavor && Array.isArray(bean.flavor) && bean.flavor.length) {
    text += `风味标签: ${bean.flavor.join(', ')}\n`;
  }

  if (bean.startDay || bean.endDay) {
    if (bean.startDay) {
      text += `养豆期: ${bean.startDay}天\n`;
    }

    if (bean.endDay) {
      text += `赏味期: ${bean.endDay}天\n`;
    }
  }

  if (bean.notes) {
    text += `备注信息:\n${bean.notes}\n`;
  }

  // 元数据标记（可选）
  if (includeMetadata) {
    text += '\n---\n@DATA_TYPE:COFFEE_BEAN@\n';
  }
  return text;
}

/**
 * 根据注水方式名称查找对应的自定义注水方式ID
 * @param name 注水方式名称
 * @param customEquipment 自定义器具配置
 * @returns 对应的自定义注水方式ID，如果找不到则返回名称本身
 */
function findCustomPourTypeIdByName(
  name: string,
  customEquipment?: CustomEquipment
): string {
  // 如果没有自定义器具或名称为空，直接返回名称本身
  if (!customEquipment?.customPourAnimations || !name) {
    return name;
  }

  // 查找名称匹配的自定义注水动画
  const customAnimation = customEquipment.customPourAnimations.find(
    anim => anim.name === name
  );

  // 如果找到匹配的动画，返回其ID
  if (customAnimation) {
    // Log in development only
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[jsonUtils] 找到自定义注水方式ID: ${customAnimation.id}，名称: ${name}`
      );
    }
    return customAnimation.id;
  }

  // 如果没有找到，返回名称本身
  return name;
}

/**
 * 将注水方式中文名称映射为 pourType 值
 * @param name 注水方式中文名称
 * @param customEquipment 自定义器具配置
 * @returns pourType 值
 */
function mapPourTypeName(
  name: string,
  customEquipment?: CustomEquipment
): string {
  const nameMap: Record<string, string> = {
    中心注水: 'center',
    绕圈注水: 'circle',
    添加冰块: 'ice',
    萃取浓缩: 'extraction',
    饮料: 'beverage',
    等待: 'wait',
    Bypass: 'bypass',
  };

  if (nameMap[name]) {
    return nameMap[name];
  }

  // 查找自定义注水方式
  return findCustomPourTypeIdByName(name, customEquipment);
}

/**
 * 将冲煮方案对象转换为可读文本格式（v2 简洁版）
 * 适合微信分享，格式清晰易读
 *
 * @param method 冲煮方案对象
 * @param customEquipment 自定义器具配置（可选）
 * @returns 格式化的可读文本
 */
export function methodToReadableText(
  method: Method,
  customEquipment?: CustomEquipment
): string {
  const { name, params } = method;

  // 检查是否是意式咖啡方案
  const isEspresso =
    customEquipment?.animationType === 'espresso' ||
    params.stages.some(
      stage => stage.pourType === 'extraction' || stage.pourType === 'beverage'
    );

  // 构建可读文本 - 简洁的头部信息
  let text = `【冲煮方案】${name}\n`;
  text += `${params.coffee} | ${params.ratio} | ${params.grindSize} | ${params.temp}`;
  if (isEspresso) text += ' | 意式';
  text += '\n\n';

  if (params.stages && params.stages.length > 0) {
    params.stages.forEach((stage, index: number) => {
      // 获取注水方式名称
      let pourTypeName = '';
      if (stage.pourType) {
        // 优先查找自定义注水方式
        if (customEquipment?.customPourAnimations) {
          const customAnim = customEquipment.customPourAnimations.find(
            a => a.id === stage.pourType
          );
          if (customAnim?.name) pourTypeName = customAnim.name;
        }
        // 系统默认名称
        if (!pourTypeName) {
          const typeMap: Record<string, string> = {
            center: '中心注水',
            circle: '绕圈注水',
            ice: '添加冰块',
            extraction: '萃取浓缩',
            beverage: '饮料',
            wait: '等待',
            bypass: 'Bypass',
          };
          pourTypeName = typeMap[stage.pourType] || stage.pourType;
        }
      }

      // 构建步骤行：序号. [注水方式] 标签 用时 水量
      const parts: string[] = [];

      // 注水方式
      if (pourTypeName) parts.push(`[${pourTypeName}]`);

      // 标签
      if (stage.label) parts.push(stage.label);

      // 用时（bypass/beverage 不显示），使用 ″ 符号
      if (
        stage.duration &&
        stage.pourType !== 'bypass' &&
        stage.pourType !== 'beverage'
      ) {
        parts.push(`${stage.duration}″`);
      }

      // 水量（去掉已有的单位再统一加 g）
      if (stage.water) {
        const waterValue = stage.water.replace(/g$/i, '');
        parts.push(`${waterValue}g`);
      }

      text += `${index + 1}. ${parts.join(' ')}\n`;

      // 详情（缩进显示）
      if (stage.detail) {
        text += `   ${stage.detail}\n`;
      }
    });
  }

  // 序列化标识（用于导入识别）
  text += `\n@DATA_TYPE:BREWING_METHOD@`;

  return text;
}

/**
 * 将冲煮记录对象转换为可读文本格式
 * @param note 冲煮记录对象
 * @returns 格式化的可读文本
 */
function brewingNoteToReadableText(note: BrewingNote): string {
  const { equipment, method, params, coffeeBeanInfo, rating, taste, notes } =
    note;

  // 构建可读文本
  let text = `【冲煮记录】\n`;
  text += `设备: ${equipment || '未设置'}\n`;
  text += `方法: ${method || '未设置'}\n`;
  text += `咖啡豆: ${coffeeBeanInfo?.name || '未设置'}\n`;
  text += `烘焙度: ${coffeeBeanInfo?.roastLevel || '未设置'}\n`;

  if (params) {
    text += `\n参数设置:\n`;
    text += `咖啡粉量: ${params.coffee || '未设置'}\n`;
    text += `水量: ${params.water || '未设置'}\n`;
    text += `比例: ${params.ratio || '未设置'}\n`;
    text += `研磨度: ${params.grindSize || '未设置'}\n`;
    text += `水温: ${params.temp || '未设置'}\n`;
  }

  if (taste) {
    text += `\n风味评分:\n`;
    text += `酸度: ${taste.acidity || 0}/5\n`;
    text += `甜度: ${taste.sweetness || 0}/5\n`;
    text += `苦度: ${taste.bitterness || 0}/5\n`;
    text += `醇厚度: ${taste.body || 0}/5\n`;
  }

  if (rating) {
    text += `\n综合评分: ${rating}/5\n`;
  }

  if (notes) {
    text += `\n笔记:\n${notes}\n`;
  }

  // 添加隐藏的序列化标识（不再包含JSON）
  text += `@DATA_TYPE:BREWING_NOTE@`;

  return text;
}

/**
 * 从自然语言文本中解析咖啡豆数据
 * @param text 咖啡豆的文本描述
 * @returns 结构化的咖啡豆数据
 */
function parseCoffeeBeanText(text: string): Partial<CoffeeBean> | null {
  const bean: Partial<CoffeeBean> = {};

  // 提取名称
  const nameMatch =
    text.match(/【咖啡豆】(.*?)(?:\n|$)/) ||
    text.match(/【咖啡豆信息】(.*?)(?:\n|$)/);
  if (nameMatch && nameMatch[1]) {
    bean.name = nameMatch[1].trim();
  }

  // 提取容量和剩余容量
  const capacityMatch = text.match(/容量:\s*(\d+)\/(\d+)g/);
  if (capacityMatch && capacityMatch[1] && capacityMatch[2]) {
    bean.remaining = capacityMatch[1];
    bean.capacity = capacityMatch[2];
  } else {
    // 兼容旧格式
    const oldCapacityMatch = text.match(/容量:\s*(\d+)g/);
    if (oldCapacityMatch && oldCapacityMatch[1]) {
      bean.capacity = oldCapacityMatch[1];

      // 尝试提取旧格式的剩余容量
      const oldRemainingMatch = text.match(/剩余(\d+)g/);
      if (oldRemainingMatch && oldRemainingMatch[1]) {
        bean.remaining = oldRemainingMatch[1];
      } else {
        // 只在有总量时才设置剩余量
        bean.remaining = bean.capacity;
      }
    }
  }

  // 提取烘焙度
  const roastMatch = text.match(/烘焙度:\s*(.*?)(?:\n|$)/);
  if (
    roastMatch &&
    roastMatch[1] &&
    roastMatch[1] !== '未知' &&
    roastMatch[1].trim() !== ''
  ) {
    bean.roastLevel = roastMatch[1].trim();
  }

  // 提取烘焙日期
  const dateMatch = text.match(/烘焙日期:\s*(.*?)(?:\n|$)/);
  if (dateMatch && dateMatch[1]) {
    bean.roastDate = dateMatch[1].trim();
  }

  // 提取单品豆的成分信息（产地、庄园、处理法、品种）
  const originMatch = text.match(/产地:\s*(.*?)(?:\n|$)/);
  const estateMatch = text.match(/庄园:\s*(.*?)(?:\n|$)/);
  const processMatch = text.match(/处理法:\s*(.*?)(?:\n|$)/);
  const varietyMatch = text.match(/品种:\s*(.*?)(?:\n|$)/);

  // 如果有任何成分信息，创建blendComponents
  if (
    originMatch?.[1] ||
    estateMatch?.[1] ||
    processMatch?.[1] ||
    varietyMatch?.[1]
  ) {
    bean.blendComponents = [
      {
        percentage: 100,
        origin: originMatch?.[1]?.trim() || '',
        estate: estateMatch?.[1]?.trim() || '',
        process: processMatch?.[1]?.trim() || '',
        variety: varietyMatch?.[1]?.trim() || '',
      },
    ];
  }

  // 提取用途
  const usageMatch = text.match(/用途:\s*(.*?)(?:\n|$)/);
  if (usageMatch && usageMatch[1]) {
    if (usageMatch[1].includes('手冲')) {
      bean.beanType = 'filter';
    } else if (usageMatch[1].includes('意式')) {
      bean.beanType = 'espresso';
    } else if (usageMatch[1].includes('全能')) {
      bean.beanType = 'omni';
    }
  }

  // 提取价格 - 改进价格提取逻辑
  const priceMatch = text.match(/价格:\s*(\d+(?:\.\d+)?)元(?:\/g)?/);
  if (priceMatch && priceMatch[1]) {
    bean.price = priceMatch[1];
  }

  // 提取养豆期
  const startDayMatch = text.match(/养豆期:\s*(\d+)天/);
  if (startDayMatch && startDayMatch[1]) {
    bean.startDay = parseInt(startDayMatch[1]);
  }

  // 提取赏味期
  const endDayMatch = text.match(/赏味期:\s*(\d+)天/);
  if (endDayMatch && endDayMatch[1]) {
    bean.endDay = parseInt(endDayMatch[1]);
  }

  // 提取风味
  const flavorMatch = text.match(/风味标签:\s*(.*?)(?:\n|$)/);
  if (flavorMatch && flavorMatch[1] && flavorMatch[1].trim() !== '') {
    bean.flavor = flavorMatch[1]
      .split(',')
      .map((f: string) => f.trim())
      .filter(f => f !== '');
  }

  // 提取备注（支持多行）
  if (text.includes('备注信息:')) {
    // 备注信息可能是多行的，获取备注信息部分直到下一个区域标识符
    const notesSection = text.split('备注信息:')[1];
    // 截取到 "---" 或文档结尾
    const endIndex = notesSection.indexOf('\n---');
    const noteContent =
      endIndex !== -1
        ? notesSection.substring(0, endIndex).trim()
        : notesSection.trim();
    bean.notes = noteContent;
  } else {
    // 兼容旧格式的单行备注
    const notesMatch = text.match(/备注:\s*(.*?)(?:\n|$)/);
    if (notesMatch && notesMatch[1]) {
      bean.notes = notesMatch[1].trim();
    }
  }

  // 提取拼配成分（如果有）
  if (text.includes('拼配成分:')) {
    bean.blendComponents = [];
    const blendSection = text.split('拼配成分:')[1];
    // 找到拼配成分部分的结束位置（下一个主要部分或文档结尾）
    const endIndex = Math.min(
      ...[
        blendSection.indexOf('\n风味标签:'),
        blendSection.indexOf('\n备注信息:'),
        blendSection.indexOf('\n备注:'),
        blendSection.indexOf('\n---'),
      ].filter(idx => idx !== -1)
    );

    const blendContent =
      endIndex !== Infinity
        ? blendSection.substring(0, endIndex)
        : blendSection.split('\n---')[0];

    const componentLines = blendContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    for (const line of componentLines) {
      // 尝试匹配有百分比的行，例如 "1. 50% 哥伦比亚 | 水洗 | 卡杜拉"
      const matchWithPercentage = line.match(/\d+\.\s*(\d+)%\s*(.*)/);
      // 尝试匹配没有百分比的行，例如 "1. 肯尼亚 | 日晒 | SL28"
      const matchWithoutPercentage = line.match(/\d+\.\s*(.*)/);

      if (matchWithPercentage) {
        // 处理有百分比的情况
        const percentage = matchWithPercentage[1];
        const detailsText = matchWithPercentage[2].trim();

        // 分割详情字段（以 | 分隔）
        const details = detailsText.split('|').map(part => part.trim());

        const component: BlendComponent = {
          percentage: parseInt(percentage, 10),
        };

        // 根据分割的详情字段数量分配到相应属性
        if (details.length >= 1 && details[0]) component.origin = details[0];
        if (details.length >= 2 && details[1]) component.process = details[1];
        if (details.length >= 3 && details[2]) component.variety = details[2];

        bean.blendComponents.push(component);
      } else if (matchWithoutPercentage) {
        // 处理没有百分比的情况
        const detailsText = matchWithoutPercentage[1].trim();

        // 分割详情字段（以 | 分隔）
        const details = detailsText.split('|').map(part => part.trim());

        const component: BlendComponent = {};

        // 根据分割的详情字段数量分配到相应属性
        if (details.length >= 1 && details[0]) component.origin = details[0];
        if (details.length >= 2 && details[1]) component.process = details[1];
        if (details.length >= 3 && details[2]) component.variety = details[2];

        bean.blendComponents.push(component);
      }
    }
  }

  return bean;
}

/**
 * 从自然语言文本中解析冲煮方案数据
 * 支持多种文本格式：
 * - v2 简洁格式：一行参数 + 简洁步骤
 * - 新格式：使用 (用时Xs) 表示阶段用时
 * - 旧格式：使用 (注水Xs) 表示注水时间
 *
 * @param text 冲煮方案的文本描述
 * @param customEquipment 自定义器具配置（可选）
 * @returns 结构化的冲煮方案数据
 */
function parseMethodText(
  text: string,
  customEquipment?: CustomEquipment
): Method | null {
  const method: Method = {
    id: `method-${Date.now()}`,
    name: '',
    params: {
      coffee: '',
      water: '',
      ratio: '',
      grindSize: '',
      temp: '',
      stages: [],
    },
  };

  // 提取名称
  const nameMatch = text.match(/【冲煮方案】(.*?)(?:\n|$)/);
  if (nameMatch && nameMatch[1]) {
    method.name = nameMatch[1].trim();
  }

  // 尝试解析 v2 简洁格式的参数行：15g | 1:15 | 中细 | 93°C
  const compactParamsMatch = text.match(
    /(\d+g)\s*\|\s*(1:\d+)\s*\|\s*([^|]+)\s*\|\s*(\d+°?C)/
  );
  if (compactParamsMatch) {
    method.params.coffee = compactParamsMatch[1].trim();
    method.params.ratio = compactParamsMatch[2].trim();
    method.params.grindSize = compactParamsMatch[3].trim();
    method.params.temp = compactParamsMatch[4].trim();
    // 根据比例计算水量
    const coffeeNum = parseInt(method.params.coffee);
    const ratioNum = parseInt(method.params.ratio.split(':')[1]);
    if (coffeeNum && ratioNum) {
      method.params.water = `${coffeeNum * ratioNum}g`;
    }
  } else {
    // 兼容旧格式：逐行提取参数
    const coffeeMatch = text.match(/咖啡粉量:\s*(.*?)(?:\n|$)/);
    if (coffeeMatch && coffeeMatch[1] && coffeeMatch[1] !== '未设置') {
      method.params.coffee = coffeeMatch[1].trim();
    }

    const waterMatch = text.match(/水量:\s*(.*?)(?:\n|$)/);
    if (waterMatch && waterMatch[1] && waterMatch[1] !== '未设置') {
      method.params.water = waterMatch[1].trim();
    }

    const ratioMatch = text.match(/(?:比例|粉水比):\s*(.*?)(?:\n|$)/);
    if (ratioMatch && ratioMatch[1] && ratioMatch[1] !== '未设置') {
      method.params.ratio = ratioMatch[1].trim();
    }

    const grindMatch = text.match(/研磨度:\s*(.*?)(?:\n|$)/);
    if (grindMatch && grindMatch[1] && grindMatch[1] !== '未设置') {
      method.params.grindSize = grindMatch[1].trim();
    }

    const tempMatch = text.match(/水温:\s*(.*?)(?:\n|$)/);
    if (tempMatch && tempMatch[1] && tempMatch[1] !== '未设置') {
      method.params.temp = tempMatch[1].trim();
    }
  }

  // 检查是否是意式咖啡方案 - 改进判断逻辑
  const isEspresso =
    text.includes('器具类型: 意式咖啡机') ||
    customEquipment?.animationType === 'espresso' ||
    text.includes('[萃取浓缩]') ||
    text.includes('[extraction]') ||
    text.includes('[beverage]');

  // 检测是否为新格式文本（包含 "用时" 而非 "注水"）
  const isNewFormat = text.includes('(用时') || text.includes('[等待]');

  // 尝试提取ID（如果有）
  const idMatch = text.match(/@METHOD_ID:(method-[a-zA-Z0-9-]+)@/);
  if (idMatch && idMatch[1]) {
    method.id = idMatch[1];
  }

  // 提取冲煮步骤 - 支持有无 "冲煮步骤:" 标题
  let stagesSection = '';
  if (text.includes('冲煮步骤:')) {
    stagesSection = text.split('冲煮步骤:')[1].split('@DATA_TYPE')[0];
  } else {
    // v2 简洁格式：直接从参数行后提取步骤（以数字开头的行）
    const lines = text.split('\n');
    const stageStartIndex = lines.findIndex(
      (line, idx) => idx > 0 && /^\d+\./.test(line.trim())
    );
    if (stageStartIndex > 0) {
      stagesSection = lines.slice(stageStartIndex).join('\n').split('@DATA_TYPE')[0];
    }
  }

  if (stagesSection) {
    const stageLines = stagesSection
      .split('\n')
      .filter(line => line.trim() !== '');

    // 用于旧格式转换的临时数组
    const legacyStages: LegacyStage[] = [];

    // 分组解析步骤和详细信息
    for (let i = 0; i < stageLines.length; i++) {
      const line = stageLines[i];
      // 如果是主步骤行
      if (line.match(/^\d+\./)) {
        // v2 简洁格式：1. [绕圈注水] 焖蒸注水 12″ 60g
        const v2Pattern =
          /^\d+\.\s*\[(.*?)\]\s*(.*?)\s+(\d+)[″"]\s+(\d+)g(?:\n|$)/;

        // v2 无水量格式（等待步骤）：1. [等待] 焖蒸等待 18″
        const v2NoWaterPattern = /^\d+\.\s*\[(.*?)\]\s*(.*?)\s+(\d+)[″"](?:\n|$)/;

        // v2 无时间格式（bypass/beverage）：1. [Bypass] 加水 50g
        const v2NoTimePattern = /^\d+\.\s*\[(.*?)\]\s*(.*?)\s+(\d+)g(?:\n|$)/;

        // 兼容旧 v2 格式：1. [绕圈注水] 焖蒸注水 60g 12秒
        const v2OldPattern =
          /^\d+\.\s*\[(.*?)\]\s*(.*?)\s+(\d+)g\s+(\d+)秒(?:\n|$)/;

        // 兼容旧 v2 无水量格式：1. [等待] 焖蒸等待 18秒
        const v2OldNoWaterPattern = /^\d+\.\s*\[(.*?)\]\s*(.*?)\s+(\d+)秒(?:\n|$)/;

        // 旧新格式匹配：1. (用时10秒) [绕圈注水] 焖蒸 - 30g
        const oldNewFormatPattern =
          /^\d+\.\s*(?:\[(\d+)分(\d+)秒\])?\s*(?:\(用时(\d+)秒\))?\s*(?:\[(.*?)\])?\s*(.*?)\s*(?:-\s*(.*?))?(?:\n|$)/;

        // 旧格式匹配：1. [0分25秒] (注水10秒) [绕圈注水] 焖蒸 - 30g
        const legacyFormatPattern =
          /^\d+\.\s*\[(\d+)分(\d+)秒\](?:\s*\(注水(\d+)秒\))?(?:\s*\[(.*?)\])?\s*(.*?)\s*-\s*(.*?)(?:\n|$)/;

        // 匹配不带时间的格式：1. [饮料] 加入牛奶 - 120g
        const noTimePattern = /^\d+\.\s*\[(.*?)\]\s*(.*?)\s*-\s*(.*?)(?:\n|$)/;

        // 先尝试 v2 格式（新：时间在前用″）
        let v2Match = line.match(v2Pattern);
        if (v2Match) {
          const pourTypeText = v2Match[1].trim();
          const label = v2Match[2].trim();
          const duration = parseInt(v2Match[3]);
          const water = v2Match[4];

          const stage: ParsedStage = {
            label,
            water,
            duration,
            detail: '',
            pourType: mapPourTypeName(pourTypeText, customEquipment),
          };

          // 检查下一行是否是详细信息
          if (i + 1 < stageLines.length && stageLines[i + 1].startsWith('   ')) {
            stage.detail = stageLines[i + 1].trim();
            i++;
          }

          method.params.stages.push(stage as Stage);
          continue;
        }

        // 兼容旧 v2 格式（水量在前）：1. [绕圈注水] 焖蒸注水 60g 12秒
        const v2OldMatch = line.match(v2OldPattern);
        if (v2OldMatch) {
          const pourTypeText = v2OldMatch[1].trim();
          const label = v2OldMatch[2].trim();
          const water = v2OldMatch[3];
          const duration = parseInt(v2OldMatch[4]);

          const stage: ParsedStage = {
            label,
            water,
            duration,
            detail: '',
            pourType: mapPourTypeName(pourTypeText, customEquipment),
          };

          if (i + 1 < stageLines.length && stageLines[i + 1].startsWith('   ')) {
            stage.detail = stageLines[i + 1].trim();
            i++;
          }

          method.params.stages.push(stage as Stage);
          continue;
        }

        // v2 无水量格式（等待步骤）
        const v2NoWaterMatch = line.match(v2NoWaterPattern);
        // 兼容旧格式
        const v2OldNoWaterMatch = !v2NoWaterMatch ? line.match(v2OldNoWaterPattern) : null;
        const noWaterMatch = v2NoWaterMatch || v2OldNoWaterMatch;
        if (noWaterMatch) {
          const pourTypeText = noWaterMatch[1].trim();
          const label = noWaterMatch[2].trim();
          const duration = parseInt(noWaterMatch[3]);

          const stage: ParsedStage = {
            label,
            duration,
            detail: '',
            pourType: mapPourTypeName(pourTypeText, customEquipment),
          };

          if (i + 1 < stageLines.length && stageLines[i + 1].startsWith('   ')) {
            stage.detail = stageLines[i + 1].trim();
            i++;
          }

          method.params.stages.push(stage as Stage);
          continue;
        }

        // v2 无时间格式（bypass/beverage）
        const v2NoTimeMatch = line.match(v2NoTimePattern);
        if (v2NoTimeMatch) {
          const pourTypeText = v2NoTimeMatch[1].trim();
          const label = v2NoTimeMatch[2].trim();
          const water = v2NoTimeMatch[3];

          const stage: ParsedStage = {
            label,
            water,
            detail: '',
            pourType: mapPourTypeName(pourTypeText, customEquipment),
          };

          if (i + 1 < stageLines.length && stageLines[i + 1].startsWith('   ')) {
            stage.detail = stageLines[i + 1].trim();
            i++;
          }

          method.params.stages.push(stage as Stage);
          continue;
        }

        if (isNewFormat) {
          // 解析旧新格式
          const newMatch = line.match(oldNewFormatPattern);
          if (newMatch) {
            const pourTypeText = newMatch[4] || '';
            const label = (newMatch[5] || '').trim();
            const water = (newMatch[6] || '').trim().replace(/g$/, '');
            const duration = newMatch[3] ? parseInt(newMatch[3]) : 0;

            // 创建新格式步骤对象
            const stage: ParsedStage = {
              label,
              detail: '',
            };

            // 处理 water
            if (water) {
              stage.water = water;
            }

            // 处理 duration
            if (duration > 0) {
              stage.duration = duration;
            }

            // 处理pourType
            if (pourTypeText) {
              stage.pourType = mapPourTypeName(pourTypeText, customEquipment);
            } else {
              stage.pourType = 'circle'; // 默认
            }

            // 检查下一行是否是详细信息（以空格开头）
            if (
              i + 1 < stageLines.length &&
              stageLines[i + 1].startsWith('   ')
            ) {
              stage.detail = stageLines[i + 1].trim();
              i++; // 跳过详细信息行
            }

            // 添加到步骤列表
            method.params.stages.push(stage as Stage);
          } else {
            // 尝试匹配不带时间的模式
            const noTimeMatch = line.match(noTimePattern);
            if (noTimeMatch) {
              const pourTypeText = noTimeMatch[1].trim();
              const label = noTimeMatch[2].trim();
              const water = noTimeMatch[3].trim().replace(/g$/, '');

              const stage: ParsedStage = {
                label,
                detail: '',
                pourType: mapPourTypeName(pourTypeText, customEquipment),
              };

              if (water) {
                stage.water = water;
              }

              // 检查下一行是否是详细信息
              if (
                i + 1 < stageLines.length &&
                stageLines[i + 1].startsWith('   ')
              ) {
                stage.detail = stageLines[i + 1].trim();
                i++;
              }

              method.params.stages.push(stage as Stage);
            }
          }
        } else {
          // 解析旧格式
          const legacyMatch = line.match(legacyFormatPattern);
          if (legacyMatch) {
            const minutes = parseInt(legacyMatch[1]);
            const seconds = parseInt(legacyMatch[2]);
            const time = minutes * 60 + seconds;
            const pourTime = legacyMatch[3]
              ? parseInt(legacyMatch[3])
              : Math.min(20, Math.ceil(time * 0.25));
            const pourTypeText = legacyMatch[4] || '';
            const label = legacyMatch[5].trim();
            const water = legacyMatch[6].trim();

            // 创建旧格式步骤对象
            const legacyStage: LegacyStage = {
              time,
              pourTime: isEspresso ? undefined : pourTime,
              label,
              water,
              detail: '',
            };

            // 处理pourType
            if (pourTypeText) {
              if (pourTypeText === '萃取浓缩') {
                legacyStage.pourType = 'extraction';
              } else if (pourTypeText === '饮料') {
                legacyStage.pourType = 'beverage';
                legacyStage.time = 0;
              } else if (pourTypeText === '中心注水') {
                legacyStage.pourType = 'center';
              } else if (pourTypeText === '绕圈注水') {
                legacyStage.pourType = 'circle';
              } else if (pourTypeText === '添加冰块') {
                legacyStage.pourType = 'ice';
              } else {
                legacyStage.pourType = findCustomPourTypeIdByName(
                  pourTypeText,
                  customEquipment
                );
              }
            }

            // 检查下一行是否是详细信息
            if (
              i + 1 < stageLines.length &&
              stageLines[i + 1].startsWith('   ')
            ) {
              legacyStage.detail = stageLines[i + 1].trim();
              i++;
            }

            legacyStages.push(legacyStage);
          } else {
            // 尝试匹配不带时间的模式（主要用于意式咖啡的饮料步骤）
            const noTimeMatch = line.match(noTimePattern);
            if (noTimeMatch && isEspresso) {
              const pourTypeText = noTimeMatch[1].trim();
              const label = noTimeMatch[2].trim();
              const water = noTimeMatch[3].trim();

              const legacyStage: LegacyStage = {
                time: 0,
                label,
                water,
                detail: '',
              };

              if (pourTypeText === '饮料') {
                legacyStage.pourType = 'beverage';
              } else if (pourTypeText === '萃取浓缩') {
                legacyStage.pourType = 'extraction';
              } else {
                legacyStage.pourType = findCustomPourTypeIdByName(
                  pourTypeText,
                  customEquipment
                );
              }

              // 检查下一行是否是详细信息
              if (
                i + 1 < stageLines.length &&
                stageLines[i + 1].startsWith('   ')
              ) {
                legacyStage.detail = stageLines[i + 1].trim();
                i++;
              }

              legacyStages.push(legacyStage);
            }
          }
        }
      }
    }

    // 如果是旧格式，使用迁移服务转换
    if (!isNewFormat && legacyStages.length > 0) {
      method.params.stages = migrateStages(legacyStages);
    }
  }

  return method;
}

/**
 * 从自然语言文本中解析冲煮记录数据
 * @param text 冲煮记录的文本描述
 * @returns 结构化的冲煮记录数据
 */
function parseBrewingNoteText(text: string): BrewingNote | null {
  const note: BrewingNote = {
    id: `note-${Date.now()}`,
    beanId: '',
    methodId: '',
    methodName: '',
    equipment: '',
    date: '',
    params: {
      coffee: '',
      water: '',
      ratio: '',
      grindSize: '',
      temp: '',
    },
    rating: 0,
    notes: '',
    taste: {
      acidity: 0,
      sweetness: 0,
      bitterness: 0,
      body: 0,
    },
    timestamp: Date.now(),
  };

  // 提取设备
  const equipmentMatch = text.match(/设备:\s*(.*?)(?:\n|$)/);
  if (equipmentMatch && equipmentMatch[1] && equipmentMatch[1] !== '未设置') {
    note.equipment = equipmentMatch[1].trim();
  }

  // 提取方法
  const methodMatch = text.match(/方法:\s*(.*?)(?:\n|$)/);
  if (methodMatch && methodMatch[1] && methodMatch[1] !== '未设置') {
    note.methodName = methodMatch[1].trim();
  }

  // 提取咖啡豆信息
  const beanMatch = text.match(/咖啡豆:\s*(.*?)(?:\n|$)/);
  if (beanMatch && beanMatch[1] && beanMatch[1] !== '未设置') {
    note.beanId = beanMatch[1].trim();
  }

  // 提取参数
  if (text.includes('参数设置:')) {
    const coffeeMatch = text.match(/咖啡粉量:\s*(.*?)(?:\n|$)/);
    if (coffeeMatch && coffeeMatch[1] && coffeeMatch[1] !== '未设置') {
      note.params.coffee = coffeeMatch[1].trim();
    }

    const waterMatch = text.match(/水量:\s*(.*?)(?:\n|$)/);
    if (waterMatch && waterMatch[1] && waterMatch[1] !== '未设置') {
      note.params.water = waterMatch[1].trim();
    }

    const ratioMatch = text.match(/比例:\s*(.*?)(?:\n|$)/);
    if (ratioMatch && ratioMatch[1] && ratioMatch[1] !== '未设置') {
      note.params.ratio = ratioMatch[1].trim();
    }

    const grindMatch = text.match(/研磨度:\s*(.*?)(?:\n|$)/);
    if (grindMatch && grindMatch[1] && grindMatch[1] !== '未设置') {
      note.params.grindSize = grindMatch[1].trim();
    }

    const tempMatch = text.match(/水温:\s*(.*?)(?:\n|$)/);
    if (tempMatch && tempMatch[1] && tempMatch[1] !== '未设置') {
      note.params.temp = tempMatch[1].trim();
    }
  }

  // 提取风味评分
  if (text.includes('风味评分:')) {
    const acidityMatch = text.match(/酸度:\s*(\d+)\/5/);
    if (acidityMatch && acidityMatch[1]) {
      note.taste.acidity = parseInt(acidityMatch[1]);
    }

    const sweetnessMatch = text.match(/甜度:\s*(\d+)\/5/);
    if (sweetnessMatch && sweetnessMatch[1]) {
      note.taste.sweetness = parseInt(sweetnessMatch[1]);
    }

    const bitternessMatch = text.match(/苦度:\s*(\d+)\/5/);
    if (bitternessMatch && bitternessMatch[1]) {
      note.taste.bitterness = parseInt(bitternessMatch[1]);
    }

    const bodyMatch = text.match(/醇厚度:\s*(\d+)\/5/);
    if (bodyMatch && bodyMatch[1]) {
      note.taste.body = parseInt(bodyMatch[1]);
    }
  }

  // 提取综合评分
  const ratingMatch = text.match(/综合评分:\s*(\d+)\/5/);
  if (ratingMatch && ratingMatch[1]) {
    note.rating = parseInt(ratingMatch[1]);
  }

  // 提取笔记
  if (text.includes('笔记:')) {
    const notesSection = text.split('笔记:')[1].split('\n---')[0];
    note.notes = notesSection.trim();
  }

  return note;
}
