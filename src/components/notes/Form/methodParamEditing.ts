import type { MethodParams } from '@/lib/core/config';

export interface MethodEditingValues {
  coffee: string;
  ratio: string;
  grindSize: string;
  water: string;
  time: string;
  temp: string;
}

/** An empty measured record must not inherit recipe defaults. */
export const measuredMethodParams = (
  params?: Partial<MethodParams>
): MethodParams => ({
  coffee: '',
  water: '',
  ratio: '',
  grindSize: '',
  temp: '',
  stages: [],
  ...params,
});

/** Update only what was edited; espresso's `water` input is a UI label for yield. */
export function editMethodParams(
  current: MethodParams,
  key: keyof MethodEditingValues,
  values: MethodEditingValues,
  isEspresso: boolean
): MethodParams {
  const next = { ...current };
  switch (key) {
    case 'coffee':
      next.coffee = values.coffee ? `${values.coffee}g` : '';
      break;
    case 'ratio':
      next.ratio = values.ratio ? `1:${values.ratio}` : '';
      break;
    case 'grindSize':
      next.grindSize = values.grindSize;
      break;
    case 'temp':
      next.temp = values.temp ? `${values.temp}°C` : '';
      break;
    case 'water':
      if (isEspresso) {
        next.liquidWeight = values.water ? `${values.water}g` : undefined;
        // Only migrate the legacy yield alias when the user explicitly edits yield.
        if (current.liquidWeight === undefined) next.water = '';
      } else next.water = values.water ? `${values.water}g` : '';
      break;
    case 'time': {
      const time = values.time ? Number.parseFloat(values.time) : undefined;
      next.extractionTime =
        time !== undefined && Number.isFinite(time) ? time : undefined;
      next.stages = (current.stages || []).map((stage, index) =>
        index === 0 ? { ...stage, duration: next.extractionTime } : stage
      );
      break;
    }
  }
  if (!isEspresso && (key === 'coffee' || key === 'ratio')) {
    next.water = values.water ? `${values.water}g` : '';
  }
  return next;
}
