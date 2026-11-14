import { CustomEquipment, equipmentList } from '@/lib/core/config';
import { getSettingsStore } from '@/lib/stores/settingsStore';

type PourTypeOption = {
  value: string;
  label: string;
};

const POUR_TYPE_LABELS: Record<string, string> = {
  extraction: '萃取浓缩',
  beverage: '饮料',
  other: '其他',
  center: '中心注水',
  circle: '绕圈注水',
  ice: '添加冰块',
  bypass: 'Bypass',
  wait: '等待',
};

const ESPRESSO_POUR_TYPES = ['extraction', 'beverage', 'other'] as const;
const REGULAR_SYSTEM_POUR_TYPES = [
  'center',
  'circle',
  'ice',
  'bypass',
] as const;

const toPourTypeOption = (pourType: string): PourTypeOption => ({
  value: pourType,
  label: getPourTypeName(pourType),
});

const appendPourTypeOption = (
  options: PourTypeOption[],
  option: PourTypeOption
) => {
  if (!option.value || options.some(item => item.value === option.value)) {
    return;
  }

  options.push(option);
};

const getEquipmentNameOverrides = (): Record<string, string> =>
  getSettingsStore().settings.equipmentNameOverrides || {};

const getSystemEquipmentName = (
  equipment: (typeof equipmentList)[number]
): string =>
  getEquipmentNameOverrides()[equipment.id]?.trim() || equipment.name;

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
    return getSystemEquipmentName(systemEquipment);
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
  const systemEquipment = equipmentList.find(
    eq =>
      getSystemEquipmentName(eq) === equipmentName || eq.name === equipmentName
  );
  if (systemEquipment) {
    return systemEquipment.id;
  }

  // 然后在自定义器具中查找
  const customEquipment = customEquipments.find(
    eq => eq.name === equipmentName
  );
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
): ((typeof equipmentList)[0] | CustomEquipment) | null => {
  if (!equipmentId) return null;

  // 首先在系统器具中查找
  const systemEquipment = equipmentList.find(eq => eq.id === equipmentId);
  if (systemEquipment) {
    return {
      ...systemEquipment,
      name: getSystemEquipmentName(systemEquipment),
    };
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
export const isEspressoMachine = (
  customEquipment: CustomEquipment
): boolean => {
  return customEquipment.animationType === 'espresso';
};

/**
 * 获取注水方式的显示名称
 * @param pourType 注水类型
 * @returns 注水方式的中文名称
 */
export const getPourTypeName = (pourType?: string): string => {
  if (!pourType) return '请选择注水方式';

  return POUR_TYPE_LABELS[pourType] || pourType;
};

export const getPourTypeOptions = (
  customEquipment: CustomEquipment
): PourTypeOption[] => {
  if (isEspressoMachine(customEquipment)) {
    return ESPRESSO_POUR_TYPES.map(toPourTypeOption);
  }

  const options: PourTypeOption[] = [];
  if (customEquipment.animationType === 'custom') {
    for (const animation of customEquipment.customPourAnimations || []) {
      if (!animation.isSystemDefault) {
        appendPourTypeOption(options, {
          value: animation.id,
          label: animation.name,
        });
      }
    }
  } else {
    for (const pourType of REGULAR_SYSTEM_POUR_TYPES) {
      appendPourTypeOption(options, toPourTypeOption(pourType));
    }
  }

  appendPourTypeOption(options, toPourTypeOption('wait'));
  appendPourTypeOption(options, toPourTypeOption('other'));

  return options;
};

export const isPourTypeAvailable = (
  customEquipment: CustomEquipment,
  pourType?: string
): boolean => {
  if (!pourType) return false;

  return getPourTypeOptions(customEquipment).some(
    option => option.value === pourType
  );
};

/**
 * 获取设备的默认注水方式
 * @param customEquipment 自定义设备对象
 * @returns 默认的注水方式
 */
export const getDefaultPourType = (
  customEquipment: CustomEquipment
): string => {
  const customPourAnimations = customEquipment.customPourAnimations || [];

  // 根据器具类型返回默认注水方式
  switch (customEquipment.animationType) {
    case 'espresso':
      return 'extraction'; // 意式机默认使用萃取浓缩模式
    case 'v60':
    case 'origami':
    case 'orea':
    case 'sinloy':
    case 'kalita':
    case 'clever':
      return 'circle'; // 手冲器具默认使用绕圈注水
    case 'custom':
      return (
        customPourAnimations.find(animation => !animation.isSystemDefault)
          ?.id || 'other'
      );
    default:
      return 'circle';
  }
};
