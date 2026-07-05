import { describe, expect, it } from 'vitest';
import { FlavorPeriodStatus } from '@/lib/utils/beanVarietyUtils';
import { getInventoryAllClickAction } from './ViewSwitcher';

describe('getInventoryAllClickAction', () => {
  it('clears the visible flavor period before widening bean type', () => {
    expect(
      getInventoryAllClickAction({
        selectedBeanType: 'filter',
        filterMode: 'flavorPeriod',
        selectedFlavorPeriod: FlavorPeriodStatus.OPTIMAL,
      })
    ).toBe('clear-flavor-period');
  });

  it('widens bean type when the visible category is already all', () => {
    expect(
      getInventoryAllClickAction({
        selectedBeanType: 'filter',
        filterMode: 'flavorPeriod',
        selectedFlavorPeriod: null,
      })
    ).toBe('clear-bean-type');
  });
});
