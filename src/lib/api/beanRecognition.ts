// API 配置
export const API_CONFIG = {
  // 生产环境使用 api.chu3.top，开发环境使用 localhost
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.chu3.top',
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

// 识别咖啡豆图片（非流式版本）
export async function recognizeBeanImage(
  imageFile: File,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onProgress?: (chunk: string) => void
): Promise<any> {
  // 验证文件安全性
  validateImageFile(imageFile);

  console.log(
    '📤 准备上传图片:',
    imageFile.name,
    '大小:',
    imageFile.size,
    'bytes'
  );

  const apiUrl = `${API_CONFIG.baseURL}/api/recognize-bean`;
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
        Accept: 'application/json', // 请求非流式响应
      },
      signal: AbortSignal.timeout(API_CONFIG.timeout),
    });

    console.log('📥 收到响应，状态码:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      console.error('❌ 响应错误:', error);
      throw new Error(error.error || `请求失败: ${response.status}`);
    }

    // 非流式响应处理
    const result = await response.json();
    console.log('✅ 解析响应成功:', result);

    if (!result.success) {
      throw new Error(result.error || '识别失败');
    }

    return result.data;
  } catch (error) {
    console.error('❌ 请求失败:', error);

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
