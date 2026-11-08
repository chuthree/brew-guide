import type { Method, CustomEquipment } from '@/lib/core/config';
import { isPourTypeAvailable } from '@/lib/utils/equipmentUtils';
import { invalid } from './validation';

export function validateCatalogMethod(
  method: Method,
  equipment: CustomEquipment
) {
  const amount = (value: string) => Number(value.replace(/\s*g$/i, '').trim());
  if (
    !Number.isFinite(amount(method.params.coffee)) ||
    amount(method.params.coffee) <= 0
  )
    invalid('Coffee amount must be positive grams.');
  if (
    !Number.isFinite(amount(method.params.water)) ||
    amount(method.params.water) < 0
  )
    invalid('Water amount must be nonnegative grams.');
  for (const stage of method.params.stages) {
    if (!isPourTypeAvailable(equipment, stage.pourType))
      invalid(
        `Unavailable pourType ${JSON.stringify(stage.pourType)}. Read get_equipment.availablePourTypes; define custom pour animations before using their IDs.`
      );
    if (stage.valveStatus !== undefined && !equipment.hasValve)
      invalid('Valve status is only supported by equipment with a valve.');
    if (
      stage.water !== undefined &&
      (!Number.isFinite(amount(stage.water)) || amount(stage.water) < 0)
    )
      invalid('Stage water must be nonnegative grams.');
    if (
      !['bypass', 'beverage'].includes(stage.pourType || '') &&
      stage.duration === undefined
    )
      invalid('Stage duration is required except for bypass/beverage.');
  }
}
