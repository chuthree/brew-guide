/**
 * 咖啡豆二维码工具
 * 用于序列化/反序列化咖啡豆数据，生成紧凑的二维码格式
 */

import { CoffeeBean } from '@/types/app';

// 二维码数据版本号，用于未来的兼容性
const QR_VERSION = '1';

// 字段映射表 - 使用简短的键名减少数据量
const FIELD_MAP = {
  name: 'n',
  capacity: 'c',
  remaining: 'r',
  roastLevel: 'rl',
  roastDate: 'rd',
  flavor: 'f',
  blendComponents: 'bc',
  price: 'p',
  beanType: 'bt',
  notes: 'nt',
  startDay: 'sd',
  endDay: 'ed',
  isFrozen: 'if',
  isInTransit: 'it',
  overallRating: 'or',
  ratingNotes: 'rn',
} as const;

/**
 * 将咖啡豆数据序列化为紧凑的JSON格式
 */
export function serializeBeanForQRCode(bean: CoffeeBean): string {
  // 创建一个压缩的对象
  const compressed: Record<string, unknown> = {
    v: QR_VERSION, // 版本号
  };

  // 只包含有值的字段
  if (bean.name) compressed[FIELD_MAP.name] = bean.name;
  if (bean.capacity) compressed[FIELD_MAP.capacity] = bean.capacity;
  if (bean.remaining) compressed[FIELD_MAP.remaining] = bean.remaining;
  if (bean.roastLevel) compressed[FIELD_MAP.roastLevel] = bean.roastLevel;
  if (bean.roastDate) compressed[FIELD_MAP.roastDate] = bean.roastDate;
  if (bean.flavor && bean.flavor.length > 0)
    compressed[FIELD_MAP.flavor] = bean.flavor;
  if (bean.blendComponents && bean.blendComponents.length > 0) {
    // 压缩 blendComponents
    compressed[FIELD_MAP.blendComponents] = bean.blendComponents.map(comp => ({
      o: comp.origin,
      p: comp.process,
      v: comp.variety,
      pc: comp.percentage,
    }));
  }
  if (bean.price) compressed[FIELD_MAP.price] = bean.price;
  if (bean.beanType) compressed[FIELD_MAP.beanType] = bean.beanType;
  if (bean.notes) compressed[FIELD_MAP.notes] = bean.notes;
  if (bean.startDay !== undefined)
    compressed[FIELD_MAP.startDay] = bean.startDay;
  if (bean.endDay !== undefined) compressed[FIELD_MAP.endDay] = bean.endDay;
  if (bean.isFrozen) compressed[FIELD_MAP.isFrozen] = bean.isFrozen;
  if (bean.isInTransit) compressed[FIELD_MAP.isInTransit] = bean.isInTransit;
  if (bean.overallRating)
    compressed[FIELD_MAP.overallRating] = bean.overallRating;
  if (bean.ratingNotes) compressed[FIELD_MAP.ratingNotes] = bean.ratingNotes;

  // 转换为JSON并添加前缀标识
  return 'BEAN:' + JSON.stringify(compressed);
}

/**
 * 从二维码数据反序列化为咖啡豆对象
 */
export function deserializeBeanFromQRCode(
  qrData: string
): Partial<CoffeeBean> | null {
  try {
    // 检查是否有正确的前缀
    if (!qrData.startsWith('BEAN:')) {
      return null;
    }

    // 移除前缀并解析JSON
    const jsonData = qrData.substring(5);
    const compressed = JSON.parse(jsonData) as Record<string, unknown>;

    // 检查版本号
    if (compressed.v !== QR_VERSION) {
      console.warn('QR Code version mismatch, attempting to parse anyway');
    }

    // 解压数据
    const bean: Partial<CoffeeBean> = {};

    if (compressed[FIELD_MAP.name])
      bean.name = compressed[FIELD_MAP.name] as string;
    if (compressed[FIELD_MAP.capacity])
      bean.capacity = compressed[FIELD_MAP.capacity] as string;
    if (compressed[FIELD_MAP.remaining])
      bean.remaining = compressed[FIELD_MAP.remaining] as string;
    if (compressed[FIELD_MAP.roastLevel])
      bean.roastLevel = compressed[FIELD_MAP.roastLevel] as string;
    if (compressed[FIELD_MAP.roastDate])
      bean.roastDate = compressed[FIELD_MAP.roastDate] as string;
    if (compressed[FIELD_MAP.flavor])
      bean.flavor = compressed[FIELD_MAP.flavor] as string[];
    if (compressed[FIELD_MAP.blendComponents]) {
      // 解压 blendComponents
      bean.blendComponents = (
        compressed[FIELD_MAP.blendComponents] as Array<{
          o?: string;
          p?: string;
          v?: string;
          pc?: number;
        }>
      ).map(comp => ({
        origin: comp.o,
        process: comp.p,
        variety: comp.v,
        percentage: comp.pc,
      }));
    }
    if (compressed[FIELD_MAP.price])
      bean.price = compressed[FIELD_MAP.price] as string;
    if (compressed[FIELD_MAP.beanType])
      bean.beanType = compressed[FIELD_MAP.beanType] as 'espresso' | 'filter';
    if (compressed[FIELD_MAP.notes])
      bean.notes = compressed[FIELD_MAP.notes] as string;
    if (compressed[FIELD_MAP.startDay] !== undefined)
      bean.startDay = compressed[FIELD_MAP.startDay] as number;
    if (compressed[FIELD_MAP.endDay] !== undefined)
      bean.endDay = compressed[FIELD_MAP.endDay] as number;
    if (compressed[FIELD_MAP.isFrozen])
      bean.isFrozen = compressed[FIELD_MAP.isFrozen] as boolean;
    if (compressed[FIELD_MAP.isInTransit])
      bean.isInTransit = compressed[FIELD_MAP.isInTransit] as boolean;
    if (compressed[FIELD_MAP.overallRating])
      bean.overallRating = compressed[FIELD_MAP.overallRating] as number;
    if (compressed[FIELD_MAP.ratingNotes])
      bean.ratingNotes = compressed[FIELD_MAP.ratingNotes] as string;

    return bean;
  } catch (error) {
    console.error('Failed to deserialize QR code data:', error);
    return null;
  }
}

/**
 * 估算二维码数据大小（字节）
 */
export function estimateQRCodeSize(bean: CoffeeBean): number {
  const serialized = serializeBeanForQRCode(bean);
  return new Blob([serialized]).size;
}

/**
 * 验证二维码数据是否为有效的咖啡豆数据
 */
export function isValidBeanQRCode(qrData: string): boolean {
  return (
    qrData.startsWith('BEAN:') && deserializeBeanFromQRCode(qrData) !== null
  );
}
