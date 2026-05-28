export interface EquipmentDisplayNameSource {
  name: string;
  isCustom?: boolean;
}

export const CUSTOM_EQUIPMENT_DISPLAY_LABEL = '自定义';
export const CUSTOM_EQUIPMENT_DISPLAY_SUFFIX = ` - ${CUSTOM_EQUIPMENT_DISPLAY_LABEL}`;

export function getEquipmentDisplayParts(
  equipment: EquipmentDisplayNameSource
): {
  name: string;
  customSuffix: string | null;
} {
  if (!equipment.isCustom) {
    return {
      name: equipment.name,
      customSuffix: null,
    };
  }

  return {
    name: equipment.name.endsWith(CUSTOM_EQUIPMENT_DISPLAY_SUFFIX)
      ? equipment.name.slice(0, -CUSTOM_EQUIPMENT_DISPLAY_SUFFIX.length)
      : equipment.name,
    customSuffix: `- ${CUSTOM_EQUIPMENT_DISPLAY_LABEL}`,
  };
}

export function getEquipmentDisplayName(
  equipment: EquipmentDisplayNameSource
): string {
  const { name, customSuffix } = getEquipmentDisplayParts(equipment);

  return customSuffix ? `${name} ${customSuffix}` : name;
}
