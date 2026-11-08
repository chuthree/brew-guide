import { describe, expect, it, vi } from 'vitest';
import {
  clarifyBeanRecognitionNames,
  normalizeBeanRecognitionResult,
  parseBeanRecognitionResponse,
  recognizeBeanImages,
  type RecognizeBeanImagesOptions,
} from './beanRecognition';

const images = [
  { id: 'front', dataUrl: 'data:image/jpeg;base64,/9j/4A==' },
  { id: 'back', dataUrl: 'data:image/png;base64,aGVsbG8=' },
];
const candidate = (bean: Record<string, unknown>, extra = {}) => ({
  bean,
  sourceAttachmentIds: ['front'],
  selected: true,
  grouping: 'confirmed',
  ...extra,
});
const envelope = (...candidates: unknown[]) => ({
  route: 'import',
  candidates,
});

describe('structured bean recognition contract', () => {
  it('preserves full brands and requires only a name', () => {
    const result = normalizeBeanRecognitionResult(
      envelope(
        candidate({ name: 'Tanzania Peaberry', roaster: 'Msumbi Coffees' }),
        candidate({ name: 'Another bag' }, { sourceAttachmentIds: ['back'] })
      ),
      images
    );
    expect(result.blockers).toEqual([]);
    expect(result.candidates.map(item => item.bean)).toEqual([
      { name: 'Tanzania Peaberry', roaster: 'Msumbi Coffees' },
      { name: 'Another bag' },
    ]);
    expect(result.candidates.every(item => item.blockers.length === 0)).toBe(
      true
    );
  });

  it('keeps a conservative visible heading and never invents unknown specs', () => {
    const result = normalizeBeanRecognitionResult(
      envelope(
        candidate({
          name: 'Msumbi Coffees',
          roaster: 'unknown',
          capacity: '250g / 500g',
          remaining: '未知',
          roastDate: '2026-02-30',
          beanType: 'filter/espresso',
          isFrozen: true,
          id: 'invented',
          image: 'https://example.com/forged.jpg',
        })
      ),
      images
    );
    expect(result.candidates[0]).toEqual({
      bean: { name: 'Msumbi Coffees' },
      sourceAttachmentIds: ['front'],
      selected: true,
      blockers: [],
    });
  });

  it('reports missing names without losing other observed fields', () => {
    const result = normalizeBeanRecognitionResult(
      envelope(
        candidate({
          name: 'unknown',
          roaster: 'Msumbi Coffees',
          capacity: 250,
        })
      ),
      images
    );
    expect(result.candidates[0].bean).toEqual({
      roaster: 'Msumbi Coffees',
      capacity: '250',
    });
    expect(result.candidates[0].blockers.map(item => item.code)).toEqual([
      'missing_name',
    ]);
  });

  it('groups confirmed front and back once, keeping exact input IDs', () => {
    const result = normalizeBeanRecognitionResult(
      envelope(
        candidate(
          { name: 'One bag' },
          { sourceAttachmentIds: ['front', 'back'] }
        )
      ),
      images
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].sourceAttachmentIds).toEqual(['front', 'back']);
    expect(result.candidates[0].blockers).toEqual([]);
  });

  it('blocks partial multi-image output without inventing the missing beans', () => {
    const result = normalizeBeanRecognitionResult(
      envelope(candidate({ name: 'Only one recognized' })),
      [...images, { id: 'third' }]
    );
    expect(result.blockers.map(blocker => blocker.code)).toEqual([
      'ambiguous_source',
    ]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].bean.name).toBe('Only one recognized');
  });

  it('counts unselected candidates when verifying complete image coverage', () => {
    const result = normalizeBeanRecognitionResult(
      envelope(
        candidate({ name: 'Selected' }),
        candidate(
          { name: 'Not selected' },
          { selected: false, sourceAttachmentIds: ['back'] }
        )
      ),
      images
    );
    expect(result.blockers).toEqual([]);
    expect(result.candidates.filter(item => item.selected)).toHaveLength(1);
  });

  it('keeps separate beans and explicit selection, including a shared photo', () => {
    const result = normalizeBeanRecognitionResult(
      envelope(
        candidate({ name: 'Left bag' }, { selected: false }),
        candidate({ name: 'Right bag' })
      ),
      images
    );
    expect(
      result.candidates
        .filter(item => item.selected)
        .map(item => item.bean.name)
    ).toEqual(['Right bag']);
    expect(result.candidates.map(item => item.sourceAttachmentIds)).toEqual([
      ['front'],
      ['front'],
    ]);
  });

  it.each([
    { sourceAttachmentIds: [] },
    { sourceAttachmentIds: ['wrong'] },
    { sourceAttachmentIds: ['front', 'invented'] },
    { sourceAttachmentIds: ['front', 'front'] },
    { sourceAttachmentIds: ['front', 'back'], grouping: undefined },
    { sourceAttachmentIds: ['front', 'back'], grouping: 'uncertain' },
  ])('blocks unverified or ambiguous photo associations: %j', extra => {
    const result = normalizeBeanRecognitionResult(
      envelope(candidate({ name: 'Bag' }, extra)),
      images
    );
    expect(result.candidates[0].blockers.map(item => item.code)).toEqual([
      'ambiguous_source',
    ]);
    expect(
      result.candidates[0].sourceAttachmentIds.every(id =>
        ['front', 'back'].includes(id)
      )
    ).toBe(true);
  });

  it('reuses configured field normalization, including disabled-field notes', () => {
    const result = normalizeBeanRecognitionResult(
      envelope(
        candidate({
          name: 'OBRAJE 哥伦比亚奥博拉赫庄园',
          roastLevel: 'medium light',
          blendComponents: [
            {
              country: '哥伦比亚',
              region: 'Nariño',
              estate: '奥博拉赫庄园',
              process: '蜜处理',
              variety: ['SL28/34', 'Geisha'],
              altitude: '2200 M.A.S.L',
              arbitrary: 'ignored',
            },
          ],
          flavor: ['橙花', '红糖', '橙花'],
        })
      ),
      images,
      'auto',
      {
        beanFieldConfig: {
          version: 1,
          fields: [
            { id: 'country', enabled: true, order: 0 },
            { id: 'region', enabled: true, order: 1 },
            { id: 'process', enabled: true, order: 2 },
            { id: 'variety', enabled: true, order: 3 },
          ],
        },
      }
    );
    expect(result.candidates[0].bean).toEqual({
      name: 'OBRAJE 哥伦比亚奥博拉赫庄园',
      roastLevel: '中浅烘焙',
      blendComponents: [
        {
          country: '哥伦比亚',
          region: 'Nariño',
          process: '蜜处理',
          variety: ['SL28/34', 'Geisha'],
        },
      ],
      flavor: ['橙花', '红糖'],
      notes: '庄园：奥博拉赫庄园 / 海拔：2200m',
    });
  });

  it('never upgrades analyze intent to import', () => {
    const result = normalizeBeanRecognitionResult(
      envelope(candidate({ name: 'Bag' })),
      images,
      'analyze'
    );
    expect(result.route).toBe('analyze');
  });

  it.each(['not_beans', 'chat', 'analyze'] as const)(
    'preserves %s routing',
    route => {
      expect(
        normalizeBeanRecognitionResult(
          { route, candidates: [] },
          images,
          'import'
        )
      ).toEqual({
        route,
        imagePolicy: 'default',
        candidates: [],
        blockers: [],
      });
    }
  );

  it.each([
    { name: 'Legacy bare object is not a classifier result' },
    {
      route: 'import',
      candidates: [{ bean: { name: 'No explicit selection' } }],
    },
    { route: 'not_beans', candidates: [candidate({ name: 'Contradiction' })] },
    { route: 'invented', candidates: [] },
    { route: 'import', candidates: [false] },
  ])('rejects malformed classifier responses: %j', payload => {
    const result = normalizeBeanRecognitionResult(payload, images);
    expect(result.route).toBe('uncertain');
    expect(result.candidates).toEqual([]);
    expect(result.blockers[0].code).toBe('invalid_response');
  });

  it('reports no selected beans and uncertain classification as blockers', () => {
    expect(
      normalizeBeanRecognitionResult(
        envelope(candidate({ name: 'Bag' }, { selected: false })),
        images
      ).blockers[0].code
    ).toBe('ambiguous_selection');
    expect(
      normalizeBeanRecognitionResult(
        { route: 'uncertain', candidates: [] },
        images
      ).blockers[0].code
    ).toBe('uncertain_subject');
  });

  it('reserves photo overrides for explicit text, never an image upload', () => {
    const payload = {
      ...envelope(candidate({ name: 'Bag' })),
      imagePolicy: 'include',
    };
    expect(normalizeBeanRecognitionResult(payload, images).imagePolicy).toBe(
      'default'
    );
    expect(
      normalizeBeanRecognitionResult(
        { ...payload, imagePolicyEvidence: '把照片也存上' },
        images,
        'auto',
        undefined,
        '把照片也存上'
      ).imagePolicy
    ).toBe('include');
    expect(
      normalizeBeanRecognitionResult(
        {
          ...payload,
          imagePolicy: 'exclude',
          imagePolicyEvidence: '不保存照片',
        },
        images,
        'auto',
        undefined,
        '加豆子但不保存照片'
      ).imagePolicy
    ).toBe('exclude');
    expect(
      normalizeBeanRecognitionResult(
        { ...payload, imagePolicy: 'invalid' },
        images,
        'auto',
        undefined,
        '添加豆子'
      ).imagePolicy
    ).toBe('default');
  });

  it.each([
    ['include', '添加这包豆子，一起保存照片', '一起保存照片'],
    ['include', '添加这两包豆，并保存这两张包装照片', '并保存这两张包装照片'],
    [
      'include',
      '添加这两包豆，并保存这两张包装照片',
      '添加这两包豆，并保存这两张包装照片',
    ],
    ['include', '创建一条豆子记录，并带上包装照片', '并带上包装照片'],
    ['include', '保存包装照片', '保存包装照片'],
    ['include', '保留原图', '保留原图'],
    ['include', '带上这张照片', '带上这张照片'],
    ['exclude', '添加这袋豆，不要保存照片', '不要保存照片'],
    ['exclude', '添加这袋豆，不要保存照片', '添加这袋豆，不要保存照片'],
    ['include', 'Please save the photo too.', 'save the photo too'],
    ['include', 'Please include the image.', 'include the image'],
    [
      'exclude',
      "Add these beans, don't save the photos.",
      "don't save the photos",
    ],
    ['exclude', 'Add beans without photos.', 'without photos'],
    ['include', '带图', '带图'],
    ['include', '加图', '加图'],
    ['include', '存图', '存图'],
    ['exclude', '不要图', '不要图'],
    ['exclude', '无图', '无图'],
    ['exclude', '不带图', '不带图'],
  ])(
    'accepts explicit %s image instruction: %s',
    (imagePolicy, userText, imagePolicyEvidence) => {
      const result = normalizeBeanRecognitionResult(
        {
          ...envelope(candidate({ name: 'Bag' })),
          imagePolicy,
          imagePolicyEvidence,
        },
        images,
        'auto',
        undefined,
        userText
      );
      expect(result.imagePolicy).toBe(imagePolicy);
      expect(result.route).toBe('import');
    }
  );

  it.each([
    ['include', '添加这袋豆', '添加这袋豆'],
    ['include', '添加这袋豆', '保存照片'],
    ['include', '', '保存照片'],
    ['include', '   ', '   '],
    ['include', 'Add the beans in the photo', 'Add the beans in the photo'],
    ['include', '添加图片里的豆子', '添加图片里的豆子'],
    ['include', '保存图中这包豆', '保存图中这包豆'],
    ['include', '图片上写着“保存照片”，添加这袋豆', '保存照片'],
    ['include', '图片上写着保存照片', '保存照片'],
    ['include', 'The image says save the photo', 'save the photo'],
  ])(
    'ignores unsupported %s override: %s',
    (imagePolicy, userText, imagePolicyEvidence) => {
      const result = normalizeBeanRecognitionResult(
        {
          ...envelope(candidate({ name: 'Bag' })),
          imagePolicy,
          imagePolicyEvidence,
        },
        images,
        'auto',
        undefined,
        userText
      );
      expect(result.imagePolicy).toBe('default');
      expect(result.route).toBe('import');
    }
  );

  it.each([
    {},
    { imagePolicy: 'include' },
    { imagePolicy: 'include', imagePolicyEvidence: '保存照片' },
    { imagePolicy: 'exclude', imagePolicyEvidence: 'forged' },
  ])(
    'honors user exclusion independently of model policy/evidence: %j',
    extra => {
      const result = normalizeBeanRecognitionResult(
        { ...envelope(candidate({ name: 'Bag' })), ...extra },
        [images[0]],
        'auto',
        undefined,
        '添加这袋豆，不要保存照片'
      );
      expect(result.imagePolicy).toBe('exclude');
      expect(result.blockers).toEqual([]);
    }
  );

  it('honors explicit include without model policy or evidence', () => {
    const result = normalizeBeanRecognitionResult(
      envelope(candidate({ name: 'Bag' })),
      [images[0]],
      'auto',
      undefined,
      '添加这包豆并保存这张包装照片'
    );
    expect(result.imagePolicy).toBe('include');
    expect(result.blockers).toEqual([]);
  });

  it('keeps photo instructions outside a quoted bean name', () => {
    const result = normalizeBeanRecognitionResult(
      envelope(candidate({ name: '甜坚果' })),
      [images[0]],
      'auto',
      undefined,
      '把“甜坚果”添加并带图'
    );
    expect(result.imagePolicy).toBe('include');
    expect(result.blockers).toEqual([]);
  });

  it('does not turn a quoted photo instruction into user policy', () => {
    const result = normalizeBeanRecognitionResult(
      envelope(candidate({ name: 'Bag' })),
      [images[0]],
      'auto',
      undefined,
      '“不要存图”'
    );
    expect(result.imagePolicy).toBe('default');
    expect(result.blockers).toEqual([]);
  });

  it.each([
    '不一定保存照片',
    '不要只保存照片',
    '不要不保存照片',
    'Should I save the photo?',
    '保存照片但不要封面',
    '保存照片，不要图',
    '不要保存“照片”',
  ])(
    'blocks uncertain photo instructions instead of falling back to a save preference: %s',
    userText => {
      const result = normalizeBeanRecognitionResult(
        envelope(candidate({ name: 'Bag' })),
        [images[0]],
        'auto',
        undefined,
        userText
      );
      expect(result.blockers.map(blocker => blocker.code)).toEqual([
        'ambiguous_selection',
      ]);
    }
  );

  it('shares parsing for code fences, content arrays and official data wrappers', () => {
    const result = envelope(candidate({ name: 'Bag' }));
    expect(
      parseBeanRecognitionResponse({
        choices: [
          {
            message: {
              content: `\`\`\`json\n${JSON.stringify(result)}\n\`\`\``,
            },
          },
        ],
      })
    ).toEqual(result);
    expect(
      parseBeanRecognitionResponse({
        choices: [{ message: { content: [{ text: JSON.stringify(result) }] } }],
      })
    ).toEqual(result);
    expect(parseBeanRecognitionResponse({ data: result })).toEqual(result);
  });
});

