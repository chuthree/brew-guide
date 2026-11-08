import { describe, expect, it } from 'vitest';
import {
  prepareRecognizedBeanImages,
  resolveBeanImportImage,
} from './beanImportImage';
import { normalizeRecognizedBeanPayload } from '@/lib/api/beanRecognition';
import { normalizeCoffeeBeanForFieldConfig } from './beanFields';
import type { CoffeeBean } from '@/types/app';

const first = 'data:image/png;base64,synthetic-first';
const second = 'data:image/png;base64,synthetic-second';

describe('shared bean import image policy', () => {
  it.each([undefined, false])(
    'does not default to a photo when the setting is %s',
    setting => {
      expect(
        resolveBeanImportImage({
          autoFillRecognitionImage: setting,
          candidates: [first],
        })
      ).toBeNull();
      expect(
        resolveBeanImportImage({
          autoFillRecognitionImage: setting,
          candidates: [first, second],
          beanCount: 2,
        })
      ).toBeNull();
    }
  );

  it('defaults only an enabled, unambiguous one-photo one-bean association', () => {
    expect(
      resolveBeanImportImage({
        autoFillRecognitionImage: true,
        candidates: [first],
      })
    ).toBe(first);
  });

  it.each([false, true])(
    'keeps an explicit photo ahead of setting %s',
    setting => {
      expect(
        resolveBeanImportImage({
          autoFillRecognitionImage: setting,
          explicitImage: second,
          candidates: [first],
          beanCount: 2,
        })
      ).toBe(second);
    }
  );

  it.each([false, true])(
    'keeps an explicit no-photo decision ahead of setting %s',
    setting => {
      expect(
        resolveBeanImportImage({
          autoFillRecognitionImage: setting,
          explicitImage: null,
          candidates: [first],
        })
      ).toBeNull();
    }
  );

  it('uses the same policy for host-local attachment IDs without pixels', () => {
    expect(
      resolveBeanImportImage({
        autoFillRecognitionImage: true,
        candidates: ['current-photo-id'],
      })
    ).toBe('current-photo-id');
  });

  it.each([false, true])(
    'allows creation without photos when no source exists and setting is %s',
    setting => {
      expect(
        resolveBeanImportImage({
          autoFillRecognitionImage: setting,
          candidates: [],
          beanCount: 3,
        })
      ).toBeNull();
    }
  );

  it('requires a choice for multiple candidate images or beans when enabled', () => {
    expect(
      resolveBeanImportImage({
        autoFillRecognitionImage: true,
        candidates: [first, second],
      })
    ).toBeUndefined();
    expect(
      resolveBeanImportImage({
        autoFillRecognitionImage: true,
        candidates: [first],
        beanCount: 2,
      })
    ).toBeUndefined();
  });
});

