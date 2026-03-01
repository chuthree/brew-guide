const API_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Depth',
  'Destination',
  'Overwrite',
];

const API_ALLOWED_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'PROPFIND',
  'MKCOL',
  'PROPPATCH',
  'COPY',
  'MOVE',
];

const IMAGE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

const IMAGE_MAGIC_NUMBERS = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'image/heic': [[0x00, 0x00, 0x00]],
  'image/heif': [[0x00, 0x00, 0x00]],
};

const QINIU_CHAT_COMPLETIONS =
  'https://api.qnaigc.com/v1/chat/completions';
const YEARLY_REPORT_DEFAULT_MODEL = 'deepseek/deepseek-v3.2-251201';

const BEAN_RECOGNITION_PROMPT = `你是OCR工具，提取图片中的咖啡豆信息，直接返回JSON（单豆返回对象{}，多豆返回数组[]）。

必填: name（豆名，如"埃塞俄比亚赏花日晒原生种"）

可选（图片有明确信息才填）：
- roaster: 烘焙商/品牌名（如"西可"）
- capacity/remaining/price: 纯数字
- roastDate: YYYY-MM-DD (缺年份补2026)
- roastLevel: 极浅烘焙|浅度烘焙|中浅烘焙|中度烘焙|中深烘焙|深度烘焙
- beanType: filter|espresso|omni（≤200g/浅烘/单品→filter，≥300g/深烘/拼配→espresso，标注全能→omni，默认filter）
- flavor: 风味数组["橘子","荔枝"]
- startDay/endDay: 养豆期/赏味期天数
- blendComponents: 产地/庄园/处理法/品种 [{origin:"埃塞俄比亚",estate:"赏花",process:"日晒",variety:"原生种"}]
- notes: 处理站/海拔/批次号等补充信息（产地和庄园信息放 blendComponents，这里只放补充信息）

规则：数值不带单位/不编造/不确定不填/直接返回JSON`;

const METHOD_RECOGNITION_PROMPT = `你是OCR工具，提取图片中的咖啡冲煮方案，直接返回JSON。

关键规则：
1. 每个注水动作是独立步骤，duration=注水时长（秒）
2. 焖蒸/等待必须拆成两步：注水步骤 + wait步骤
   例：焖蒸30秒注水50g(10秒注完) → 注水10秒50g + 等待20秒
3. wait步骤只有label和duration字段，无water和detail
4. 闷蒸步骤一般是circle注水

JSON格式：
{
  "name":"方案名",
  "params":{
    "coffee":"咖啡粉量如15g",
    "water":"总水量如225g",
    "ratio":"粉水比如1:15",
    "grindSize":"研磨度如中细",
    "temp":"水温如92°C",
    "stages":[
      {"pourType":"center|circle|ice|bypass|wait|other","label":"步骤名","water":"注水量(纯数字)","duration":用时(纯数字),"detail":"说明"}
    ]
  }
}

规则：数值不带单位/不编造/不确定不填/直接返回JSON`;

const YEARLY_REPORT_PROMPT = `你是一位专业的咖啡品鉴师和文案作家。请根据用户一年的咖啡消费数据，撰写一份温暖、有趣、个性化的年度咖啡报告。

## 写作风格
- 温暖亲切，像老朋友聊天
- 适度幽默，有咖啡文化底蕴
- 数据与故事结合
- 简洁有力，每段不超过两句话

## 输出格式
直接输出5-7个自然段落，每段之间用空行分隔。不要使用任何标题、标签、编号或特殊格式。

## 内容要点（按顺序，自然融入段落中）
1. 开场问候，提及用户名和年份
2. 年度亮点数据（豆子数量、总重量等）
3. 最爱的烘焙商或产地
4. 口味偏好画像（处理法、品种等）
5. 冲煮习惯（时间、器具等）
6. 一个有趣的发现或计算
7. 结语祝福，期待新一年

## 注意事项
1. 必须使用提供的真实数据，不要编造
2. 如果某项数据为0或缺失，自然跳过不提
3. 保持积极温暖的语调
4. 纯文本输出，不要 JSON、不要 markdown`;

const runtimeConfigCache = {
  allowedOriginsRaw: null,
  allowedOriginsParsed: { allowAll: true, list: [] },
  proxyAllowlistRaw: null,
  proxyAllowlistParsed: [],
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
      list: value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
    };
  }

  runtimeConfigCache.allowedOriginsRaw = value;
  runtimeConfigCache.allowedOriginsParsed = parsed;
  return parsed;
}

