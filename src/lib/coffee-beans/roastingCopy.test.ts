import { describe, expect, it } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import { createRoastingCopyTemplate } from './roastingCopy';

describe('createRoastingCopyTemplate', () => {
  it('builds an independent roast draft without an extra loss decrement', () => {
    const greenBean: CoffeeBean = {
      id: 'green-bean',
      timestamp: 100,
      name: 'Ethiopia green bean',
      beanState: 'green',
      capacity: '100',
      remaining: '80',
      roaster: 'Producer',
    };
    const roastedBean: CoffeeBean = {
      id: 'original-roasted-bean',
      timestamp: 150,
      name: 'Ethiopia roasted bean',
      beanState: 'roasted',
      capacity: '20',
      remaining: '17',
      roastLevel: '中浅烘焙',
    };

    const copy = createRoastingCopyTemplate(
      greenBean,
      roastedBean,
      20,
      '2026-10-19'
    );

    expect(copy).toMatchObject({
      name: 'Ethiopia green bean',
      beanState: 'roasted',
      capacity: '20',
      remaining: '20',
      roastLevel: '中浅烘焙',
      roastDate: '2026-10-19',
      sourceGreenBeanId: 'green-bean',
    });
    expect(copy).not.toHaveProperty('id');
    expect(copy).not.toHaveProperty('timestamp');
  });
});
