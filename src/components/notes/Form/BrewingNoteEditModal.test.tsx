import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BrewingNoteEditModal from './BrewingNoteEditModal';

describe('BrewingNoteEditModal roasting records', () => {
  it('shows only the date, green bean, and roasting amount fields', () => {
    const initialData: NonNullable<
      React.ComponentProps<typeof BrewingNoteEditModal>['initialData']
    > = {
      id: 'roasting-note',
      timestamp: 1_700_000_000_000,
      source: 'roasting',
      beanId: 'green-bean',
      coffeeBeanInfo: {
        name: 'QA green bean',
        roastLevel: '中度烘焙',
      },
      rating: 0,
      taste: {},
      notes: '烘焙了 20g 生豆',
      changeRecord: {
        roastingRecord: {
          greenBeanId: 'green-bean',
          greenBeanName: 'QA green bean',
          roastedAmount: 20,
          roastedBeanId: 'roasted-bean',
          roastedBeanName: 'QA roasted bean',
        },
      },
    };

    const markup = renderToStaticMarkup(
      <BrewingNoteEditModal
        showModal
        initialData={initialData}
        onSave={() => {}}
        onClose={() => {}}
      />
    );

    expect(markup).toContain('日期');
    expect(markup).toContain('咖啡豆');
    expect(markup).toContain('烘焙量');
    expect(markup).toContain('保存记录');
    expect(markup).not.toContain('笔记内容');
    expect(markup).not.toContain('器具方案');
    expect(markup).not.toContain('评分');
    expect(markup).not.toContain('拍照');
    expect(markup).not.toContain('相册');
  });
});
