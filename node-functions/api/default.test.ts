import { afterEach, describe, expect, it, vi } from 'vitest';
import onRequest from './[[default]].js';
import { buildBeanRecognitionPrompt } from '@/lib/api/beanRecognition';

function createImageRequest(
  file: File,
  pathname = '/api/recognize-bean',
  beanFieldConfig?: unknown
) {
  const formData = new FormData();
  formData.append('image', file);
  if (beanFieldConfig) {
    formData.append('beanFieldConfig', JSON.stringify(beanFieldConfig));
  }

  return new Request(`https://example.com${pathname}`, {
    method: 'POST',
    body: formData,
  });
}

function mockModelResponse(content = '{"name":"测试咖啡豆"}') {
  let payload:
    | {
        model?: string;
        thinking?: { type?: string };
        response_format?: { type?: string };
        messages: Array<{
          content?: Array<{ image_url?: { url?: string } }>;
        }>;
      }
    | undefined;

  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    payload = JSON.parse(String(init?.body || '{}'));
    return new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  return {
    getPayload: () => {
      if (!payload) throw new Error('Model request was not sent');
      return payload;
    },
  };
}

async function callRecognizeBean(file: File, beanFieldConfig?: unknown) {
  return onRequest({
    request: createImageRequest(file, '/api/recognize-bean', beanFieldConfig),
    env: { QINIU_API_KEY: 'test-key' },
  });
}

async function callRecognizeMethod(file: File) {
  return onRequest({
    request: createImageRequest(file, '/api/recognize-method'),
    env: { QINIU_API_KEY: 'test-key' },
  });
}

