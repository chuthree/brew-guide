import { API_CONFIG } from './shared/config';
import { fetchWithTimeout, isTimeoutError } from './shared/request';
import { normalizeRecognitionErrorMessage } from './shared/recognitionErrors.js';
import { smartCompress } from '@/lib/utils/imageCompression';

// 识别冲煮方案图片
export async function recognizeMethodImage(imageFile: File): Promise<unknown> {
  // 验证文件安全性
  imageFile = await smartCompress(imageFile);

  const apiUrl = `${API_CONFIG.baseURL}/api/recognize-method`;

  const formData = new FormData();
  formData.append('image', imageFile);

  try {
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      timeoutMs: API_CONFIG.timeoutMs,
    });

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

    if (!result.success) {
      throw new Error(result.error || '识别失败');
    }

    return result.data;
  } catch (error) {
    console.error('❌ 请求失败:', error);

    if (error instanceof Error) {
      const message = error.message;
      if (isTimeoutError(error)) {
        throw new Error('请求超时，请稍后重试');
      }
      throw new Error(normalizeRecognitionErrorMessage(message));
    }

    throw new Error('未知错误');
  }
}
