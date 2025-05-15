import { CustomEquipment } from '@/lib/core/config';

/**
 * 判断是否是意式机
 * @param customEquipment 自定义设备对象
 * @returns 是否为意式机
 */
export const isEspressoMachine = (customEquipment: CustomEquipment): boolean => {
  return customEquipment.animationType === 'espresso';
};

/**
 * 获取意式机注水方式的显示名称
 * @param pourType 注水类型
 * @returns 注水方式的中文名称
 */
export const getEspressoPourTypeName = (pourType?: string): string => {
  if (!pourType) return '请选择注水方式';
  
  switch (pourType) {
    case 'extraction':
      return '萃取';
    case 'beverage':
      return '饮料';
    case 'other':
      return '其他';
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
  if (isEspressoMachine(customEquipment)) {
    return 'extraction';
  }

  // 如果是自定义预设并且有自定义注水动画
  if (customEquipment.animationType === 'custom' && 
      customEquipment.customPourAnimations && 
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
  
  // 根据器具类型返回默认注水方式
  switch (customEquipment.animationType) {
    case 'v60':
    case 'origami':
      return 'circle'; // V60和Origami默认使用绕圈注水
    case 'kalita':
      return 'center'; // Kalita默认使用中心注水
    case 'clever':
      return 'circle'; // 聪明杯默认使用绕圈注水
    default:
      return 'circle';
  }
}; 