function getProxyAllowlist(env) {
  const value = (env?.CORS_PROXY_ALLOWLIST || '').trim();
  if (runtimeConfigCache.proxyAllowlistRaw === value) {
    return runtimeConfigCache.proxyAllowlistParsed;
  }

  const parsed = value
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);

  runtimeConfigCache.proxyAllowlistRaw = value;
  runtimeConfigCache.proxyAllowlistParsed = parsed;
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

function isMagicNumberValid(buffer, mimeType) {
  const signatures = IMAGE_MAGIC_NUMBERS[mimeType];
  if (!signatures) return false;
  return signatures.some(signature => {
    if (buffer.length < signature.length) return false;
    return signature.every((byte, index) => buffer[index] === byte);
  });
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

async function callModelJSON({ url, apiKey, payload, timeoutMs = 120000 }) {
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

function parseBeanResponse(aiText) {
  const payload = stripCodeFence(aiText);
  let beanData = JSON.parse(payload);

  if (beanData && typeof beanData === 'object' && !Array.isArray(beanData)) {
    const possibleKeys = ['单豆', '多豆', '咖啡豆', 'beans', 'data'];
    for (const key of possibleKeys) {
      if (beanData[key]) {
        beanData = beanData[key];
        break;
      }
    }
  }

  const normalizeBean = bean => {
    if (bean.blendComponents && !Array.isArray(bean.blendComponents)) {
      bean.blendComponents = [bean.blendComponents];
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

  if (methodData && typeof methodData === 'object' && !Array.isArray(methodData)) {
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
  if (!Array.isArray(methodData.params.stages) || methodData.params.stages.length === 0) {
    throw new Error('识别结果缺少冲煮步骤');
  }

  return methodData;
}

async function parseImageFromRequest(request) {
  const formData = await request.formData();
  const file = formData.get('image');

  if (!(file instanceof File)) {
    throw new Error('请上传图片文件');
  }

  if (!IMAGE_ALLOWED_TYPES.includes(file.type)) {
    throw new Error('不支持的文件类型，请上传 JPG、PNG 或 HEIF 图片');
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

  if (!isMagicNumberValid(buffer, file.type)) {
    throw new Error('文件内容与声明的类型不匹配，请上传有效图片');
  }

  const base64 = buffer.toString('base64');
  return {
    mimeType: file.type,
    imageUrl: `data:${file.type};base64,${base64}`,
  };
}

function buildYearlyDataSummary(username, year, stats) {
  const displayName = username || '咖啡爱好者';
  const currentYear = year || new Date().getFullYear();
  return `
## 用户信息
- 用户名: ${displayName}
- 统计年份: ${currentYear}

## 咖啡豆数据
- 购买豆子数量: ${stats.beanCount || 0} 款
- 总重量: ${stats.totalWeight || 0} 克
- 总花费: ${stats.totalCost || 0} 元
- 平均单价: ${stats.avgPrice || 0} 元/包

## 偏好分析
- 最爱烘焙商: ${stats.favoriteRoaster || '暂无数据'}（购买 ${stats.favoriteRoasterCount || 0} 次）
- 最爱产地 TOP3: ${(stats.topOrigins || []).join('、') || '暂无数据'}
- 最爱品种 TOP3: ${(stats.topVarieties || []).join('、') || '暂无数据'}
- 最爱处理法 TOP3: ${(stats.topProcesses || []).join('、') || '暂无数据'}
- 烘焙度偏好: ${stats.roastPreference || '暂无数据'}

## 冲煮数据
- 冲煮次数: ${stats.brewCount || 0} 次
- 常用器具: ${(stats.topEquipments || []).join('、') || '暂无数据'}
- 最早冲煮时间: ${stats.earliestBrewTime || '暂无数据'}
- 最晚冲煮时间: ${stats.latestBrewTime || '暂无数据'}
- 平均评分: ${stats.avgRating || '暂无数据'}
`;
}

function createSSEHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
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
    const { imageUrl } = await parseImageFromRequest(request);
    const result = await callModelJSON({
      url: QINIU_CHAT_COMPLETIONS,
      apiKey,
      timeoutMs: 120000,
      payload: {
        model: env.BEAN_RECOGNITION_MODEL || 'qwen-vl-max-2025-01-25',
        messages: [
          { role: 'system', content: BEAN_RECOGNITION_PROMPT },
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: imageUrl } }],
          },
        ],
        temperature: 0,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      },
    });

    const aiText = extractAssistantText(result);
    if (!aiText) {
      return errorResponse(request, env, '无法识别图片中的咖啡豆信息', 500);
    }

    const beanData = parseBeanResponse(aiText);
    return jsonResponse(request, env, {
      success: true,
      data: beanData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error?.message || '服务器内部错误';
    const status = message.includes('请上传图片文件') ||
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
      timeoutMs: 120000,
      payload: {
        model: env.METHOD_RECOGNITION_MODEL || 'qwen-vl-max-2025-01-25',
        messages: [
          { role: 'system', content: METHOD_RECOGNITION_PROMPT },
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: imageUrl } }],
          },
        ],
        temperature: 0,
        max_tokens: 2000,
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
    const message = error?.message || '服务器内部错误';
    const status = message.includes('请上传图片文件') ||
      message.includes('不支持的文件类型') ||
      message.includes('文件过大') ||
      message.includes('文件名包含非法字符') ||
      message.includes('文件内容与声明')
      ? 400
      : 500;
    return errorResponse(request, env, message, status);
  }
}

