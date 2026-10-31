import { API_CONFIG } from './shared/config';
import { fetchWithTimeout, isTimeoutError } from './shared/request';
import {
  normalizeRecognitionErrorMessage,
  validateRecognitionImageFile,
} from './shared/recognition';
import {
  BEAN_FIELD_DEFINITIONS,
  getBeanFieldDefinition,
  getEnabledBeanFieldIds,
  normalizeCoffeeBeanPayloadForFieldConfig,
  resolveBeanFieldConfig,
  type BeanFieldId,
} from '@/lib/coffee-beans/beanFields';
import type { AppSettings } from '@/lib/data/models';

export const DEFAULT_BEAN_RECOGNITION_API_BASE_URL = 'https://api.qnaigc.com/v1';
export const DEFAULT_BEAN_RECOGNITION_MODEL = 'doubao-seed-2.0-mini';
const DEPRECATED_BEAN_RECOGNITION_MODELS = new Set(['qwen-vl-max-2025-01-25']);
const BEAN_RECOGNITION_MAX_TOKENS = 1200;

export const DEFAULT_BEAN_RECOGNITION_PROMPT = `任务：从咖啡豆包装图片提取可见文字信息，返回可导入JSON。
输出：单豆返回object，多豆返回array。只输出JSON，不输出解释、markdown或代码块。

允许字段：
name 必填；roaster；capacity；remaining；price；roastDate；roastLevel；beanType；flavor；startDay；endDay；blendComponents；notes。

字段规则：
- 未明确可见或无法可靠推断的字段直接省略，不要输出空字符串/null。
- 图片里同一信息同时存在中文和英文时，优先输出中文；只有没有中文时才保留英文。
- name 优先按包装的视觉层级保留醒目的商品名、批次名或主标题；主标题同时出现英文名和中文名时都保留，例如 "OBRAJE 哥伦比亚奥博拉赫庄园"。name 允许与产国、产区、庄园、处理法、品种等结构化字段合理重叠，不要因为某段文字也能写入字段就从主标题机械删除。不要把正文中的产地、处理法或风味词额外拼接进 name；只有包装没有明确主标题时，才用最醒目的可见专名生成保守的备用名称。
- roaster 输出品牌短名；中文品牌明显时优先短中文名，例如 "柯林"、"辛鹿"。
- 生豆商、进口商、供应商不是 roaster；应写入 notes，例如 "生豆商：裂豆师"。
- capacity/remaining/price/startDay/endDay 只输出数字，不带单位；capacity 从净含量、规格、克数提取，startDay/endDay 从赏味期、养豆天数提取。
- roastDate 仅在图片明确出现烘焙日期/生产日期且能读出月日时填写 YYYY-MM-DD；缺年份补2026；看不清、默认01-01、非法日期都不要填。
- roastLevel 只用：极浅烘焙/浅度烘焙/中浅烘焙/中度烘焙/中深烘焙/深度烘焙。
- beanType 只用 filter/espresso/omni；拼配、深烘或大包装通常为 espresso；标注全能为 omni；否则默认 filter。
- flavor 为字符串数组。
- blendComponents 必须是“对象数组”，严禁输出字符串数组；每个对象只能使用最终字段约束允许的键。estate 只写咖啡庄园/农场，processingStation 只写处理站/水洗站（Station/Washing Station），两者不得混用。咖啡品种编号如 74158 可以放入 variety。严禁写 blenderComponents、components、blend_components。
- 只有明确拼配或多个产地/处理法时才输出多个 blendComponents；单品包装中品种单独成行时，合入同一个 component，不要为了品种另起 component。同一个品种不要重复成多个对象，也不要在 variety 中重复书写，例如 Oma 157 不要写成 "Oma 157 Oma 157"。Oma 157 这类字母+数字是品种；1931/批次1931 是批次，写入 notes。
- 产地与处理法按图片表格或文本顺序一一配对；产地/处理法不要放入 notes。
- notes 只放规范补充信息，例如批次、海拔、生豆商、系列；多条内容用 / 分隔；不要写物流、促销、包装技术、锁鲜技术、人物背书等广告信息。
- 不编造，不输出上述字段以外的键。

blendComponents 形状示例：
{"blendComponents":[{"origin":"埃塞俄比亚","estate":"某庄园","processingStation":"博纳","process":"水洗","variety":"74158"}]}
不要这样输出：
{"blendComponents":["埃塞俄比亚","博纳","水洗","74158"]}`;