describe('recognition image upload validation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the detected WebP MIME type when a jpg upload contains WebP bytes', async () => {
    const { getPayload } = mockModelResponse();
    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x08, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const file = new File([webpBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file);

    expect(response.status).toBe(200);
    expect(
      getPayload().messages[1].content?.[0].image_url?.url?.startsWith(
        'data:image/webp;base64,'
      )
    ).toBe(true);
  });

  it('normalizes the image/jpg alias to image/jpeg', async () => {
    const { getPayload } = mockModelResponse();
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpg' });

    const response = await callRecognizeBean(file);

    expect(response.status).toBe(200);
    expect(
      getPayload().messages[1].content?.[0].image_url?.url?.startsWith(
        'data:image/jpeg;base64,'
      )
    ).toBe(true);
  });

  it('uses the active replacement model by default', async () => {
    const { getPayload } = mockModelResponse();
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file);

    expect(response.status).toBe(200);
    expect(getPayload().model).toBe('doubao-seed-2.0-mini');
    expect(getPayload().thinking).toEqual({ type: 'disabled' });
    expect(getPayload().response_format).toEqual({ type: 'json_object' });
  });

  it('uses the active replacement model for method recognition by default', async () => {
    const { getPayload } = mockModelResponse(
      '{"name":"测试方案","params":{"stages":[{"pourType":"center","label":"注水","water":"30","duration":10,"detail":""}]}}'
    );
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeMethod(file);

    expect(response.status).toBe(200);
    expect(getPayload().model).toBe('doubao-seed-2.0-mini');
    expect(getPayload().thinking).toEqual({ type: 'disabled' });
    expect(getPayload().response_format).toEqual({ type: 'json_object' });
  });

  it('uses the same prompt and configured field constraints as the client', async () => {
    const config = {
      version: 1 as const,
      fields: [
        { id: 'variety' as const, enabled: true, order: 0 },
        { id: 'country' as const, enabled: true, order: 1 },
        { id: 'process' as const, enabled: true, order: 2 },
      ],
    };
    const { getPayload } = mockModelResponse();
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      'bean.jpg',
      { type: 'image/jpeg' }
    );
    await callRecognizeBean(file, config);
    expect(getPayload().messages[0].content).toBe(
      buildBeanRecognitionPrompt(undefined, { beanFieldConfig: config })
    );
  });

  it('preserves real blend percentages, arrays, duplicate components and order', async () => {
    const modelBean = {
      name: '三批次拼配',
      blendComponents: [
        { origin: '肯尼亚', percentage: 60, variety: ['SL28/34', 'Ruiru 11'] },
        { origin: '肯尼亚', percentage: 40, variety: ['SL28/34', 'Ruiru 11'] },
        { percentage: 0 },
      ],
    };
    mockModelResponse(JSON.stringify(modelBean));
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      'bean.jpg',
      { type: 'image/jpeg' }
    );
    const response = await callRecognizeBean(file);
    expect((await response.json()).data).toEqual(modelBean);
  });

  it('preserves scoped note indexes when a component has only disabled fields', async () => {
    mockModelResponse(
      JSON.stringify({
        name: '拼配',
        blendComponents: [
          { variety: ['SL28/34', 'Ruiru 11'] },
          { origin: '哥伦比亚', process: '水洗' },
        ],
        notes: '成分2 批次：618',
      })
    );
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      'bean.jpg',
      { type: 'image/jpeg' }
    );
    const response = await callRecognizeBean(file, {
      version: 1,
      fields: [
        { id: 'origin', enabled: true, order: 0 },
        { id: 'process', enabled: true, order: 1 },
      ],
    });
    expect((await response.json()).data).toEqual({
      name: '拼配',
      blendComponents: [{}, { origin: '哥伦比亚', process: '水洗' }],
      notes: '成分2 批次：618 / 成分1 品种：["SL28/34","Ruiru 11"]',
    });
  });

  it('does not merge scoped variety rows or identical complete blend rows', async () => {
    const beans = [
      {
        name: '拼配',
        blendComponents: [
          { origin: '肯尼亚', variety: 'SL28/34' },
          { variety: 'SL28/34' },
        ],
        notes: '成分2 产地：埃塞俄比亚',
      },
      {
        name: '同产地拼配',
        blendComponents: [{ origin: '哥伦比亚' }, { origin: '哥伦比亚' }],
      },
      {
        name: '单行品种不是重复证据',
        blendComponents: [
          { origin: '肯尼亚', variety: 'SL28/34' },
          { variety: 'SL28/34' },
        ],
      },
      {
        name: '单行品种不擅自合并',
        blendComponents: [{ origin: '肯尼亚' }, { variety: 'SL28/34' }],
      },
    ];
    mockModelResponse(JSON.stringify(beans));
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      'bean.jpg',
      { type: 'image/jpeg' }
    );
    const response = await callRecognizeBean(file);
    expect((await response.json()).data).toEqual(beans);
  });

  it('does not lose factual notes beside advertising or infer unknown bean usage', async () => {
    mockModelResponse(
      JSON.stringify({
        name: '深烘拼配',
        beanType: 'unknown',
        notes: '批次：618 / 品种：SL28/34 / 540天锁鲜装 / 我想练习萃取技术',
      })
    );
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      'bean.jpg',
      { type: 'image/jpeg' }
    );
    const response = await callRecognizeBean(file);
    expect((await response.json()).data).toEqual({
      name: '深烘拼配',
      notes: '批次：618 / 品种：SL28/34 / 540天锁鲜装 / 我想练习萃取技术',
    });
  });

  it('preserves numeric notes instead of guessing they are cultivars', async () => {
    mockModelResponse(
      JSON.stringify({
        name: '测试豆',
        blendComponents: [{ origin: '埃塞俄比亚' }],
        notes: ['海拔：2100m', '74158', '系列：春日', '批次：1931'],
      })
    );
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      'bean.jpg',
      { type: 'image/jpeg' }
    );
    const response = await callRecognizeBean(file);
    expect((await response.json()).data).toEqual({
      name: '测试豆',
      blendComponents: [{ origin: '埃塞俄比亚' }],
      notes: '海拔：2100m / 74158 / 系列：春日 / 批次：1931',
    });
  });

  it('does not move regional free notes or title text into component origins', async () => {
    const beans = [
      {
        name: '古吉 罕贝拉',
        blendComponents: [{ origin: ['埃塞俄比亚', '哥伦比亚'] }],
        notes: '很喜欢古吉的口感，下次再买',
      },
      {
        name: '西达摩 班莎',
        blendComponents: [{ origin: '埃塞俄比亚' }],
        notes: '很喜欢古吉的口感，下次再买',
      },
    ];
    mockModelResponse(JSON.stringify(beans));
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      'bean.jpg',
      { type: 'image/jpeg' }
    );
    const response = await callRecognizeBean(file);
    expect((await response.json()).data).toEqual(beans);
  });

  it('preserves mixed free-note line breaks and semicolons', async () => {
    const notes = '我想练习萃取技术；批次：618\n540天锁鲜装\n这次比上次甜';
    mockModelResponse(JSON.stringify({ name: '测试豆', notes }));
    const file = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      'bean.jpg',
      { type: 'image/jpeg' }
    );
    const response = await callRecognizeBean(file);
    expect((await response.json()).data).toEqual({ name: '测试豆', notes });
  });

  it('normalizes common blend component key drift from fast vision models', async () => {
    mockModelResponse(
      '{"name":"测试咖啡豆","blenderComponents":{"origin":"哥伦比亚","process":"水洗"}}'
    );
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      name: '测试咖啡豆',
      blendComponents: [{ origin: '哥伦比亚', process: '水洗' }],
    });
  });

  it('drops invalid roast dates from model output', async () => {
    mockModelResponse('{"name":"测试咖啡豆","roastDate":"2026-00-00"}');
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ name: '测试咖啡豆' });
  });

  it('drops empty string fields from model output', async () => {
    mockModelResponse(
      '{"name":"测试咖啡豆","roaster":"","notes":" ","remaining":null,"blendComponents":[{"origin":"哥伦比亚","estate":"","process":"水洗"}]}'
    );
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      name: '测试咖啡豆',
      blendComponents: [{ origin: '哥伦比亚', process: '水洗' }],
    });
  });

  it('normalizes flat component and note output from fast models', async () => {
    mockModelResponse(
      '{"name":"测试咖啡豆","blendComponents":["ETHIOPIA","BONA STATION","水洗"],"notes":["2200-2300 M.A.S.L","74158"]}'
    );
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      name: '测试咖啡豆',
      blendComponents: [
        {
          origin: '埃塞俄比亚',
          process: '水洗',
        },
      ],
      notes: '海拔 2200-2300m / 74158 / 处理站：博纳',
    });
  });

  it('keeps only configured bean fields in default recognition', async () => {
    const { getPayload } = mockModelResponse(
      '{"name":"测试咖啡豆","blendComponents":[{"origin":"埃塞俄比亚","estate":"博纳","process":"水洗","altitude":"2100m","batch":"A12"}]}'
    );
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getPayload().messages[0].content).toContain(
      '只允许输出这些成分字段：origin/process/variety'
    );
    expect(body.data).toEqual({
      name: '测试咖啡豆',
      blendComponents: [{ origin: '埃塞俄比亚', process: '水洗' }],
      notes: '庄园：博纳 / 海拔：2100m / 批次：A12',
    });
  });

  it('keeps explicitly enabled structured bean fields', async () => {
    mockModelResponse(
      '{"name":"测试咖啡豆","blendComponents":[{"country":"埃塞俄比亚","region":"西达摩","estate":"某庄园","processingStation":"博纳","process":"水洗","batch":"A12"}]}'
    );
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file, {
      version: 1,
      fields: [
        { id: 'country', enabled: true, order: 0 },
        { id: 'region', enabled: true, order: 1 },
        { id: 'estate', enabled: true, order: 2 },
        { id: 'processingStation', enabled: true, order: 3 },
        { id: 'process', enabled: true, order: 4 },
      ],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      name: '测试咖啡豆',
      blendComponents: [
        {
          country: '埃塞俄比亚',
          region: '西达摩',
          estate: '某庄园',
          processingStation: '博纳',
          process: '水洗',
        },
      ],
      notes: '批次：A12',
    });
  });

  it('deduplicates repeated blend components from model output', async () => {
    mockModelResponse(
      '{"name":"2026 瑰夏村 金标 Oma 157","blendComponents":[{"origin":"瑰夏村","process":"水洗","variety":"Oma 157"},{"variety":"Oma 157 Oma 157"}],"notes":"海拔2000m/批次1931"}'
    );
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      name: '2026 瑰夏村 金标 Oma 157',
      blendComponents: [
        { origin: '瑰夏村', process: '水洗', variety: 'Oma 157' },
      ],
      notes: '海拔2000m/批次1931',
    });
  });

  it('does not replace an explicit numeric variety with a title match', async () => {
    mockModelResponse(
      '{"name":"2026 瑰夏村 金标 Oma 157","blendComponents":[{"origin":"瑰夏村","process":"水洗","variety":"1931"}],"notes":"海拔2000m/烘焙机：Fuji Royal R105"}'
    );
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      name: '2026 瑰夏村 金标 Oma 157',
      blendComponents: [{ origin: '瑰夏村', process: '水洗', variety: '1931' }],
      notes: '海拔2000m/烘焙机：Fuji Royal R105',
    });
  });

  it('keeps region text in the packaging title and drops advertising notes', async () => {
    const { getPayload } = mockModelResponse(
      '{"name":"Alo 西达摩 班莎 奇拉卡","notes":"540天锁鲜装","blendComponents":[{"origin":"埃塞俄比亚","process":"精致水洗","variety":"74158"}]}'
    );
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      name: 'Alo 西达摩 班莎 奇拉卡',
      blendComponents: [
        {
          origin: '埃塞俄比亚',
          process: '精致水洗',
          variety: '74158',
        },
      ],
    });
    expect(getPayload().messages[0].content).toContain(
      '名称与结构化字段合理重叠不算重复'
    );
  });

  it('keeps the Obraje sample title and visible structured fields', async () => {
    mockModelResponse(
      '{"name":"OBRAJE 哥伦比亚奥博拉赫庄园","roaster":"MEOW COFFEE","blendComponents":[{"country":"哥伦比亚","region":"NARIÑO","estate":"奥博拉赫庄园","altitude":"2200-2300m","process":"蜜处理","variety":"绿顶瑰夏"}]}'
    );
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'obraje.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file, {
      version: 1,
      fields: [
        { id: 'country', enabled: true, order: 0 },
        { id: 'region', enabled: true, order: 1 },
        { id: 'estate', enabled: true, order: 2 },
        { id: 'altitude', enabled: true, order: 3 },
        { id: 'process', enabled: true, order: 4 },
        { id: 'variety', enabled: true, order: 5 },
      ],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      name: 'OBRAJE 哥伦比亚奥博拉赫庄园',
      roaster: 'MEOW COFFEE',
      blendComponents: [
        {
          country: '哥伦比亚',
          region: 'NARIÑO',
          estate: '奥博拉赫庄园',
          altitude: '2200-2300m',
          process: '蜜处理',
          variety: '绿顶瑰夏',
        },
      ],
    });
  });

  it('does not treat green bean merchants as roasters', async () => {
    mockModelResponse(
      '{"name":"花魁","roaster":"裂豆师","notes":"G1","blendComponents":[{"origin":"埃塞俄比亚","process":"日晒"}]}'
    );
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegBytes], 'cover.jpg', { type: 'image/jpeg' });

    const response = await callRecognizeBean(file);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      name: '花魁',
      blendComponents: [{ origin: '埃塞俄比亚', process: '日晒' }],
      notes: 'G1 / 生豆商：裂豆师',
    });
  });

  it('rejects an allowed declaration when the bytes are not an image', async () => {
    const file = new File(['not an image'], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const response = await callRecognizeBean(file);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('文件内容与声明的类型不匹配，请上传有效图片');
  });
});
