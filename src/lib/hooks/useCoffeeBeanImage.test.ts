import { describe, expect, it } from 'vitest';
import { getCoffeeBeanDataChangedBeanId } from './useCoffeeBeanImage';

describe('getCoffeeBeanDataChangedBeanId', () => {
  it('uses the explicit bean id first', () => {
    expect(
      getCoffeeBeanDataChangedBeanId({
        beanId: 'new-id',
        bean: { id: 'old-id' },
      })
    ).toBe('new-id');
  });

  it('falls back to the event bean id', () => {
    expect(getCoffeeBeanDataChangedBeanId({ bean: { id: 'bean-id' } })).toBe(
      'bean-id'
    );
  });
});
