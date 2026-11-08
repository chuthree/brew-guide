import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BEAN_RECOGNITION_PROMPT,
  buildBeanRecognitionPrompt,
  normalizeRecognizedBeanPayload,
  recognizeBeanImage,
} from './beanRecognition';
import { BEAN_RECOGNITION_PROMPT } from '@/lib/constants/beanImportRules.js';
import type { BeanFieldId } from '@/lib/coffee-beans/beanFields';

const fieldSettings = (...ids: BeanFieldId[]) => ({
  beanFieldConfig: {
    version: 1 as const,
    fields: ids.map((id, order) => ({ id, enabled: true, order })),
  },
});

describe('normalizeRecognizedBeanPayload', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('deduplicates variety-only blend components', () => {
    const payload = normalizeRecognizedBeanPayload({
      name: '2026 瑰夏村 金标 Oma 157',
      blendComponents: [
        { origin: '瑰夏村', process: '水洗', variety: 'Oma 157' },
        { variety: 'Oma 157 Oma 157' },
      ],
    });

    expect(payload).toEqual({
      name: '2026 瑰夏村 金标 Oma 157',
      blendComponents: [
        { origin: '瑰夏村', process: '水洗', variety: 'Oma 157' },
      ],
    });
  });

  it('does not overwrite an explicit numeric variety from the title', () => {
    const payload = normalizeRecognizedBeanPayload({
      name: '2026 瑰夏村 金标 Oma 157',
      blendComponents: [{ origin: '瑰夏村', process: '水洗', variety: '1931' }],
    });

    expect(payload).toEqual({
      name: '2026 瑰夏村 金标 Oma 157',
      blendComponents: [{ origin: '瑰夏村', process: '水洗', variety: '1931' }],
    });
  });

  it('preserves blend ratios, list values, duplicate rows and order', () => {
    const bean = {
      name: '拼配',
      blendComponents: [
        { origin: '肯尼亚', percentage: 60, variety: ['SL28/34', 'Ruiru 11'] },
        { origin: '肯尼亚', percentage: 40, variety: ['SL28/34', 'Ruiru 11'] },
        { percentage: 0 },
      ],
    };
    expect(normalizeRecognizedBeanPayload(bean)).toEqual(bean);
    const duplicateRows = {
      name: '两批同产地',
      blendComponents: [{ origin: '埃塞俄比亚' }, { origin: '埃塞俄比亚' }],
    };
    expect(normalizeRecognizedBeanPayload(duplicateRows)).toEqual(
      duplicateRows
    );
  });

  it('preserves ambiguous variety-only rows instead of assuming OCR duplication', () => {
    for (const complete of [
      { origin: '肯尼亚', variety: 'SL28/34' },
      { origin: '肯尼亚' },
    ]) {
      const bean = {
        name: '拼配',
        blendComponents: [complete, { variety: 'SL28/34' }],
      };
      expect(normalizeRecognizedBeanPayload(bean)).toEqual(bean);
    }
  });

  it('does not collapse variety-only rows with scoped component notes', () => {
    expect(
      normalizeRecognizedBeanPayload({
        name: '拼配',
        blendComponents: [
          { origin: '肯尼亚', variety: 'SL28/34' },
          { variety: 'SL28/34' },
        ],
        notes: '成分2 产地：埃塞俄比亚',
      })
    ).toEqual({
      name: '拼配',
      blendComponents: [
        { origin: '肯尼亚', variety: 'SL28/34' },
        { origin: '埃塞俄比亚', variety: 'SL28/34' },
      ],
    });
  });

  it('shares import normalization without guessing unknown facts', () => {
    expect(
      normalizeRecognizedBeanPayload({
        name: '测试豆',
        roastLevel: 'medium light',
        notes: '产国：哥伦比亚 / 产区：Nariño / 风味：橙花、红糖 / 系列：春日',
      })
    ).toEqual({
      name: '测试豆',
      roastLevel: '中浅烘焙',
      flavor: ['橙花', '红糖'],
      blendComponents: [{ origin: '哥伦比亚 · Nariño' }],
      notes: '系列：春日',
    });
    expect(
      normalizeRecognizedBeanPayload({
        name: '未知豆',
        beanType: 'unknown',
        roastDate: '2026-02-30',
      })
    ).toEqual({ name: '未知豆' });
  });

  it('uses the shared recognition contract while preserving custom base text', () => {
    expect(DEFAULT_BEAN_RECOGNITION_PROMPT).toBe(BEAN_RECOGNITION_PROMPT);
    expect(buildBeanRecognitionPrompt()).toContain(BEAN_RECOGNITION_PROMPT);
    const custom = buildBeanRecognitionPrompt('  我的自定义识别提示词  ');
    expect(custom.startsWith('我的自定义识别提示词\n\n')).toBe(true);
    expect(custom).not.toContain('任务：从咖啡豆包装图片');
  });

  it('applies field settings after recognition normalization', () => {
    const payload = normalizeRecognizedBeanPayload(
      {
        name: '博纳 水洗',
        blendComponents: [
          {
            origin: '埃塞俄比亚',
            estate: '博纳',
            processingStation: '沃卡',
            process: '水洗',
            altitude: '2100m',
            batch: 'A12',
          },
        ],
      },
      {
        beanFieldConfig: {
          version: 1,
          fields: [
            { id: 'origin', enabled: true, order: 0 },
            { id: 'process', enabled: true, order: 1 },
          ],
        },
      }
    );

    expect(payload).toEqual({
      name: '博纳 水洗',
      blendComponents: [{ origin: '埃塞俄比亚', process: '水洗' }],
      notes: '庄园：博纳 / 处理站：沃卡 / 海拔：2100m / 批次：A12',
    });
  });

  it('normalizes the Obraje sample from an experimental API response', async () => {
    const modelPayload = {
      name: 'OBRAJE 哥伦比亚奥博拉赫庄园',
      roaster: 'MEOW COFFEE',
      flavor: ['橙花', '凤梨软糖', '成熟菠萝', '血橙汁'],
      blendComponents: [
        {
          country: '哥伦比亚',
          region: 'NARIÑO',
          estate: '奥博拉赫庄园',
          process: '蜜处理',
          variety: '绿顶瑰夏',
        },
      ],
      notes:
        '产国：哥伦比亚 / 产区：Narino / 庄园：奥博拉赫庄园 / 海拔：2200–2300 M.A.S.L / 处理法：蜜处理 / 品种：绿顶瑰夏',
    };
    class MockFileReader {
      result = 'data:image/jpeg;base64,/9j/4A==';
      onload: (() => void) | null = null;
      readAsDataURL() {
        this.onload?.();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify(modelPayload),
                },
              },
            ],
          })
        )
    );

    const result = await recognizeBeanImage(
      new File(['image'], 'bean.jpg', { type: 'image/jpeg' }),
      undefined,
      {
        enabled: true,
        apiBaseUrl: 'https://example.com/v1',
        model: 'vision',
        prompt: 'base',
      },
      fieldSettings(
        'country',
        'region',
        'estate',
        'altitude',
        'process',
        'variety'
      )
    );

    const { notes: _notes, ...visiblePayload } = modelPayload;
    expect(result).toEqual({
      ...visiblePayload,
      blendComponents: [
        {
          ...visiblePayload.blendComponents[0],
          altitude: '2200-2300m',
        },
      ],
    });
  });

  it('adds final prompt constraints for configured bean fields', () => {
    const prompt = buildBeanRecognitionPrompt('base prompt', {
      beanFieldConfig: {
        version: 1,
        fields: [
          { id: 'country', enabled: true, order: 0 },
          { id: 'region', enabled: true, order: 1 },
          { id: 'processingStation', enabled: true, order: 2 },
          { id: 'process', enabled: true, order: 3 },
        ],
      },
    });

    expect(prompt).toContain('base prompt');
    expect(prompt).toContain(
      '只允许输出这些成分字段：country/region/processingStation/process'
    );
    expect(prompt).toContain('origin 是未结构化的“产地概括”');
    expect(prompt).toContain('processingStation 仅表示处理站/水洗站');
    expect(prompt).toContain('严禁输出未允许的 blendComponents 键');
    expect(prompt).toContain(
      'name 是包装展示标题，与结构化字段合理重叠不算重复'
    );
  });
});
