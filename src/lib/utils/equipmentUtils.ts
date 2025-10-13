import { CustomEquipment, equipmentList } from '@/lib/core/config';

/**
 * 根据器具ID获取器具名称（统一查找逻辑）
 * @param equipmentId 器具ID
 * @param customEquipments 自定义器具列表
 * @returns 器具名称，如果找不到则返回ID本身
 */
export const getEquipmentNameById = (
  equipmentId: string | null | undefined, 
  customEquipments: CustomEquipment[] = []
): string => {
  if (!equipmentId) return '';
  
  // 首先在系统器具中查找
  const systemEquipment = equipmentList.find(eq => eq.id === equipmentId);
  if (systemEquipment) {
    return systemEquipment.name;
  }
  
  // 然后在自定义器具中查找
  const customEquipment = customEquipments.find(eq => eq.id === equipmentId);
  if (customEquipment) {
    return customEquipment.name;
  }
  
  // 如果都找不到，返回ID本身（向后兼容旧数据）
  return equipmentId;
};

/**
 * 根据器具名称获取器具ID（反向查找）
 * @param equipmentName 器具名称
 * @param customEquipments 自定义器具列表
 * @returns 器具ID，如果找不到则返回名称本身
 */
export const getEquipmentIdByName = (
  equipmentName: string | null | undefined,
  customEquipments: CustomEquipment[] = []
): string => {
  if (!equipmentName) return '';
  
  // 首先在系统器具中查找
  const systemEquipment = equipmentList.find(eq => eq.name === equipmentName);
  if (systemEquipment) {
    return systemEquipment.id;
  }
  
  // 然后在自定义器具中查找
  const customEquipment = customEquipments.find(eq => eq.name === equipmentName);
  if (customEquipment) {
    return customEquipment.id;
  }
  
  // 如果都找不到，返回名称本身（向后兼容）
  return equipmentName;
};

/**
 * 获取器具对象（完整信息）
 * @param equipmentId 器具ID
 * @param customEquipments 自定义器具列表
 * @returns 器具对象或null
 */
export const getEquipmentById = (
  equipmentId: string | null | undefined,
  customEquipments: CustomEquipment[] = []
): (typeof equipmentList[0] | CustomEquipment) | null => {
  if (!equipmentId) return null;
  
  // 首先在系统器具中查找
  const systemEquipment = equipmentList.find(eq => eq.id === equipmentId);
  if (systemEquipment) {
    return systemEquipment;
  }
  
  // 然后在自定义器具中查找
  const customEquipment = customEquipments.find(eq => eq.id === equipmentId);
  if (customEquipment) {
    return customEquipment;
  }
  
  return null;
};

/**
 * 判断是否是意式机
 * @param customEquipment 自定义设备对象
 * @returns 是否为意式机
 */
export const isEspressoMachine = (customEquipment: CustomEquipment): boolean => {
  return customEquipment.animationType === 'espresso';
};

/**
 * 获取注水方式的显示名称
 * @param pourType 注水类型
 * @returns 注水方式的中文名称
 */
export const getPourTypeName = (pourType?: string): string => {
  if (!pourType) return '请选择注水方式';
  
  switch (pourType) {
    case 'extraction':
      return '萃取浓缩';
    case 'beverage':
      return '饮料';
    case 'other':
      return '其他';
    case 'center':
      return '中心注水';
    case 'circle':
      return '绕圈注水';
    case 'ice':
      return '添加冰块';
    case 'bypass':
      return 'Bypass';
    default:
      return pourType;
  }
};

/**
 * 判断设备是否有阀门
 * @param customEquipment 自定义设备对象
 * @returns 是否有阀门
 */
export const hasValve = (customEquipment: CustomEquipment): boolean => {
  return !!customEquipment.hasValve;
};

/**
 * 获取设备的默认注水方式
 * @param customEquipment 自定义设备对象
 * @returns 默认的注水方式
 */
export const getDefaultPourType = (customEquipment: CustomEquipment): string => {
  // 根据器具类型返回默认注水方式
  switch (customEquipment.animationType) {
    case 'espresso':
      return 'extraction'; // 意式机默认使用萃取浓缩模式
    case 'v60':
    case 'origami':
      return 'circle'; // V60和Origami默认使用绕圈注水
    case 'kalita':
      return 'center'; // Kalita默认使用中心注水
    case 'clever':
      return 'circle'; // 聪明杯默认使用绕圈注水
    case 'custom':
  // 如果是自定义预设并且有自定义注水动画
      if (customEquipment.customPourAnimations && 
      customEquipment.customPourAnimations.length > 0) {
    
    // 先找系统默认的动画
    const defaultAnimation = customEquipment.customPourAnimations.find(
      anim => anim.isSystemDefault && anim.pourType
    );
    
    if (defaultAnimation && defaultAnimation.pourType) {
      return defaultAnimation.pourType;
    }
    
    // 没有系统默认动画就用第一个动画
    const firstAnimation = customEquipment.customPourAnimations[0];
    if (firstAnimation.pourType) {
      return firstAnimation.pourType;
    }
    
    return firstAnimation.id;
  }
      // 如果没有自定义注水动画，默认使用绕圈注水
      return 'circle';
    default:
      return 'circle';
  }
};

/**
 * 🔥 兼容性比较：判断两个器具标识是否指向同一个器具
 * 这个函数可以比较器具ID和器具名称，实现向后兼容
 * 
 * @param equipment1 器具标识1（可以是ID或名称）
 * @param equipment2 器具标识2（可以是ID或名称）
 * @param customEquipments 自定义器具列表
 * @returns 是否是同一个器具
 * 
 * @example
 * // 可以比较ID和名称
 * isSameEquipment('custom-v60-1758387226603-3si62s2', '山文62', customEquipments) // true
 * // 也可以比较两个ID
 * isSameEquipment('custom-v60-1758387226603-3si62s2', 'custom-v60-1758387226603-3si62s2', customEquipments) // true
 * // 或两个名称
 * isSameEquipment('山文62', '山文62', customEquipments) // true
 */
export const isSameEquipment = (
  equipment1: string | null | undefined,
  equipment2: string | null | undefined,
  customEquipments: CustomEquipment[] = []
): boolean => {
  if (!equipment1 || !equipment2) return equipment1 === equipment2;
  
  // 如果直接相等，返回true
  if (equipment1 === equipment2) return true;
  
  // 获取两个器具的规范化ID（名称会被转为ID，ID保持不变）
  const id1 = getEquipmentIdByName(equipment1, customEquipments);
  const id2 = getEquipmentIdByName(equipment2, customEquipments);
  
  // 比较规范化后的ID
  if (id1 === id2) return true;
  
  // 获取两个器具的名称（ID会被转为名称，名称保持不变）
  const name1 = getEquipmentNameById(equipment1, customEquipments);
  const name2 = getEquipmentNameById(equipment2, customEquipments);
  
  // 比较规范化后的名称
  return name1 === name2;
}; 