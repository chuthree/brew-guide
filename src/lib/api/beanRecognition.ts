// API 配置
export const API_CONFIG = {
  // 生产环境使用你的服务器地址，开发环境使用 localhost
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://chu3.top',
  timeout: 30000, // 30秒超时
};

// 识别咖啡豆图片
export async function recognizeBeanImage(imageFile: File): Promise<any> {
  console.log(
    '📤 准备上传图片:',
    imageFile.name,
    '大小:',
    imageFile.size,
    'bytes'
  );

  const apiUrl = `${API_CONFIG.baseURL}/api/recognize-bean`;
  console.log('📡 API 地址:', apiUrl);

  // 尝试直接请求，如果失败则通过 CORS 代理
  const formData = new FormData();
  formData.append('image', imageFile);

  try {
    // 先尝试直接请求
    console.log('🔄 尝试直接请求...');
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      credentials: 'include', // 添加 credentials 以支持 CORS
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
    console.error('❌ 直接请求失败:', error);

    // 检查是否是 404 错误（API 配置未生效）
    if (error instanceof Error && error.message.includes('404')) {
      throw new Error('API 服务未配置，请联系管理员配置 Nginx 反向代理');
    }

    // 检查是否是网络错误
    if (
      error instanceof TypeError &&
      error.message.includes('Failed to fetch')
    ) {
      throw new Error('网络连接失败，请检查网络或稍后重试');
    }

    throw error;
  }
}

// 健康检查
export async function checkAPIHealth(): Promise<boolean> {
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