describe('recognition image association before first persistence', () => {
  it('rejects a failed source preparation before import when default photos are enabled', () => {
    const data = { name: 'Do not save', image: second };
    expect(() =>
      prepareRecognizedBeanImages(data, {
        autoFillRecognitionImage: true,
        recognitionImage: null,
      })
    ).toThrow('图片准备失败');
    expect(data).toEqual({ name: 'Do not save', image: second });
  });

  it.each([undefined, false])(
    'permits a failed source to import without photos when setting is %s',
    setting => {
      expect(
        prepareRecognizedBeanImages(
          { name: 'No photo needed', image: second },
          {
            autoFillRecognitionImage: setting,
            recognitionImage: null,
          }
        )
      ).toEqual({
        data: { name: 'No photo needed' },
        needsImageSelection: false,
      });
    }
  );

  it('adds the enabled source before normalization and the first save input', () => {
    const prepared = prepareRecognizedBeanImages(
      { name: 'Synthetic bean' },
      {
        autoFillRecognitionImage: true,
        recognitionImage: first,
      }
    );
    expect(prepared.needsImageSelection).toBe(false);
    // These are the normalizers used between the recognition callback and
    // page.handleImportBean's first addBeanWithInitialCapacityAdjustmentRecord.
    const recognized = normalizeRecognizedBeanPayload(
      prepared.data
    ) as CoffeeBean;
    expect(normalizeCoffeeBeanForFieldConfig(recognized)).toMatchObject({
      name: 'Synthetic bean',
      image: first,
    });
  });

  it('leaves singleton recognition without a default photo when disabled', () => {
    const bean = { name: 'Synthetic bean' };
    expect(
      prepareRecognizedBeanImages(bean, {
        autoFillRecognitionImage: false,
        recognitionImage: first,
      })
    ).toEqual({ data: bean, needsImageSelection: false });
    expect(bean).not.toHaveProperty('image');
  });

  it.each([false, true])(
    'ignores model-provided image fields when setting is %s',
    setting => {
      expect(
        prepareRecognizedBeanImages(
          { name: 'Bean', image: second, backImage: second },
          {
            autoFillRecognitionImage: setting,
            recognitionImage: first,
          }
        )
      ).toEqual({
        data: { name: 'Bean', ...(setting ? { image: first } : {}) },
        needsImageSelection: false,
      });
    }
  );

  it('never assigns a shared source to the first bean in a multi-bean result', () => {
    const beans = [{ name: 'First bean' }, { name: 'Second bean' }];
    expect(
      prepareRecognizedBeanImages(beans, {
        autoFillRecognitionImage: true,
        recognitionImage: first,
      })
    ).toEqual({ data: beans, needsImageSelection: true });
    expect(beans.every(bean => !('image' in bean))).toBe(true);
  });

  it('does not require photo selection for multiple beans when default photos are disabled', () => {
    const beans = [{ name: 'First bean' }, { name: 'Second bean' }];
    expect(
      prepareRecognizedBeanImages(beans, {
        autoFillRecognitionImage: false,
        recognitionImage: first,
      })
    ).toEqual({ data: beans, needsImageSelection: false });
  });

  it('keeps each batch result paired with its own source regardless of completion order', () => {
    const results = [
      { data: [{ name: 'Second bean' }], recognitionImage: second },
      { data: [{ name: 'First bean' }], recognitionImage: first },
    ];
    const mapped = results.flatMap(result => {
      const prepared = prepareRecognizedBeanImages(result.data, {
        autoFillRecognitionImage: true,
        recognitionImage: result.recognitionImage,
      });
      expect(prepared.needsImageSelection).toBe(false);
      return prepared.data;
    });
    expect(mapped).toEqual([
      { name: 'Second bean', image: second },
      { name: 'First bean', image: first },
    ]);
  });

  it('does not accept model image/null fields as choices for ambiguous results', () => {
    const data = [
      { name: 'One', image: second },
      { name: 'Two', image: null },
    ];
    expect(
      prepareRecognizedBeanImages(data, {
        autoFillRecognitionImage: true,
        recognitionImage: first,
      })
    ).toEqual({
      data: [{ name: 'One' }, { name: 'Two' }],
      needsImageSelection: true,
    });
  });

  it('cannot retain model images when there is no local source', () => {
    expect(
      prepareRecognizedBeanImages(
        {
          name: 'Bean',
          image: second,
          backImage: first,
        },
        { autoFillRecognitionImage: true }
      )
    ).toEqual({
      data: { name: 'Bean' },
      needsImageSelection: false,
    });
  });

  it('keeps explicit JSON/share-package images in their separate normalization path', () => {
    const imported = { name: 'Shared bean', image: first, backImage: second };
    expect(normalizeRecognizedBeanPayload(imported)).toMatchObject(imported);
  });

  it('does not mutate recognition results or source arrays', () => {
    const bean = Object.freeze({ name: 'Immutable bean' });
    const data = Object.freeze([bean]);
    expect(
      prepareRecognizedBeanImages(data, {
        autoFillRecognitionImage: true,
        recognitionImage: first,
      }).data
    ).toEqual([{ name: 'Immutable bean', image: first }]);
    expect(bean).not.toHaveProperty('image');
  });
});