async function handleYearlyReport(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return noContentResponse(request, env);
  if (request.method !== 'POST') {
    return errorResponse(request, env, 'Method Not Allowed', 405);
  }
  const apiKey = getQiniuApiKey(env);
  if (!apiKey) {
    return errorResponse(request, env, '缺少 QINIU_API_KEY 环境变量', 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, env, '请求体必须为 JSON', 400);
  }

  const { username, year, stats } = body || {};
  if (!stats || typeof stats !== 'object') {
    return errorResponse(request, env, '缺少统计数据', 400);
  }

  const summary = buildYearlyDataSummary(username, year, stats);
  const payload = {
    model: env.YEARLY_REPORT_MODEL || YEARLY_REPORT_DEFAULT_MODEL,
    messages: [
      { role: 'system', content: YEARLY_REPORT_PROMPT },
      { role: 'user', content: `请根据以下数据生成年度咖啡报告：\n${summary}` },
    ],
    temperature: 0.7,
    max_tokens: 2000,
    stream: true,
  };

  const upstream = await fetch(QINIU_CHAT_COMPLETIONS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    const errorText = await upstream.text();
    return errorResponse(
      request,
      env,
      `报告生成失败: ${errorText || upstream.status}`,
      upstream.status
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body?.getReader();
      if (!reader) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: '无法读取上游流' })}\n\n`)
        );
        controller.close();
        return;
      }

      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const current = line.trim();
            if (!current.startsWith('data:')) continue;

            const raw = current.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;

            try {
              const parsed = JSON.parse(raw);
              const content = parsed?.choices?.[0]?.delta?.content || '';
              if (content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                );
              }
            } catch {
              // ignore parse errors from partial chunks
            }
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: '生成过程中断' })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return withCors(
    request,
    env,
    new Response(stream, {
      status: 200,
      headers: createSSEHeaders(),
    })
  );
}

function proxyHeadersFromRequest(request) {
  const allowed = [
    'authorization',
    'content-type',
    'accept',
    'depth',
    'destination',
    'overwrite',
  ];
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (allowed.includes(lower)) {
      headers.set(key, value);
    }
  }
  return headers;
}

function sanitizeProxyResponseHeaders(upstreamHeaders) {
  const headers = new Headers();
  const blocked = [
    'connection',
    'keep-alive',
    'transfer-encoding',
    'access-control-allow-origin',
    'access-control-allow-methods',
    'access-control-allow-headers',
    'access-control-allow-credentials',
  ];

  upstreamHeaders.forEach((value, key) => {
    if (!blocked.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

function isProxyTargetAllowed(targetUrl, env) {
  const list = getProxyAllowlist(env);
  if (list.length === 0) return true;
  const host = targetUrl.hostname.toLowerCase();
  return list.some(rule => host === rule || host.endsWith(`.${rule}`));
}

async function handleCorsProxy(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return noContentResponse(request, env);

  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  if (!target) {
    return errorResponse(request, env, '缺少 url 参数', 400);
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return errorResponse(request, env, 'url 参数格式无效', 400);
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return errorResponse(request, env, '仅支持 http/https 代理', 400);
  }

  if (!isProxyTargetAllowed(targetUrl, env)) {
    return errorResponse(request, env, '目标地址不在允许列表中', 403);
  }

  if (!API_ALLOWED_METHODS.includes(request.method)) {
    return errorResponse(request, env, 'Method Not Allowed', 405);
  }

  const requestBody =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : request.body;

  let upstream;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: proxyHeadersFromRequest(request),
      body: requestBody,
      redirect: 'follow',
    });
  } catch (error) {
    return errorResponse(
      request,
      env,
      `代理请求失败: ${error?.message || 'unknown error'}`,
      502
    );
  }

  const headers = sanitizeProxyResponseHeaders(upstream.headers);
  return withCors(
    request,
    env,
    new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    })
  );
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

    if (pathname === '/api/yearly-report') {
      return await handleYearlyReport(context);
    }

    if (pathname === '/api/cors-proxy') {
      return await handleCorsProxy(context);
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
