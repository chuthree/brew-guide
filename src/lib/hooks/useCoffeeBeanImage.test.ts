import { describe, expect, it } from 'vitest';
import {
  getCoffeeBeanDataChangedBeanId,
  mergeCoffeeBeanImageIdChange,
  shouldCacheCoffeeBeanImageSource,
  shouldRefreshCoffeeBeanImageIds,
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

describe('shouldRefreshCoffeeBeanImageIds', () => {
  const visibleBeanIds = new Set(['visible-bean']);

  it('refreshes for visible or global image changes', () => {
    expect(
      shouldRefreshCoffeeBeanImageIds(visibleBeanIds, 'visible-bean')
    ).toBe(true);
    expect(shouldRefreshCoffeeBeanImageIds(visibleBeanIds, undefined)).toBe(
      true
    );
  });

  it('ignores changes outside the current bean list', () => {
    expect(shouldRefreshCoffeeBeanImageIds(visibleBeanIds, 'other-bean')).toBe(
      false
    );
  });
});

describe('mergeCoffeeBeanImageIdChange', () => {
  it('updates one bean without clearing the other visible image ids', () => {
    const current = new Set(['bean-a', 'bean-b']);

    expect(mergeCoffeeBeanImageIdChange(current, 'bean-a', false)).toEqual(
      new Set(['bean-b'])
    );
    expect(mergeCoffeeBeanImageIdChange(current, 'bean-c', true)).toEqual(
      new Set(['bean-a', 'bean-b', 'bean-c'])
    );
  });
});
