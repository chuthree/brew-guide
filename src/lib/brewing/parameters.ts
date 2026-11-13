import type {
  Method,
  MethodParams,
  BrewingNoteParams,
} from '@/lib/core/config';
import { normalizeBrewingNoteParams } from '@/lib/notes/noteDisplay';

interface EquipmentItem {
  id: string;
  name: string;
}

/**
 * 获取设备名称
 * @param equipmentId 设备ID
 * @param equipmentList 设备列表
 * @param customEquipments 自定义器具列表（可选）
 * @returns 设备名称
 */
export const getEquipmentName = (
  equipmentId: string | null,
  equipmentList: EquipmentItem[],
  customEquipments: EquipmentItem[] = []
): string | null => {
  if (!equipmentId) return null;

  // 首先在系统预设器具中查找
  const standardEquipment = equipmentList.find(e => e.id === equipmentId);
  if (standardEquipment) return standardEquipment.name;

  // 如果没找到，再在自定义器具中查找
  const customEquipment = customEquipments.find(e => e.id === equipmentId);
  if (customEquipment) return customEquipment.name;

  // 如果都没找到，则返回ID本身
  return equipmentId;
};

export type BrewingParameter =
  | 'coffee'
  | 'water'
  | 'ratio'
  | 'grindSize'
  | 'temp'
  | 'time';

export const isEspressoMethod = (method: Method): boolean =>
  method.params.stages.some(
    stage => stage.pourType === 'extraction' || stage.pourType === 'beverage'
  );

/** Recipes carry note defaults; a running brew owns its values in the stages. */
export const createBrewingMethod = (method: Method): Method => {
  const { extractionTime, liquidWeight, ...params } = method.params;
  const extractionIndex = params.stages.findIndex(
    stage => stage.pourType === 'extraction'
  );
  return {
    ...method,
    params: {
      ...params,
      stages: params.stages.map((stage, index) =>
        index === extractionIndex
          ? {
              ...stage,
              duration: extractionTime ?? stage.duration,
              water: liquidWeight ?? stage.water,
            }
          : stage
      ),
    },
  };
};

/** The navbar and saved note read the same snapshot of the running brew. */
export const getBrewingNoteParams = (method: Method): BrewingNoteParams => {
  const params = normalizeBrewingNoteParams(method.params) || {};
  const extraction = method.params.stages.find(
    stage => stage.pourType === 'extraction'
  );
  if (!extraction) return params;
  const water = extraction.water?.replace(/g$/i, '') || '';
  return {
    ...params,
    extractionTime: extraction.duration,
    liquidWeight: water ? `${water}g` : '',
  };
};

export const updateBrewingParameter = (
  method: Method,
  key: BrewingParameter,
  value: string,
  recipe: Method
): Method => {
  const params = method.params;
  if (key === 'grindSize') {
    return { ...method, params: { ...params, grindSize: value } };
  }
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number) || (key === 'time' ? number < 0 : number <= 0))
    return method;
  if (key === 'temp') {
    return { ...method, params: { ...params, temp: `${number}°C` } };
  }
  const extractionIndex = params.stages.findIndex(
    stage => stage.pourType === 'extraction'
  );
  if (key === 'time') {
    if (extractionIndex < 0) return method;
    return {
      ...method,
      params: {
        ...params,
        stages: params.stages.map((stage, index) =>
          index === extractionIndex ? { ...stage, duration: number } : stage
        ),
      },
    };
  }
  const coffee = key === 'coffee' ? number : Number.parseFloat(params.coffee);
  const ratio =
    key === 'ratio' ? number : Number.parseFloat(params.ratio.split(':')[1]);
  const water = key === 'water' ? number : Math.round(coffee * ratio);
  if (
    !Number.isFinite(coffee) ||
    coffee <= 0 ||
    !Number.isFinite(water) ||
    water <= 0
  )
    return method;
  const next: MethodParams = {
    ...params,
    coffee: `${coffee}g`,
    water: `${water}g`,
    ratio:
      key === 'water'
        ? `1:${Number((water / coffee).toFixed(1))}`
        : `1:${ratio}`,
  };
  if (isEspressoMethod(method)) {
    next.stages = params.stages.map((stage, index) =>
      index === extractionIndex ? { ...stage, water: `${water}g` } : stage
    );
  } else {
    const previousWater = Number.parseFloat(recipe.params.water);
    if (!Number.isFinite(previousWater) || previousWater <= 0) return method;
    // Always scale the recipe proportions, so repeated edits do not accumulate rounding errors.
    next.stages = params.stages.map((stage, index) =>
      recipe.params.stages[index]?.water
        ? {
            ...stage,
            water: `${Math.round((Number.parseFloat(recipe.params.stages[index].water!) * water) / previousWater)}g`,
          }
        : stage
    );
  }
  return { ...method, params: next };
};