export interface CustomBeanRecognitionConfig {
  enabled: boolean;
  apiBaseUrl: string;
  apiKey?: string;
  model: string;
  prompt: string;
}

export type BeanRecognitionFieldSettings = Pick<
  AppSettings,
  'beanFieldConfig' | 'showEstateField'
>;

export function buildBeanRecognitionPrompt(
  basePrompt: string = DEFAULT_BEAN_RECOGNITION_PROMPT,
  fieldSettings?: BeanRecognitionFieldSettings | null
): string {
  const config = resolveBeanFieldConfig(fieldSettings);
  const enabledFieldIds = getEnabledBeanFieldIds(config);
  const enabledFieldSet = new Set(enabledFieldIds);
  const disabledFields = BEAN_FIELD_DEFINITIONS.filter(
    definition => !enabledFieldSet.has(definition.id)
  );
  const allowedFields = enabledFieldIds.join('/') || '无';
  const allowedFieldLabels = enabledFieldIds
    .map(id => `${id}=${getBeanFieldDefinition(id).label}`)
    .join('；');
  const disabledFieldLabels = disabledFields
    .map(definition => definition.label)
    .join('、');
  const structuredOriginFields: BeanFieldId[] = [
    'country',
    'region',
    'estate',
    'processingStation',
    'altitude',
  ];
  const enabledStructuredOriginLabels = structuredOriginFields
    .filter(id => enabledFieldSet.has(id))
    .map(id => getBeanFieldDefinition(id).label)
    .join('、');

  return `${basePrompt.trim()}

最终咖啡豆字段约束（必须优先于上文和用户自定义提示词）：
- blendComponents 每个对象只允许输出这些成分字段：${allowedFields}；字段含义：${allowedFieldLabels || '无'}。
- 不在允许列表里的成分信息不要写入 blendComponents；如果图片中明确可见，写入 notes，例如 ${disabledFieldLabels ? `${disabledFieldLabels} 写入 notes` : '未启用字段写入 notes'}。
- origin 是未结构化的“产地概括”，只有允许 origin 时才输出；不要把 origin 当成产国。
- ${enabledStructuredOriginLabels ? `已启用精细产地字段：${enabledStructuredOriginLabels}；能明确区分时分别写入对应字段。` : '未启用精细产地字段；产国、产区、庄园、处理站、海拔不要写入 blendComponents。'}
- estate 仅表示庄园/农场，processingStation 仅表示处理站/水洗站；名称含“站”、“Station”或“Washing Station”时优先判定为处理站，不要写入 estate。
- batch 是批次，altitude 是海拔；只有对应字段启用时才写入 blendComponents，否则写入 notes。
- 已启用字段优先写入 blendComponents，不要同时重复写入 notes；name 是包装展示标题，与结构化字段合理重叠不算重复。
- 严禁输出未允许的 blendComponents 键。`;
}

