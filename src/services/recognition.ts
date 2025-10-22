// 定义响应类型
interface RecognitionResponse {
  result?: Record<string, unknown>;
  error?: string;
}

// 定义错误类型
export class RecognitionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NO_FILE'
      | 'INVALID_FILE'
      | 'SERVER_ERROR'
      | 'NETWORK_ERROR'
  ) {
    super(message);
    this.name = 'RecognitionError';
  }
}

// 检查文件类型
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const checkFileType = (file: File | Blob): void => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new RecognitionError(
      '不支持的文件类型，请上传 JPG、PNG 或 WebP 格式的图片',
      'INVALID_FILE'
    );
  }
};

const RECOGNITION_API_URL = 'https://llm1.zrzz.site/upload';

export async function recognizeImage(
  formData: FormData
): Promise<RecognitionResponse> {
  try {
    // 检查是否包含文件
    const file = formData.get('file') as File | Blob | null;
    if (!file) {
      throw new RecognitionError('未找到图片文件', 'NO_FILE');
    }

    // 检查文件类型
    checkFileType(file);

    // 发送请求
    const response = await fetch(RECOGNITION_API_URL, {
      method: 'POST',
      body: formData,
    });

    // 检查网络响应
    if (!response.ok) {
      // 根据状态码返回不同的错误
      switch (response.status) {
        case 400:
          throw new RecognitionError('图片格式不正确', 'INVALID_FILE');
        case 413:
          throw new RecognitionError('图片文件过大', 'INVALID_FILE');
        case 500:
          throw new RecognitionError('识别服务出现错误', 'SERVER_ERROR');
        default:
          throw new RecognitionError('网络请求失败', 'NETWORK_ERROR');
      }
    }

    // 解析响应
    const data = await response.json();

    // 检查响应格式
    if (!data.result) {
      throw new RecognitionError('未识别到符合格式的关键信息', 'SERVER_ERROR');
    }

    return {
      result: data.result,
    };
  } catch (error) {
    // 处理网络错误
    if (error instanceof TypeError) {
      throw new RecognitionError('网络连接失败', 'NETWORK_ERROR');
    }

    // 如果是我们的自定义错误，直接抛出
    if (error instanceof RecognitionError) {
      throw error;
    }

    // 其他未知错误
    // Log error in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('Recognition error:', error);
    }
    throw new RecognitionError('识别过程出现未知错误', 'SERVER_ERROR');
  }
}
