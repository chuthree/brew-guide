// API 配置
export const API_CONFIG = {
  // 默认走同域 EdgeOne Functions（可通过 NEXT_PUBLIC_API_URL 覆盖）
  baseURL: (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, ''),
  timeout: 120000, // 120秒超时
};

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

// 识别冲煮方案图片
export async function recognizeMethodImage(imageFile: File): Promise<any> {
  // 验证文件安全性
  validateImageFile(imageFile);

  console.log(
    '📤 准备上传图片:',
    imageFile.name,
    '大小:',
    imageFile.size,
    'bytes'
  );

  const apiUrl = `${API_CONFIG.baseURL}/api/recognize-method`;
  console.log('📡 API 地址:', apiUrl);

  const formData = new FormData();
  formData.append('image', imageFile);

  try {
    console.log('🔄 开始请求...');
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(API_CONFIG.timeout),
    });

    console.log('📥 收到响应，状态码:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      console.error('❌ 响应错误:', error);
      throw new Error(error.error || `请求失败: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ 解析响应成功:', result);

    if (!result.success) {
      throw new Error(result.error || '识别失败');
    }

    return result.data;
  } catch (error) {
    console.error('❌ 请求失败:', error);

    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new Error('请求超时，请稍后重试');
      }
      throw error;
    }

    throw new Error('未知错误');
  }
}