export function resolveBeanRecognitionModel(model?: string): string {
  const trimmed = model?.trim() || '';
  if (!trimmed || DEPRECATED_BEAN_RECOGNITION_MODELS.has(trimmed)) {
    return DEFAULT_BEAN_RECOGNITION_MODEL;
  }
  return trimmed;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      if (typeof data !== 'string' || !data.startsWith('data:')) {
        reject(new Error('图片读取失败'));
        return;
      }
      resolve(data);
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

function extractJsonPayload(raw: string): unknown {
  let content = raw.trim();
  if (content.startsWith('```json')) {
    content = content.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (content.startsWith('```')) {
    content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(content);
}

type RecognizedBeanRecord = Record<string, unknown>;
const BLEND_COMPONENT_FIELDS = [
  'origin',
  'country',
  'region',
  'estate',
  'processingStation',
  'altitude',
  'process',
  'batch',
  'variety',
] as const;

function isRecord(value: unknown): value is RecognizedBeanRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeComponentText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().toLowerCase()
    : '';
}

function collapseRepeatedText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const tokens = normalized.split(' ');
  if (tokens.length < 2 || tokens.length % 2 !== 0) return normalized;

  const midpoint = tokens.length / 2;
  const first = tokens.slice(0, midpoint).join(' ');
  const second = tokens.slice(midpoint).join(' ');
  return first.toLowerCase() === second.toLowerCase() ? first : normalized;
}

function extractNamedVarietyFromName(name: unknown): string {
  if (typeof name !== 'string') return '';
  const match = name.match(/\b((?:Oma|SL)\s*-?\s*\d{2,4})\b/i);
  return match
    ? match[1]
        .replace(/\s*-\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

function getComponentKeys(component: RecognizedBeanRecord): string[] {
  return BLEND_COMPONENT_FIELDS.filter(key => {
    const value = component[key];
    return typeof value === 'string' && value.trim();
  });
}

function normalizeBlendComponentDuplicates(
  components: unknown,
  beanName?: unknown
): RecognizedBeanRecord[] | undefined {
  if (!Array.isArray(components)) return undefined;

  const namedVariety = extractNamedVarietyFromName(beanName);
  const nextComponents = components.filter(isRecord).map(component => {
    const next = { ...component };
    if (typeof next.variety === 'string') {
      next.variety = collapseRepeatedText(next.variety);
    }
    if (
      namedVariety &&
      /^\d{4,6}$/.test(normalizeComponentText(next.variety))
    ) {
      next.variety = namedVariety;
    }
    return next;
  });
  const removedIndexes = new Set<number>();

  nextComponents.forEach((component, index) => {
    const componentKeys = getComponentKeys(component);
    if (componentKeys.length !== 1 || componentKeys[0] !== 'variety') {
      return;
    }

    const variety = component.variety;
    const normalizedVariety = normalizeComponentText(variety);
    const duplicatedByCompleteComponent = nextComponents.some(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        !removedIndexes.has(candidateIndex) &&
        normalizeComponentText(candidate.variety) === normalizedVariety &&
        getComponentKeys(candidate).some(key => key !== 'variety')
    );

    if (duplicatedByCompleteComponent) {
      removedIndexes.add(index);
      return;
    }

    const mergeTargets = nextComponents
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(
        ({ candidate, candidateIndex }) =>
          candidateIndex !== index &&
          !removedIndexes.has(candidateIndex) &&
          !candidate.variety &&
          getComponentKeys(candidate).some(key => key !== 'variety')
      );

    if (mergeTargets.length === 1) {
      mergeTargets[0].candidate.variety = variety;
      removedIndexes.add(index);
    }
  });

  const seenSignatures = new Set<string>();
  const normalizedComponents = nextComponents.filter((component, index) => {
    if (removedIndexes.has(index)) return false;

    const componentKeys = getComponentKeys(component);
    if (componentKeys.length === 0) return false;

    const signature = componentKeys
      .map(key => `${key}:${normalizeComponentText(component[key])}`)
      .join('|');
    if (seenSignatures.has(signature)) return false;

    seenSignatures.add(signature);
    return true;
  });

  return normalizedComponents.length > 0 ? normalizedComponents : undefined;
}

function normalizeRecognizedBean(bean: unknown): unknown {
  if (!isRecord(bean)) return bean;

  const normalizedBean = { ...bean };
  const blendComponents = normalizeBlendComponentDuplicates(
    normalizedBean.blendComponents,
    normalizedBean.name
  );

  if (blendComponents) {
    normalizedBean.blendComponents = blendComponents;
  } else if (Array.isArray(normalizedBean.blendComponents)) {
    delete normalizedBean.blendComponents;
  }

  return normalizedBean;
}

export function normalizeRecognizedBeanPayload(
  payload: unknown,
  fieldSettings?: BeanRecognitionFieldSettings | null
): unknown {
  const normalizedPayload = Array.isArray(payload)
    ? payload.map(normalizeRecognizedBean)
    : normalizeRecognizedBean(payload);

  return normalizeCoffeeBeanPayloadForFieldConfig(
    normalizedPayload,
    fieldSettings
  );
}

async function recognizeBeanImageWithCustomAPI(
  imageFile: File,
  customConfig: CustomBeanRecognitionConfig,
  fieldSettings?: BeanRecognitionFieldSettings | null
): Promise<unknown> {
  try {
    const baseUrl = customConfig.apiBaseUrl.trim().replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('实验性识别已启用，但未配置 API 地址');
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      throw new Error('实验性 API 地址必须以 http:// 或 https:// 开头');
    }
    const model = resolveBeanRecognitionModel(customConfig.model);

    const endpoint = `${baseUrl}/chat/completions`;
    const imageUrl = await fileToDataUrl(imageFile);

    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(customConfig.apiKey?.trim()
          ? { Authorization: `Bearer ${customConfig.apiKey.trim()}` }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: buildBeanRecognitionPrompt(
              customConfig.prompt,
              fieldSettings
            ),
          },
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: imageUrl } }],
          },
        ],
        temperature: 0,
        max_tokens: BEAN_RECOGNITION_MAX_TOKENS,
        thinking: {
          type: 'disabled',
        },
        response_format: { type: 'json_object' },
      }),
      timeoutMs: API_CONFIG.timeoutMs,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `实验性识别请求失败 (${response.status})${errorText ? `: ${errorText.slice(0, 140)}` : ''}`
      );
    }

    const result = await response.json();

    const content = result?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      return normalizeRecognizedBeanPayload(
        extractJsonPayload(content),
        fieldSettings
      );
    }
    if (Array.isArray(content)) {
      const merged = content
        .map(part => (typeof part?.text === 'string' ? part.text : ''))
        .join('')
        .trim();
      if (merged) {
        return normalizeRecognizedBeanPayload(
          extractJsonPayload(merged),
          fieldSettings
        );
      }
    }

    if (result?.data !== undefined) {
      return normalizeRecognizedBeanPayload(result.data, fieldSettings);
    }

    if (Array.isArray(result) || (result && typeof result === 'object')) {
      return normalizeRecognizedBeanPayload(result, fieldSettings);
    }

    throw new Error('实验性识别返回格式不支持，请检查 API 兼容性');
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error(
        `实验性识别超时（>${Math.floor(API_CONFIG.timeoutMs / 1000)}s），可更换模型或稍后重试`
      );
    }
    if (error instanceof Error) {
      throw new Error(normalizeRecognitionErrorMessage(error.message));
    }
    throw error;
  }
}

