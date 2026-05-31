import type { Method } from '@/lib/core/config';

export const hasBrewingStages = (method: Method): boolean =>
  method.params.stages.length > 0;
