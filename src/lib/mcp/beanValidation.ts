import type { CoffeeBean } from '@/types/app';
import { parseCoffeeBeanAmount } from '@/lib/coffee-beans/amount';
import { invalid } from './validation';

export function validateBean(bean: CoffeeBean): void {
  if (!bean.name.trim()) invalid('bean.name cannot be blank');
  const capacity = parseCoffeeBeanAmount(bean.capacity);
  const remaining = parseCoffeeBeanAmount(bean.remaining);
  if (
    capacity !== null &&
    remaining !== null &&
    remaining > capacity + 0.000001
  )
    invalid('Remaining inventory cannot exceed package capacity');
  if (bean.endDay !== undefined && (bean.startDay ?? 0) > bean.endDay)
    invalid('startDay cannot exceed endDay');
  const blendTotal =
    bean.blendComponents?.reduce(
      (sum, component) => sum + (component.percentage ?? 0),
      0
    ) ?? 0;
  if (blendTotal > 100.000001)
    invalid('Blend percentages cannot total more than 100');
}
