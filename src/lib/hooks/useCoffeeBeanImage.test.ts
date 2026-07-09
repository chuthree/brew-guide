import { describe, expect, it } from 'vitest';
import {
  getCoffeeBeanDataChangedBeanId,
  shouldCacheCoffeeBeanImageSource,
} from './useCoffeeBeanImage';

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

describe('shouldCacheCoffeeBeanImageSource', () => {
  it('caches thumbnail sources by default', () => {
    expect(shouldCacheCoffeeBeanImageSource('thumbnail')).toBe(true);
  });

  it('does not cache stored original sources by default', () => {
    expect(shouldCacheCoffeeBeanImageSource('original')).toBe(false);
  });

  it('allows callers to override the default cache policy', () => {
    expect(shouldCacheCoffeeBeanImageSource('original', true)).toBe(true);
    expect(shouldCacheCoffeeBeanImageSource('thumbnail', false)).toBe(false);
  });
});
