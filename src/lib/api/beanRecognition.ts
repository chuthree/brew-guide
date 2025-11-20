// API 配置
export const API_CONFIG = {
  // 生产环境使用你的服务器地址，开发环境使用 localhost
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://chu3.top',
  timeout: 120000, // 120秒超时
};

// 识别咖啡豆图片（流式版本）
export async function recognizeBeanImage(
  imageFile: File,
  onProgress?: (chunk: string) => void
): Promise<any> {
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
    console.log('🔄 开始流式请求...');
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        Accept: 'text/event-stream', // 请求流式响应
      },
      signal: AbortSignal.timeout(API_CONFIG.timeout),
    });

    console.log('📥 收到响应，状态码:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      console.error('❌ 响应错误:', error);
      throw new Error(error.error || `请求失败: ${response.status}`);
    }

    // 检查是否是流式响应
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/event-stream')) {
      // 处理 SSE 流式响应
      console.log('📡 检测到流式响应，开始接收数据...');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let finalContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.content || '';
              if (content) {
                // 服务器发送的已经是完整内容，直接使用
                finalContent = content;
                // 实时回调更新
                if (onProgress) {
                  onProgress(content);
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      console.log('✅ 流式响应完成');

      // 解析最终的 JSON
      try {
        const beanData = JSON.parse(finalContent);
        return beanData;
      } catch (e) {
        throw new Error('无法解析识别结果');
      }
    } else {
      // 非流式响应，按原来的方式处理
      const result = await response.json();
      console.log('✅ 解析响应成功:', result);

      if (!result.success) {
        throw new Error(result.error || '识别失败');
      }

      return result.data;
    }
  } catch (error) {
    console.error('❌ 请求失败:', error);

    if (error instanceof Error && error.message.includes('404')) {
      throw new Error('API 服务未配置，请联系管理员配置 Nginx 反向代理');
    }

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