describe('structured image recognition transport', () => {
  function options(payload: unknown = envelope(candidate({ name: 'Bag' }))) {
    const fetchModel = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(payload) } }],
          })
        )
    );
    const request: RecognizeBeanImagesOptions = {
      images,
      intent: 'auto',
      userText: '只添加右边这袋',
      config: {
        baseURL: 'https://current-provider.example/v1/',
        apiKey: 'offline-test-placeholder',
        model: 'qwen-vl-max-2025-01-25',
      },
      fetchModel,
    };
    return { fetchModel, request };
  }

  it('uses only injected provider, model and transport, carrying intent and IDs', async () => {
    const { request, fetchModel } = options();
    const result = await recognizeBeanImages(request);
    expect(result.route).toBe('import');
    expect(fetchModel).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchModel.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(endpoint).toBe(
      'https://current-provider.example/v1/chat/completions'
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('qwen-vl-max-2025-01-25');
    expect(body.messages[0].content).toContain('完整多词品牌必须保留');
    expect(body.messages[0].content).toContain('已有豆子的修改/配图');
    expect(body.messages[1].content[0].text).toBe(
      JSON.stringify({ intent: 'auto', userText: '只添加右边这袋' })
    );
    expect(
      body.messages[1].content.filter(
        (part: { type: string }) => part.type === 'image_url'
      )
    ).toHaveLength(2);
    expect(body.messages[1].content[1].text).toBe(
      '{"sourceAttachmentId":"front"}'
    );
    expect(body.messages[1].content[3].text).toBe(
      '{"sourceAttachmentId":"back"}'
    );
  });

  it('sends only a page-kind routing hint for an existing record', async () => {
    const { request, fetchModel } = options({ route: 'chat', candidates: [] });
    request.pageContext = { kind: 'bean' };
    request.userText = '补上照片';
    expect((await recognizeBeanImages(request)).route).toBe('chat');
    const [, init] = fetchModel.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(JSON.parse(body.messages[1].content[0].text)).toEqual({
      intent: 'auto',
      userText: '补上照片',
      pageContext: { kind: 'bean' },
    });
  });

  it.each([
    { baseURL: '', model: 'vision' },
    { baseURL: 'https://example.com/v1', model: '' },
  ])('does not fallback for missing config: %j', config => {
    const { request, fetchModel } = options();
    request.config = config;
    return expect(recognizeBeanImages(request))
      .rejects.toThrow('请先配置')
      .then(() => expect(fetchModel).not.toHaveBeenCalled());
  });

  it('does not make a request for invalid attachment IDs', async () => {
    const { request, fetchModel } = options();
    request.images = [images[0], images[0]];
    await expect(recognizeBeanImages(request)).rejects.toThrow('图片缺失');
    expect(fetchModel).not.toHaveBeenCalled();
  });

  it('fails closed on malformed model JSON', async () => {
    const { request } = options();
    request.fetchModel = async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{broken' } }] })
      );
    expect((await recognizeBeanImages(request)).blockers[0].code).toBe(
      'invalid_response'
    );
  });

  it('does not approve a partial response even when its JSON parses', async () => {
    const { request } = options();
    request.fetchModel = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: 'length',
              message: {
                content: JSON.stringify(
                  envelope(candidate({ name: 'First bag only' }))
                ),
              },
            },
          ],
        })
      );
    await expect(recognizeBeanImages(request)).rejects.toThrow('未完整返回');
  });

  it('honors cancellation and does not echo provider error bodies', async () => {
    const { request, fetchModel } = options();
    request.signal = AbortSignal.abort();
    await expect(recognizeBeanImages(request)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetchModel).not.toHaveBeenCalled();
    request.signal = undefined;
    request.fetchModel = async () =>
      new Response('private request body', { status: 401 });
    await expect(recognizeBeanImages(request)).rejects.toThrow(
      '图片识别请求失败 (401)'
    );
  });
});

