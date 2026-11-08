import type { AppSettings } from '@/lib/data/models';

/** Allowlisted display settings only; never expose unrelated settings or credentials. */
export function projectCatalogPreferences(settings?: AppSettings) {
  return {
    hiddenEquipments: settings?.hiddenEquipments || [],
    hiddenCommonMethods: settings?.hiddenCommonMethods || {},
    equipmentOrder: settings?.equipmentOrder || [],
    equipmentNameOverrides: settings?.equipmentNameOverrides || {},
  };
}
