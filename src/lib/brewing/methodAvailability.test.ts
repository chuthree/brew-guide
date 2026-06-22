import { describe, expect, it } from 'vitest';
import type { CustomEquipment } from '@/lib/core/config';
import { getCommonMethodsForEquipment } from './methodAvailability';

const solo: CustomEquipment = {
  id: 'custom-v60-old-id',
  name: 'Solo',
  animationType: 'orea',
  isCustom: true,
};

describe('getCommonMethodsForEquipment', () => {
  it('uses the current custom equipment type instead of the old id hint', () => {
    const methods = getCommonMethodsForEquipment(solo.id, [solo]);

    expect(methods[0]?.name).toBe('杜嘉宁十克萃');
  });

  it('keeps built-in equipment lookup boring', () => {
    const methods = getCommonMethodsForEquipment('V60', []);

    expect(methods[0]?.name).toBe('一刀流');
  });
});