describe('missing-name clarification', () => {
  const candidates = normalizeBeanRecognitionResult(
    envelope(
      candidate({ roaster: 'Msumbi Coffees', capacity: 250 }),
      candidate({ name: 'Known bag', roaster: 'Do not change' })
    ),
    images
  ).candidates;

  const request = (payload: unknown, userText = '这袋就叫坦桑尼亚圆豆吧') => ({
    candidates,
    userText,
    config: {
      baseURL: 'https://current-provider.example/v1',
      model: 'current-model',
    },
    fetchModel: vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(payload) } }],
          })
        )
    ),
  });

  it('accepts normal language without asking for a label or re-upload', async () => {
    const options = request({
      route: 'clarify',
      names: [
        {
          candidateIndex: 0,
          name: '坦桑尼亚圆豆',
          roaster: 'forged',
          sourceAttachmentIds: ['forged'],
        },
      ],
    });
    expect(await clarifyBeanRecognitionNames(options)).toEqual({
      route: 'clarify',
      names: [{ candidateIndex: 0, name: '坦桑尼亚圆豆' }],
    });
    expect(candidates[0].bean).toEqual({
      roaster: 'Msumbi Coffees',
      capacity: '250',
    });
    const [endpoint, init] = options.fetchModel.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(endpoint).toBe(
      'https://current-provider.example/v1/chat/completions'
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('current-model');
    expect(JSON.stringify(body)).not.toContain('data:image');
    expect(JSON.parse(body.messages[1].content).candidates).toEqual([
      { candidateIndex: 0, bean: candidates[0].bean },
    ]);
  });

  it.each(['chat', 'cancel', 'replan'] as const)(
    'returns %s without applying proposed names',
    async route => {
      expect(
        await clarifyBeanRecognitionNames(
          request({
            route,
            names: [{ candidateIndex: 0, name: '坦桑尼亚圆豆' }],
          })
        )
      ).toEqual({ route, names: [] });
    }
  );

  it('does not fill names into an obsolete plan after additional limits', async () => {
    const options = request(
      { route: 'replan', names: [{ candidateIndex: 0, name: 'Mbinga' }] },
      '名字叫 Mbinga，只加这一包'
    );
    expect(await clarifyBeanRecognitionNames(options)).toEqual({
      route: 'replan',
      names: [],
    });
    expect(candidates[0].bean).toEqual({
      roaster: 'Msumbi Coffees',
      capacity: '250',
    });
    const [, init] = options.fetchModel.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string).messages[0].content).toContain(
      '只有用户纯补名称时才能 clarify'
    );
  });

  it('stops photo-plan changes even if the model would return only a name', async () => {
    const options = request(
      { route: 'clarify', names: [{ candidateIndex: 0, name: 'Mbinga' }] },
      '名字叫 Mbinga，只加这一包，不保存照片'
    );
    expect(await clarifyBeanRecognitionNames(options)).toEqual({
      route: 'replan',
      names: [],
    });
    expect(options.fetchModel).not.toHaveBeenCalled();
  });

  it('keeps unknown names unresolved', async () => {
    expect(
      await clarifyBeanRecognitionNames(
        request({ route: 'clarify', names: [] }, '不知道叫什么')
      )
    ).toEqual({ route: 'clarify', names: [] });
  });

  it.each([
    [{ candidateIndex: 1, name: '坦桑尼亚圆豆' }],
    [{ candidateIndex: 99, name: '坦桑尼亚圆豆' }],
    [{ candidateIndex: 0, name: 'Invented name' }],
    [
      { candidateIndex: 0, name: '坦桑尼亚圆豆' },
      { candidateIndex: 0, name: '坦桑尼亚圆豆' },
    ],
  ])(
    'rejects overwrites, invalid targets and invented names',
    async (...names) => {
      await expect(
        clarifyBeanRecognitionNames(request({ route: 'clarify', names }))
      ).rejects.toThrow('无法确认');
    }
  );

  it('does not ask a model to clarify known or unselected names', async () => {
    const options = request({ route: 'clarify', names: [] });
    options.candidates = [candidates[1], { ...candidates[0], selected: false }];
    expect(await clarifyBeanRecognitionNames(options)).toEqual({
      route: 'chat',
      names: [],
    });
    expect(options.fetchModel).not.toHaveBeenCalled();
  });
});
