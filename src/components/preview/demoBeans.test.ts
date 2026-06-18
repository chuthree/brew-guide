import { describe, expect, it } from 'vitest';
import {
  previewBeans,
  previewCustomEquipments,
  previewMethodsByEquipment,
  previewNotes,
  previewRecognitionBean,
  previewSettings,
} from './demoBeans';

describe('preview demo data', () => {
  it('keeps one bean out of the visible inventory for mock recognition', () => {
    expect(previewRecognitionBean.name).toBe('TOH双冠军 花野 极浅');
    expect(previewRecognitionBean.image).toMatch(/^data:image\//);
    expect(previewBeans).toHaveLength(8);
    expect(
      previewBeans.some(bean => bean.id === previewRecognitionBean.id)
    ).toBe(false);
  });

  it('keeps the LAB19 ALO natural bean remaining at 32g', () => {
    const bean = previewBeans.find(
      bean =>
        bean.roaster === 'LAB19' &&
        bean.name === 'Ethiopia Sky Project ALO Verve TIM Natural'
    );

    expect(bean).toBeDefined();
    expect(bean?.remaining).toBe('32');
  });

  it('contains only coffee bean inventory data', () => {
    expect(previewNotes).toHaveLength(0);
    expect(previewCustomEquipments).toHaveLength(0);
    expect(Object.keys(previewMethodsByEquipment)).toHaveLength(0);
    expect(previewSettings.equipmentOrder).toHaveLength(0);
    expect(previewSettings.showBeanNotes).toBe(true);
    expect(previewSettings.showFlavorInfo).toBe(true);
    expect(previewSettings.showNoteContent).toBe(false);
    expect(previewSettings.showBeanRating).toBe(false);
    expect(previewSettings.notesMaxLines).toBe(1);
    expect(previewSettings.navigationSettings).toEqual({
      visibleTabs: {
        brewing: true,
        coffeeBean: true,
        notes: true,
      },
      coffeeBeanViews: {
        inventory: true,
        ranking: false,
        stats: false,
      },
      pinnedViews: [],
    });

    for (const bean of [...previewBeans, previewRecognitionBean]) {
      expect(bean).not.toHaveProperty('notes');
    }
  });
});