// 识别咖啡豆图片（非流式版本）
export async function recognizeBeanImage(
  imageFile: File,
  onProgress?: (chunk: string) => void,
  customConfig?: CustomBeanRecognitionConfig,
  fieldSettings?: BeanRecognitionFieldSettings | null
): Promise<unknown> {
  // 验证文件安全性
  validateRecognitionImageFile(imageFile);

  if (customConfig?.enabled) {
    return recognizeBeanImageWithCustomAPI(
      imageFile,
      customConfig,
      fieldSettings
    );
  }

  const apiUrl = `${API_CONFIG.baseURL}/api/recognize-bean`;

  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append(
    'beanFieldConfig',
    JSON.stringify(resolveBeanFieldConfig(fieldSettings))
  );

  try {
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        Accept: 'application/json', // 请求非流式响应
      },
      timeoutMs: API_CONFIG.timeoutMs,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      throw new Error(error.error || `请求失败: ${response.status}`);
    }

    // 非流式响应处理
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '识别失败');
    }

    return normalizeRecognizedBeanPayload(result.data, fieldSettings);
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      throw new Error('API 服务未配置，请检查 EdgeOne Functions 部署状态');
    }

    if (
      error instanceof TypeError &&
      error.message.includes('Failed to fetch')
    ) {
      throw new Error('请求失败，请检查网络连接或尝试更新应用');
    }

    if (isTimeoutError(error)) {
      throw new Error(
        `识别超时（>${Math.floor(API_CONFIG.timeoutMs / 1000)}s），请稍后重试`
      );
    }

    if (error instanceof Error) {
      throw new Error(normalizeRecognitionErrorMessage(error.message));
    }

    throw error;
  }
}

