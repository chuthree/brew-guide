import { API_CONFIG } from './shared/config';
import { fetchWithTimeout, isTimeoutError } from './shared/request';
import { validateRecognitionImageFile } from './shared/recognition';

// 识别冲煮方案图片
export async function recognizeMethodImage(imageFile: File): Promise<any> {
  // 验证文件安全性
  validateRecognitionImageFile(imageFile);

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
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      timeoutMs: API_CONFIG.timeoutMs,
    });

    console.log('📥 收到响应，状态码:', response.status);

    if (!response.ok) {
      const rawText = await response.text().catch(() => '');
      let error: { error?: string; message?: string } = {};

      if (rawText) {
        try {
          error = JSON.parse(rawText);
        } catch {
          error = { error: rawText.slice(0, 300) };
        }
      }

      console.error('❌ 响应错误:', {
        status: response.status,
        body: error,
        rawText: rawText.slice(0, 300),
      });
      throw new Error(
        error.error || error.message || `请求失败: ${response.status}`
      );
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
      if (isTimeoutError(error)) {
        throw new Error('请求超时，请稍后重试');
      }
      throw error;
    }

    throw new Error('未知错误');
  }
}
