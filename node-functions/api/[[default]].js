import { METHOD_RECOGNITION_PROMPT } from '../../src/lib/constants/methodRecognitionPrompt.js';
import { normalizeRecognitionErrorMessage } from '../../src/lib/api/shared/recognitionErrors.js';

export { normalizeRecognitionErrorMessage };

const API_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
];

const API_ALLOWED_METHODS = ['GET', 'POST', 'OPTIONS'];

const FIRST_PARTY_APP_ORIGINS = [
  'https://app',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
];

const IMAGE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];

const IMAGE_MIME_TYPE_BY_EXTENSION = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  hif: 'image/heif',
};

const IMAGE_ALLOWED_TYPE_SET = new Set(IMAGE_ALLOWED_TYPES);

const QINIU_CHAT_COMPLETIONS = 'https://api.qnaigc.com/v1/chat/completions';
const MODEL_REQUEST_TIMEOUT_MS = 105000;
const DEFAULT_VISION_RECOGNITION_MODEL = 'doubao-seed-2.0-mini';
const BEAN_RECOGNITION_MAX_TOKENS = 1200;

const BEAN_RECOGNITION_PROMPT = `任务：从咖啡豆包装图片提取可见文字信息，返回可导入JSON。
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

const BEAN_COMPONENT_FIELD_DEFINITIONS = [
  ['origin', '产地'],
  ['country', '产国'],
  ['region', '产区'],
  ['estate', '庄园'],
  ['processingStation', '处理站'],
  ['altitude', '海拔'],
  ['process', '处理法'],
  ['batch', '批次'],
  ['variety', '品种'],
];
const BEAN_COMPONENT_FIELD_IDS = BEAN_COMPONENT_FIELD_DEFINITIONS.map(
  ([id]) => id
);
const DEFAULT_BEAN_FIELD_CONFIG = {
  version: 1,
  fields: BEAN_COMPONENT_FIELD_IDS.map((id, index) => ({
    id,
    enabled: ['origin', 'process', 'variety'].includes(id),
    order: index,
  })),
};

function normalizeBeanFieldConfig(rawConfig) {
  if (!rawConfig || !Array.isArray(rawConfig.fields)) {
    return DEFAULT_BEAN_FIELD_CONFIG;
  }
  const configured = new Map(
    rawConfig.fields
      .filter(field => BEAN_COMPONENT_FIELD_IDS.includes(field?.id))
      .map(field => [field.id, field.enabled !== false])
  );
  if (configured.size === 0) return DEFAULT_BEAN_FIELD_CONFIG;

  return {
    version: 1,
    fields: BEAN_COMPONENT_FIELD_IDS.map((id, index) => ({
      id,
      enabled: configured.get(id) ?? false,
      order: rawConfig.fields.find(field => field?.id === id)?.order ?? index,
    })).sort((left, right) => left.order - right.order),
  };
}

function buildBeanRecognitionPrompt(fieldConfig) {
  const config = normalizeBeanFieldConfig(fieldConfig);
  const enabledFields = config.fields
    .filter(field => field.enabled)
    .map(field => field.id);
  const enabledSet = new Set(enabledFields);
  const fieldLabels = BEAN_COMPONENT_FIELD_DEFINITIONS.filter(([id]) =>
    enabledSet.has(id)
  )
    .map(([id, label]) => `${id}=${label}`)
    .join('；');
  const disabledLabels = BEAN_COMPONENT_FIELD_DEFINITIONS.filter(
    ([id]) => !enabledSet.has(id)
  )
    .map(([, label]) => label)
    .join('、');

  return `${BEAN_RECOGNITION_PROMPT}