export async function testCustomBeanRecognitionConfig(
  customConfig: CustomBeanRecognitionConfig
): Promise<{ endpoint: string; model: string; durationMs: number }> {
  try {
    const baseUrl = customConfig.apiBaseUrl.trim().replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('请先填写 API Base URL');
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      throw new Error('API 地址需以 http:// 或 https:// 开头');
    }
    const model = resolveBeanRecognitionModel(customConfig.model);

    const endpoint = `${baseUrl}/chat/completions`;
    const modelsEndpoint = `${baseUrl}/models`;
    const startAt = Date.now();

    // 1) 先测试鉴权与连通性（/models 更快且不依赖视觉推理）
    const modelsResponse = await fetchWithTimeout(modelsEndpoint, {
      method: 'GET',
      headers: {
        ...(customConfig.apiKey?.trim()
          ? { Authorization: `Bearer ${customConfig.apiKey.trim()}` }
          : {}),
      },
      timeoutMs: 20000,
    });

    if (!modelsResponse.ok) {
      const errorText = await modelsResponse.text().catch(() => '');
      throw new Error(
        `连接测试失败 (${modelsResponse.status})${errorText ? `: ${errorText.slice(0, 140)}` : ''}`
      );
    }

    const modelsData = await modelsResponse.json().catch(() => null);
    const modelList: string[] = Array.isArray(modelsData?.data)
      ? modelsData.data
          .map((item: { id?: string }) => item?.id)
          .filter((id: unknown): id is string => typeof id === 'string')
      : [];

    if (modelList.length > 0 && !modelList.includes(model)) {
      const recommendations = modelList
        .filter(id => id.toLowerCase().includes('ocr') || id.includes('Paddle'))
        .slice(0, 3);
      throw new Error(
        recommendations.length > 0
          ? `模型不存在：${model}，可尝试：${recommendations.join(' / ')}`
          : `模型不存在：${model}`
      );
    }

    // 2) 再做一次极简 chat/completions 探测，确认该模型能被调起
    // 对视觉模型仍可能较慢，给更宽裕超时并提供明确报错
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(customConfig.apiKey?.trim()
          ? { Authorization: `Bearer ${customConfig.apiKey.trim()}` }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ok' }],
        temperature: 0,
        max_tokens: 8,
        thinking: {
          type: 'disabled',
        },
      }),
      timeoutMs: 60000,
    });

    const durationMs = Date.now() - startAt;

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `模型调用测试失败 (${response.status})${errorText ? `: ${errorText.slice(0, 140)}` : ''}`
      );
    }

    const data = await response.json().catch(() => null);
    const hasChoices = Array.isArray(data?.choices) && data.choices.length > 0;
    if (!hasChoices) {
      throw new Error('模型调用返回异常：缺少 choices 字段');
    }

    return { endpoint, model, durationMs };
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error('测试超时：请检查网络、API 网关可用性，或稍后重试');
    }
    if (error instanceof Error) {
      throw new Error(normalizeRecognitionErrorMessage(error.message));
    }
    throw error;
  }
}
