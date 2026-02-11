// API 配置
export const API_CONFIG = {
  // 生产环境使用 api.chu3.top，开发环境使用 localhost
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.chu3.top',
  timeout: 120000, // 120秒超时
};

export const DEFAULT_BEAN_RECOGNITION_PROMPT = `你是OCR工具，提取图片中的咖啡豆信息，直接返回JSON（单豆返回对象{}，多豆返回数组[]）。

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

规则：数值不带单位/不编造/不确定不填/直接返回JSON
`;

export interface CustomBeanRecognitionConfig {
  enabled: boolean;
  apiBaseUrl: string;
  apiKey?: string;
  model: string;
  prompt: string;
}

// 文件上传安全配置
const UPLOAD_CONFIG = {
  // 允许的图片类型
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
  // 最大文件大小：5MB
  maxSize: 5 * 1024 * 1024,
};

// 验证图片文件
function validateImageFile(file: File): void {
  // 验证文件类型
  if (!UPLOAD_CONFIG.allowedTypes.includes(file.type)) {
    throw new Error('不支持的文件类型，请上传 JPG、PNG 或 HEIF 图片');
  }

  // 验证文件大小
  if (file.size > UPLOAD_CONFIG.maxSize) {
    const maxSizeMB = UPLOAD_CONFIG.maxSize / (1024 * 1024);
    throw new Error(`文件过大，请上传不超过 ${maxSizeMB}MB 的图片`);
  }

  // 验证文件名（防止路径遍历攻击）
  if (
    file.name.includes('..') ||
    file.name.includes('/') ||
    file.name.includes('\\')
  ) {
    throw new Error('文件名包含非法字符');
  }
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

async function recognizeBeanImageWithCustomAPI(
  imageFile: File,
  customConfig: CustomBeanRecognitionConfig
): Promise<unknown> {
  try {
    const requestStartAt = Date.now();
    const baseUrl = customConfig.apiBaseUrl.trim().replace(/\/+$/, '');
    if (!baseUrl) {
      throw new Error('实验性识别已启用，但未配置 API 地址');
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      throw new Error('实验性 API 地址必须以 http:// 或 https:// 开头');
    }
    if (!customConfig.model?.trim()) {
      throw new Error('实验性识别已启用，但未配置模型名称');
    }

    const endpoint = `${baseUrl}/chat/completions`;
    const imageUrl = await fileToDataUrl(imageFile);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(customConfig.apiKey?.trim()
          ? { Authorization: `Bearer ${customConfig.apiKey.trim()}` }
          : {}),
      },
      body: JSON.stringify({
        model: customConfig.model.trim(),
        messages: [
          { role: 'system', content: customConfig.prompt },
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: imageUrl } }],
          },
        ],
        temperature: 0,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(API_CONFIG.timeout),
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
      return extractJsonPayload(content);
    }
    if (Array.isArray(content)) {
      const merged = content
        .map(part => (typeof part?.text === 'string' ? part.text : ''))
        .join('')
        .trim();
      if (merged) {
        return extractJsonPayload(merged);
      }
    }

    if (result?.data !== undefined) {
      return result.data;
    }

    if (Array.isArray(result) || (result && typeof result === 'object')) {
      return result;
    }

    throw new Error('实验性识别返回格式不支持，请检查 API 兼容性');
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === 'AbortError'
    ) {
      throw new Error(
        `实验性识别超时（>${Math.floor(API_CONFIG.timeout / 1000)}s），可更换模型或稍后重试`
      );
    }
    throw error;
  }
}

// 识别咖啡豆图片（非流式版本）
export async function recognizeBeanImage(
  imageFile: File,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onProgress?: (chunk: string) => void,
  customConfig?: CustomBeanRecognitionConfig
): Promise<unknown> {
  // 验证文件安全性
  validateImageFile(imageFile);

  if (customConfig?.enabled) {
    return recognizeBeanImageWithCustomAPI(imageFile, customConfig);
  }

  const apiUrl = `${API_CONFIG.baseURL}/api/recognize-bean`;

  const formData = new FormData();
  formData.append('image', imageFile);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        Accept: 'application/json', // 请求非流式响应
      },
      signal: AbortSignal.timeout(API_CONFIG.timeout),
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

    return result.data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      throw new Error('API 服务未配置，请联系管理员配置 Nginx 反向代理');
    }

    if (
      error instanceof TypeError &&
      error.message.includes('Failed to fetch')
    ) {
      throw new Error('请求失败，请检查网络连接或尝试更新应用');
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
    const model = customConfig.model.trim();
    if (!model) {
      throw new Error('请先填写模型名称');
    }

    const endpoint = `${baseUrl}/chat/completions`;
    const modelsEndpoint = `${baseUrl}/models`;
    const startAt = Date.now();

    // 1) 先测试鉴权与连通性（/models 更快且不依赖视觉推理）
    const modelsResponse = await fetch(modelsEndpoint, {
      method: 'GET',
      headers: {
        ...(customConfig.apiKey?.trim()
          ? { Authorization: `Bearer ${customConfig.apiKey.trim()}` }
          : {}),
      },
      signal: AbortSignal.timeout(20000),
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
    const response = await fetch(endpoint, {
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
      }),
      signal: AbortSignal.timeout(60000),
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
    if (
      error instanceof DOMException &&
      error.name === 'AbortError'
    ) {
      throw new Error(
        '测试超时：请检查网络、API 网关可用性，或稍后重试'
      );
    }
    throw error;
  }
}

// 健康检查
async function checkAPIHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/health`, {
      method: 'GET',
      credentials: 'include',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