最终咖啡豆字段约束（必须优先于上文）：
- blendComponents 每个对象只允许输出这些成分字段：${enabledFields.join('/') || '无'}；字段含义：${fieldLabels || '无'}。
- 不在允许列表里的成分信息不要写入 blendComponents；如果图片中明确可见，写入 notes，例如 ${disabledLabels ? `${disabledLabels} 写入 notes` : '未启用字段写入 notes'}。
- origin 是未结构化的“产地概括”，只有允许 origin 时才输出；不要把 origin 当成产国。
- estate 仅表示庄园/农场，processingStation 仅表示处理站/水洗站；名称含“站”、“Station”或“Washing Station”时优先判定为处理站，不要写入 estate。
- batch 是批次，altitude 是海拔；只有对应字段启用时才写入 blendComponents，否则写入 notes。
- 已启用字段优先写入 blendComponents，不要同时重复写入 notes；name 是包装展示标题，与结构化字段合理重叠不算重复。
- 严禁输出未允许的 blendComponents 键。`;
}

const runtimeConfigCache = {
  allowedOriginsRaw: null,
  allowedOriginsParsed: { allowAll: true, list: [] },
};

function getAllowedOriginsConfig(env) {
  const value = (env?.ALLOWED_ORIGINS || '').trim();
  if (runtimeConfigCache.allowedOriginsRaw === value) {
    return runtimeConfigCache.allowedOriginsParsed;
  }

  let parsed;
  if (!value || value === '*') {
    parsed = { allowAll: true, list: [] };
  } else {
    parsed = {
      allowAll: false,
      list: Array.from(
        new Set([
          ...value
            .split(',')
            .map(item => item.trim())
            .filter(Boolean),
          ...FIRST_PARTY_APP_ORIGINS,
        ])
      ),
    };
  }

  runtimeConfigCache.allowedOriginsRaw = value;
  runtimeConfigCache.allowedOriginsParsed = parsed;
  return parsed;
}

function getQiniuApiKey(env) {
  const key = (env?.QINIU_API_KEY || '').trim();
  return key || null;
}

function isOriginAllowed(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const config = getAllowedOriginsConfig(env);
  if (config.allowAll) return true;
  return config.list.includes(origin);
}

function buildCorsHeaders(request, env) {
  const origin = request.headers.get('origin');
  const config = getAllowedOriginsConfig(env);
  const headers = new Headers({
    'Access-Control-Allow-Methods': API_ALLOWED_METHODS.join(', '),
    'Access-Control-Allow-Headers': API_ALLOWED_HEADERS.join(', '),
    'Access-Control-Max-Age': '86400',
  });

  if (config.allowAll) {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && config.list.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
  }

  return headers;
}

function withCors(request, env, response) {
  const headers = new Headers(response.headers || {});
  const corsHeaders = buildCorsHeaders(request, env);
  corsHeaders.forEach((value, key) => {
    headers.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(request, env, data, status = 200) {
  return withCors(
    request,
    env,
    new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
  );
}

function errorResponse(request, env, message, status = 500, extra = {}) {
  return jsonResponse(request, env, { error: message, ...extra }, status);
}

function noContentResponse(request, env) {
  return withCors(request, env, new Response(null, { status: 204 }));
}

function startsWithBytes(buffer, signature, offset = 0) {
  if (buffer.length < offset + signature.length) return false;
  return signature.every((byte, index) => buffer[offset + index] === byte);
}

function readAscii(buffer, start, end) {
  return buffer.subarray(start, end).toString('ascii');
}

function normalizeDeclaredImageMimeType(file) {
  const declaredType = (file.type || '').trim().toLowerCase();
  if (declaredType === 'image/jpg') return 'image/jpeg';
  if (IMAGE_ALLOWED_TYPE_SET.has(declaredType)) return declaredType;

  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension
    ? IMAGE_MIME_TYPE_BY_EXTENSION[extension] || declaredType
    : declaredType;
}

function detectImageMimeType(buffer) {
  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }

  if (
    startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return 'image/png';
  }

  if (
    startsWithBytes(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWithBytes(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }

  if (buffer.length >= 12 && readAscii(buffer, 4, 8) === 'ftyp') {
    const boxSize = buffer.readUInt32BE(0);
    const brandEnd = Math.min(
      buffer.length,
      boxSize >= 16 ? boxSize : buffer.length,
      64
    );
    const brands = new Set();
    for (let offset = 8; offset + 4 <= brandEnd; offset += 4) {
      const brand = readAscii(buffer, offset, offset + 4);
      if (/^[\x20-\x7e]{4}$/.test(brand)) {
        brands.add(brand);
      }
    }

    if (['avif', 'avis'].some(brand => brands.has(brand))) {
      return 'image/avif';
    }

    if (
      ['heic', 'heix', 'hevc', 'hevx', 'heis', 'heim'].some(brand =>
        brands.has(brand)
      )
    ) {
      return 'image/heic';
    }

    if (['mif1', 'msf1'].some(brand => brands.has(brand))) {
      return 'image/heif';
    }
  }

  return null;
}

function resolveImageMimeType(file, buffer) {
  const declaredType = normalizeDeclaredImageMimeType(file);
  const detectedType = detectImageMimeType(buffer);

  if (detectedType) {
    if (!IMAGE_ALLOWED_TYPE_SET.has(detectedType)) {
      throw new Error('不支持的文件类型，请上传 JPG、PNG、WebP 或 HEIF 图片');
    }
    return detectedType;
  }

  if (IMAGE_ALLOWED_TYPE_SET.has(declaredType)) {
    throw new Error('文件内容与声明的类型不匹配，请上传有效图片');
  }

  throw new Error('不支持的文件类型，请上传 JPG、PNG、WebP 或 HEIF 图片');
}

function stripCodeFence(content) {
  const text = (content || '').trim();
  if (text.startsWith('```json')) {
    return text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  }
  if (text.startsWith('```')) {
    return text.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }
  return text;
}

function timeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function callModelJSON({ url, apiKey, payload, timeoutMs = MODEL_REQUEST_TIMEOUT_MS }) {
  const { signal, clear } = timeoutSignal(timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    const bodyText = await response.text();
    let bodyJson = null;
    try {
      bodyJson = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      bodyJson = null;
    }

    if (!response.ok) {
      throw new Error(
        bodyJson?.error?.message ||
          bodyJson?.message ||
          `上游请求失败: ${response.status}`
      );
    }

    return bodyJson;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('模型服务响应超时，请稍后重试');
    }
    throw error;
  } finally {
    clear();
  }
}

function extractAssistantText(result) {
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(item => (typeof item?.text === 'string' ? item.text : ''))
      .join('');
  }
  return '';
}

function parseBeanResponse(aiText, fieldConfig = DEFAULT_BEAN_FIELD_CONFIG) {
  const payload = stripCodeFence(aiText);
  let beanData = JSON.parse(payload);
  const normalizedFieldConfig = normalizeBeanFieldConfig(fieldConfig);
  const enabledComponentKeys = new Set(
    normalizedFieldConfig.fields
      .filter(field => field.enabled)
      .map(field => field.id)
  );

  if (beanData && typeof beanData === 'object' && !Array.isArray(beanData)) {
    const possibleKeys = ['单豆', '多豆', '咖啡豆', 'beans', 'data'];
    for (const key of possibleKeys) {
      if (beanData[key]) {
        beanData = beanData[key];
        break;
      }
    }
  }

  const isValidDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  };

  const normalizeBean = bean => {
    const allowedBeanKeys = new Set([
      'name',
      'roaster',
      'capacity',
      'remaining',
      'price',
      'roastDate',
      'roastLevel',
      'beanType',
      'flavor',
      'startDay',
      'endDay',
      'blendComponents',
      'blenderComponents',
      'blend_components',
      'components',
      'notes',
    ]);
    const allowedComponentKeys = new Set(BEAN_COMPONENT_FIELD_IDS);
    const processPattern = /水洗|日晒|蜜处理|厌氧|发酵|湿刨|半水洗|自然/;

    const cleanValue = (value, allowedKeys = null) => {
      if (value === null || value === undefined) return undefined;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
      }
      if (Array.isArray(value)) {
        const items = value.map(item => cleanValue(item)).filter(Boolean);
        return items.length > 0 ? items : undefined;
      }
      if (!value || typeof value !== 'object') return value;
      Object.keys(value).forEach(key => {
        if (allowedKeys && !allowedKeys.has(key)) {
          delete value[key];
          return;
        }
        const cleaned = cleanValue(value[key]);
        if (cleaned === undefined) {
          delete value[key];
        } else {
          value[key] = cleaned;
        }
      });
      return value;
    };

    const normalizeNote = note => {
      if (Array.isArray(note)) {
        return note
          .map(item => String(item).trim())
          .filter(Boolean)
          .join('/');
      }
      return note;
    };

    const extractVarietyFromNotes = target => {
      if (!target.notes || !Array.isArray(target.blendComponents)) return;
      const noteText = Array.isArray(target.notes)
        ? target.notes.join('；')
        : String(target.notes);
      const varietyMatch = Array.from(noteText.matchAll(/\b\d{4,6}\b/g))
        .map(match => match[0])
        .filter(match => !new RegExp(`${match}\\s*M`, 'i').test(noteText))
        .filter(
          match => !new RegExp(`批次\\s*[:：]?\\s*${match}`).test(noteText)
        )
        .pop();
      if (
        enabledComponentKeys.has('variety') &&
        varietyMatch &&
        !target.blendComponents[0]?.variety
      ) {
        target.blendComponents[0] = {
          ...target.blendComponents[0],
          variety: varietyMatch,
        };
        target.notes = noteText
          .replace(varietyMatch, '')
          .replace(/[；/、,，\s]+/g, ' ')
          .trim();
      }
    };

    const normalizeAltitudeNote = note => {
      if (typeof note !== 'string') return note;
      return note
        .replace(/等级\s*[:：]?\s*G1/gi, 'G1')
        .replace(/生豆商\s*[:：]?\s*/g, '生豆商：')
        .replace(
          /(?:海拔\s*[:：]?\s*)?(\d{3,4})(?:\s*[-–—]\s*(\d{3,4}))?\s*M\.?A\.?S\.?L\.?/gi,
          (_match, lower, upper) => `海拔 ${lower}${upper ? `-${upper}` : ''}m`
        )
        .replace(/海拔\s*海拔\s*/g, '海拔 ')
        .replace(/\s*[；/、]\s*/g, '/')
        .trim();
    };

    const normalizeLocationText = value => {
      if (typeof value !== 'string') return value;
      return value
        .replace(/\bETHIOPIA\b/gi, '埃塞俄比亚')
        .replace(/\bBONA STATION\b/gi, '博纳')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normalizeFlatComponents = components => {
      if (!Array.isArray(components) || components.length === 0) {
        return components;
      }
      if (components.every(item => item && typeof item === 'object')) {
        return components.map(component =>
          cleanValue(component, allowedComponentKeys)
        );
      }
      const values = components
        .filter(item => typeof item === 'string')
        .map(item => item.trim())
        .filter(item => item && item !== 'origin' && item !== 'process');

      if (values.length === 0) return undefined;

      const midpoint = values.length / 2;
      if (
        values.length % 2 === 0 &&
        values.slice(0, midpoint).every(item => !processPattern.test(item)) &&
        values.slice(midpoint).every(item => processPattern.test(item))
      ) {
        return values.slice(0, midpoint).map((origin, index) => ({
          origin,
          process: values[midpoint + index],
        }));
      }

      const processIndex = values.findIndex(item => processPattern.test(item));
      if (processIndex >= 0) {
        const beforeProcess = values.slice(0, processIndex);
        const afterProcess = values.slice(processIndex + 1);
        const component = { process: values[processIndex] };

        if (beforeProcess.length >= 1) component.origin = beforeProcess[0];
        if (beforeProcess.length >= 2) {
          const second = beforeProcess[1];
          if (/站|station/i.test(second)) {
            component.processingStation = normalizeLocationText(second);
          } else {
            component.origin = `${component.origin} ${second}`.trim();
          }
        }
        if (beforeProcess.length >= 3) {
          component.variety = beforeProcess[2];
        }
        if (afterProcess.length > 0 && !component.variety) {
          component.variety = afterProcess[0];
        }
        return [component];
      }

      return components;
    };

    const normalizeComponentLocations = target => {
      if (!Array.isArray(target.blendComponents)) return;
      target.blendComponents = target.blendComponents.map(component => {
        if (!component || typeof component !== 'object') return component;
        return {
          ...component,
          origin: normalizeLocationText(component.origin),
          estate: normalizeLocationText(component.estate),
          processingStation: normalizeLocationText(component.processingStation),
        };
      });
    };

    const normalizeBlendComponentDuplicates = target => {
      if (!Array.isArray(target.blendComponents)) return;

      const componentFields = BEAN_COMPONENT_FIELD_IDS;
      const normalizeComponentText = value =>
        typeof value === 'string'
          ? value.replace(/\s+/g, ' ').trim().toLowerCase()
          : '';
      const collapseRepeatedText = value => {
        const normalized = value.replace(/\s+/g, ' ').trim();
        const tokens = normalized.split(' ');
        if (tokens.length < 2 || tokens.length % 2 !== 0) return normalized;

        const midpoint = tokens.length / 2;
        const first = tokens.slice(0, midpoint).join(' ');
        const second = tokens.slice(midpoint).join(' ');
        return first.toLowerCase() === second.toLowerCase()
          ? first
          : normalized;
      };
      const extractNamedVarietyFromName = name => {
        if (typeof name !== 'string') return '';
        const match = name.match(/\b((?:Oma|SL)\s*-?\s*\d{2,4})\b/i);
        return match
          ? match[1]
              .replace(/\s*-\s*/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
          : '';
      };
      const namedVariety = extractNamedVarietyFromName(target.name);

      const getComponentKeys = component =>
        componentFields.filter(key => {
          const value = component?.[key];
          return typeof value === 'string' && value.trim();
        });

      const components = target.blendComponents
        .map(component =>
          component && typeof component === 'object'
            ? cleanValue(component, allowedComponentKeys)
            : component
        )
        .filter(component => component && typeof component === 'object')
        .map(component => {
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

      const removedIndexes = new Set();

      components.forEach((component, index) => {
        const componentKeys = getComponentKeys(component);
        if (componentKeys.length !== 1 || componentKeys[0] !== 'variety') {
          return;
        }

        const variety = component.variety;
        const normalizedVariety = normalizeComponentText(variety);
        const duplicatedByCompleteComponent = components.some(
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

        const mergeTargets = components
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

      const seenSignatures = new Set();
      const normalizedComponents = components.filter((component, index) => {
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

      if (normalizedComponents.length > 0) {
        target.blendComponents = normalizedComponents;
      } else {
        delete target.blendComponents;
      }
    };

    const moveRegionalNotesToOrigin = target => {
      if (
        !enabledComponentKeys.has('origin') ||
        enabledComponentKeys.has('region') ||
        typeof target.notes !== 'string' ||
        !Array.isArray(target.blendComponents) ||
        !target.blendComponents[0] ||
        /[:：/]/.test(target.notes) ||
        !/西达摩|班莎|古吉|罕贝拉/.test(target.notes)
      ) {
        return;
      }
      const component = target.blendComponents[0];
      component.origin = [component.origin, target.notes]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      delete target.notes;
    };

    const copyRegionFromNameToOrigin = target => {
      if (
        !enabledComponentKeys.has('origin') ||
        enabledComponentKeys.has('region') ||
        typeof target.name !== 'string' ||
        !Array.isArray(target.blendComponents) ||
        !target.blendComponents[0]
      ) {
        return;
      }
      const regionMatch = target.name.match(/(西达摩\s*班莎|古吉\s*罕贝拉)/);
      if (!regionMatch) return;
      const region = regionMatch[1].replace(/\s+/g, ' ');
      const component = target.blendComponents[0];
      if (!String(component.origin || '').includes(region)) {
        component.origin = [component.origin, region]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    };

    const dropAdvertisingNote = target => {
      if (
        typeof target.notes === 'string' &&
        /锁鲜|包邮|促销|618|冠军|包装技术|技术/.test(target.notes)
      ) {
        delete target.notes;
      }
    };

    const moveGreenBeanMerchantOutOfRoaster = target => {
      if (
        typeof target.roaster !== 'string' ||
        !/裂豆师/.test(target.roaster)
      ) {
        return;
      }
      const note = '生豆商：裂豆师';
      target.notes = target.notes ? `${target.notes}/${note}` : note;
      delete target.roaster;
    };

    const applyBeanFieldConfig = target => {
      if (!Array.isArray(target.blendComponents)) return;
      const noteParts =
        typeof target.notes === 'string' && target.notes.trim()
          ? target.notes
              .split(/\s*\/\s*/)
              .map(part => part.trim())
              .filter(Boolean)
          : [];
      const appendNote = note => {
        if (note && !noteParts.includes(note)) noteParts.push(note);
      };

      target.blendComponents = target.blendComponents
        .map((component, componentIndex) => {
          if (!component || typeof component !== 'object') return component;
          const next = {};
          if (component.percentage !== undefined) {
            next.percentage = component.percentage;
          }
          BEAN_COMPONENT_FIELD_DEFINITIONS.forEach(([id, label]) => {
            const value =
              typeof component[id] === 'string' ? component[id].trim() : '';
            if (!value) return;
            if (enabledComponentKeys.has(id)) {
              next[id] = value;
              return;
            }
            const prefix =
              target.blendComponents.length > 1
                ? `成分${componentIndex + 1} `
                : '';
            appendNote(`${prefix}${label}：${value}`);
          });
          return next;
        })
        .filter(component =>
          BEAN_COMPONENT_FIELD_IDS.some(
            field => typeof component?.[field] === 'string' && component[field]
          )
        );

      if (target.blendComponents.length === 0) {
        delete target.blendComponents;
      }
      if (noteParts.length > 0) {
        target.notes = noteParts.join('/');
      } else {
        delete target.notes;
      }
    };

    bean = cleanValue(bean, allowedBeanKeys);
    if (
      !bean.blendComponents &&
      (bean.blenderComponents || bean.blend_components || bean.components)
    ) {
      bean.blendComponents =
        bean.blenderComponents || bean.blend_components || bean.components;
      delete bean.blenderComponents;
      delete bean.blend_components;
      delete bean.components;
    }
    if (bean.blendComponents && !Array.isArray(bean.blendComponents)) {
      bean.blendComponents = [bean.blendComponents];
    }
    if (bean.blendComponents) {
      bean.blendComponents = normalizeFlatComponents(bean.blendComponents);
    }
    normalizeComponentLocations(bean);
    normalizeBlendComponentDuplicates(bean);
    extractVarietyFromNotes(bean);
    if (bean.notes) {
      bean.notes = normalizeAltitudeNote(normalizeNote(bean.notes));
      if (!bean.notes) delete bean.notes;
    }
    moveRegionalNotesToOrigin(bean);
    copyRegionFromNameToOrigin(bean);
    applyBeanFieldConfig(bean);
    dropAdvertisingNote(bean);
    moveGreenBeanMerchantOutOfRoaster(bean);
    if (!bean.beanType) {
      bean.beanType = 'filter';
    }
    if (bean.roastDate && !isValidDate(bean.roastDate)) {
      delete bean.roastDate;
    }
    if (bean.capacity === 0) delete bean.capacity;
    if (bean.price === 0) delete bean.price;
    return bean;
  };

  if (Array.isArray(beanData)) {
    beanData = beanData.map(normalizeBean);
  } else {
    beanData = normalizeBean(beanData);
  }

  const dataArray = Array.isArray(beanData) ? beanData : [beanData];
  dataArray.forEach(item => {
    if (!item || typeof item !== 'object') {
      throw new Error('识别结果格式无效');
    }
    if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
      throw new Error('识别结果缺少咖啡豆名称');
    }
  });

  return beanData;
}

function parseMethodResponse(aiText) {
  const payload = stripCodeFence(aiText);
  let methodData = JSON.parse(payload);

  if (
    methodData &&
    typeof methodData === 'object' &&
    !Array.isArray(methodData)
  ) {
    const possibleKeys = ['method', '方案', 'data'];
    for (const key of possibleKeys) {
      if (methodData[key] && typeof methodData[key] === 'object') {
        methodData = methodData[key];
        break;
      }
    }
  }

  if (methodData?.params?.stages && !Array.isArray(methodData.params.stages)) {
    methodData.params.stages = [methodData.params.stages];
  }

  if (Array.isArray(methodData?.params?.stages)) {
    methodData.params.stages = methodData.params.stages.map(stage => {
      const current = { ...stage };
      if (typeof current.duration === 'string') {
        current.duration = parseInt(current.duration, 10) || 0;
      }
      if (typeof current.water === 'number') {
        current.water = String(current.water);
      }
      return current;
    });
  }

  if (!methodData || typeof methodData !== 'object') {
    throw new Error('识别结果格式无效');
  }
  if (!methodData.name || typeof methodData.name !== 'string') {
    throw new Error('识别结果缺少方案名称');
  }
  if (!methodData.params || typeof methodData.params !== 'object') {
    throw new Error('识别结果缺少方案参数');
  }
  if (
    !Array.isArray(methodData.params.stages) ||
    methodData.params.stages.length === 0
  ) {
    throw new Error('识别结果缺少冲煮步骤');
  }

  return methodData;
}

async function parseImageFromRequest(request) {
  const formData = await request.formData();
  const file = formData.get('image');
  const beanFieldConfigValue = formData.get('beanFieldConfig');

  if (!(file instanceof File)) {
    throw new Error('请上传图片文件');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('文件过大，请上传不超过 5MB 的图片');
  }

  if (
    file.name.includes('..') ||
    file.name.includes('/') ||
    file.name.includes('\\')
  ) {
    throw new Error('文件名包含非法字符');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = resolveImageMimeType(file, buffer);

  const base64 = buffer.toString('base64');
  let beanFieldConfig = DEFAULT_BEAN_FIELD_CONFIG;
  if (typeof beanFieldConfigValue === 'string' && beanFieldConfigValue.trim()) {
    try {
      beanFieldConfig = normalizeBeanFieldConfig(
        JSON.parse(beanFieldConfigValue)
      );
    } catch {
      beanFieldConfig = DEFAULT_BEAN_FIELD_CONFIG;
    }
  }

  return {
    mimeType,
    imageUrl: `data:${mimeType};base64,${base64}`,
    beanFieldConfig,
  };
}

async function handleBeanRecognition(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return noContentResponse(request, env);
  if (request.method !== 'POST') {
    return errorResponse(request, env, 'Method Not Allowed', 405);
  }
  const apiKey = getQiniuApiKey(env);
  if (!apiKey) {
    return errorResponse(request, env, '缺少 QINIU_API_KEY 环境变量', 500);
  }

  try {
    const { imageUrl, beanFieldConfig } = await parseImageFromRequest(request);
    const result = await callModelJSON({
      url: QINIU_CHAT_COMPLETIONS,
      apiKey,
      timeoutMs: MODEL_REQUEST_TIMEOUT_MS,
      payload: {
        model: env.BEAN_RECOGNITION_MODEL || DEFAULT_VISION_RECOGNITION_MODEL,
        messages: [
          {
            role: 'system',
            content: buildBeanRecognitionPrompt(beanFieldConfig),
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
      },
    });

    const aiText = extractAssistantText(result);
    if (!aiText) {
      return errorResponse(request, env, '无法识别图片中的咖啡豆信息', 500);
    }

    const beanData = parseBeanResponse(aiText, beanFieldConfig);
    return jsonResponse(request, env, {
      success: true,
      data: beanData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = normalizeRecognitionErrorMessage(
      error?.message || '服务器内部错误'
    );
    const status =
      message.includes('请上传图片文件') ||
      message.includes('不支持的文件类型') ||
      message.includes('文件过大') ||
      message.includes('文件名包含非法字符') ||
      message.includes('文件内容与声明')
        ? 400
        : 500;
    return errorResponse(request, env, message, status);
  }
}

async function handleMethodRecognition(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return noContentResponse(request, env);
  if (request.method !== 'POST') {
    return errorResponse(request, env, 'Method Not Allowed', 405);
  }
  const apiKey = getQiniuApiKey(env);
  if (!apiKey) {
    return errorResponse(request, env, '缺少 QINIU_API_KEY 环境变量', 500);
  }

  try {
    const { imageUrl } = await parseImageFromRequest(request);
    const result = await callModelJSON({
      url: QINIU_CHAT_COMPLETIONS,
      apiKey,
      timeoutMs: MODEL_REQUEST_TIMEOUT_MS,
      payload: {
        model: env.METHOD_RECOGNITION_MODEL || DEFAULT_VISION_RECOGNITION_MODEL,
        messages: [
          { role: 'system', content: METHOD_RECOGNITION_PROMPT },
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: imageUrl } }],
          },
        ],
        temperature: 0,
        max_tokens: 2000,
        thinking: {
          type: 'disabled',
        },
        response_format: { type: 'json_object' },
      },
    });

    const aiText = extractAssistantText(result);
    if (!aiText) {
      return errorResponse(request, env, '无法识别图片中的冲煮方案信息', 500);
    }

    const methodData = parseMethodResponse(aiText);
    return jsonResponse(request, env, {
      success: true,
      data: methodData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = normalizeRecognitionErrorMessage(
      error?.message || '服务器内部错误'
    );
    const status =
      message.includes('请上传图片文件') ||
      message.includes('不支持的文件类型') ||
      message.includes('文件过大') ||
      message.includes('文件名包含非法字符') ||
      message.includes('文件内容与声明')
        ? 400
        : 500;
    return errorResponse(request, env, message, status);
  }
}

export default async function onRequest(context) {
  const { request, env } = context;

  if (!isOriginAllowed(request, env)) {
    return errorResponse(request, env, 'Not allowed by CORS', 403);
  }

  const pathname = new URL(request.url).pathname;

  try {
    if (pathname === '/api/recognize-bean') {
      return await handleBeanRecognition(context);
    }

    if (pathname === '/api/recognize-method') {
      return await handleMethodRecognition(context);
    }

    if (request.method === 'OPTIONS') return noContentResponse(request, env);
    return errorResponse(request, env, 'Not Found', 404);
  } catch (error) {
    return errorResponse(
      request,
      env,
      error?.message || '服务器内部错误',
      error?.status || 500
    );
  }
}
