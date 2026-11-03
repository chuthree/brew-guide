import { describe, expect, it } from 'vitest';
import {
  commonMethods,
  equipmentList,
  getAnimationTypeFromEquipmentId,
  getBaseEquipmentIdByAnimationType,
  type CustomEquipment,
} from '@/lib/core/config';
import {
  getDefaultPourType,
  getPourTypeOptions,
} from '@/lib/utils/equipmentUtils';

const sinloy = {
  id: 'Sinloy',
  name: 'Sinloy',
  animationType: 'sinloy',
  isCustom: true,
} as CustomEquipment;

describe('内置 Sinloy 滤杯', () => {
  it('注册为内置器具，并映射到自己的动画类型', () => {
    expect(equipmentList.some(equipment => equipment.id === 'Sinloy')).toBe(
      true
    );
    expect(getAnimationTypeFromEquipmentId('Sinloy')).toBe('sinloy');
    expect(getBaseEquipmentIdByAnimationType('sinloy')).toBe('Sinloy');
  });

  it('内置方案已登记，且每段注水量之和等于总水量', () => {
    const methods = commonMethods.Sinloy;

    expect(methods.length).toBeGreaterThan(0);
    for (const method of methods) {
      const poured = method.params.stages.reduce(
        (sum, stage) => sum + (stage.water ? Number(stage.water) : 0),
        0
      );
      expect(`${poured}g`).toBe(method.params.water);
    }
  });

  it('沿用系统注水动画 center / circle / ice，而不是自绘动画', () => {
    const values = getPourTypeOptions(sinloy).map(option => option.value);

    expect(values).toEqual(
      expect.arrayContaining(['center', 'circle', 'ice', 'wait', 'other'])
    );
  });

  it('默认注水方式是绕圈', () => {
    expect(getDefaultPourType(sinloy)).toBe('circle');
  });
});
