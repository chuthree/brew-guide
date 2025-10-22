/**
 * 二维码扫描工具 - 仅支持图片上传
 */

export interface QRScanResult {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * 检查平台是否支持扫描
 */
export async function isScannerAvailable(): Promise<{
  native: boolean;
  webAPI: boolean;
  fileUpload: boolean;
}> {
  // 检查 Web API 支持
  let webAPISupported = false;
  if ('BarcodeDetector' in window) {
    try {
      const formats = await (
        window as {
          BarcodeDetector?: { getSupportedFormats?: () => Promise<string[]> };
        }
      ).BarcodeDetector?.getSupportedFormats?.();
      webAPISupported = formats ? formats.includes('qr_code') : false;
    } catch {
      webAPISupported = false;
    }
  }

  return {
    native: false, // 已移除原生相机扫描
    webAPI: webAPISupported,
    fileUpload: true, // 文件上传总是可用
  };
}

/**
 * 图像预处理：提高二维码识别率
 * 处理真实拍摄的照片（有背景、光照不均、倾斜等问题）
 */
async function preprocessImage(imageFile: File): Promise<HTMLCanvasElement[]> {
  const img = await createImageBitmap(imageFile);
  const canvases: HTMLCanvasElement[] = [];

  // 1. 原图（高分辨率）
  const originalCanvas = document.createElement('canvas');
  const originalCtx = originalCanvas.getContext('2d', {
    willReadFrequently: true,
  });
  if (originalCtx) {
    originalCanvas.width = img.width;
    originalCanvas.height = img.height;
    originalCtx.drawImage(img, 0, 0);
    canvases.push(originalCanvas);
  }

  // 2. 缩放到合适尺寸（1200-1600px 之间最佳）
  const maxDim = Math.max(img.width, img.height);
  if (maxDim > 1600) {
    const scale = 1600 / maxDim;
    const scaledCanvas = document.createElement('canvas');
    const scaledCtx = scaledCanvas.getContext('2d', {
      willReadFrequently: true,
    });
    if (scaledCtx) {
      scaledCanvas.width = img.width * scale;
      scaledCanvas.height = img.height * scale;
      scaledCtx.imageSmoothingEnabled = true;
      scaledCtx.imageSmoothingQuality = 'high';
      scaledCtx.drawImage(img, 0, 0, scaledCanvas.width, scaledCanvas.height);
      canvases.push(scaledCanvas);
    }
  }

  // 3. 增强对比度（帮助识别光照不均的图片）
  const contrastCanvas = document.createElement('canvas');
  const contrastCtx = contrastCanvas.getContext('2d', {
    willReadFrequently: true,
  });
  if (contrastCtx) {
    const targetSize = maxDim > 1600 ? 1600 / maxDim : 1;
    contrastCanvas.width = img.width * targetSize;
    contrastCanvas.height = img.height * targetSize;
    contrastCtx.imageSmoothingEnabled = true;
    contrastCtx.imageSmoothingQuality = 'high';
    contrastCtx.drawImage(
      img,
      0,
      0,
      contrastCanvas.width,
      contrastCanvas.height
    );

    // 增强对比度
    const imageData = contrastCtx.getImageData(
      0,
      0,
      contrastCanvas.width,
      contrastCanvas.height
    );
    const data = imageData.data;
    const factor = 1.3; // 对比度增强因子
    const intercept = 128 * (1 - factor);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * factor + intercept)); // R
      data[i + 1] = Math.max(
        0,
        Math.min(255, data[i + 1] * factor + intercept)
      ); // G
      data[i + 2] = Math.max(
        0,
        Math.min(255, data[i + 2] * factor + intercept)
      ); // B
    }

    contrastCtx.putImageData(imageData, 0, 0);
    canvases.push(contrastCanvas);
  }

  return canvases;
}

/**
 * 使用 jsQR 扫描二维码
 * 识别率较低，但作为最后的备选
 */
async function scanWithJsQR(imageFile: File): Promise<QRScanResult> {
  try {
    const jsQR = (await import('jsqr')).default;

    // 获取多个预处理版本的图像
    const canvases = await preprocessImage(imageFile);

    // 尝试每个预处理版本
    for (const canvas of canvases) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code) {
        return { success: true, data: code.data };
      }
    }

    return {
      success: false,
      error: '未检测到二维码',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '扫描失败',
    };
  }
}

/**
 * 使用 Web Barcode Detection API
 * Chrome 桌面端的原生 API，识别率极高
 */
async function scanWithWebAPI(imageFile: File): Promise<QRScanResult> {
  try {
    const BarcodeDetectorClass = (
      window as {
        BarcodeDetector?: new (options?: { formats?: string[] }) => {
          detect: (image: ImageBitmap) => Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;

    if (!BarcodeDetectorClass) {
      return {
        success: false,
        error: '浏览器不支持 Barcode Detection API',
      };
    }

    const barcodeDetector = new BarcodeDetectorClass({
      formats: ['qr_code'],
    });

    // 直接检测原图（通常就够了）
    const imageBitmap = await createImageBitmap(imageFile);
    const barcodes = await barcodeDetector.detect(imageBitmap);

    if (barcodes && barcodes.length > 0) {
      return {
        success: true,
        data: barcodes[0].rawValue,
      };
    }

    return {
      success: false,
      error: '图片中未检测到二维码',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '扫描失败',
    };
  }
}

/**
 * 扫描图片文件中的二维码
 *
 * 策略：
 * 1. Web Barcode Detection API（Chrome 桌面 - 最快最准）
 * 2. jsQR（备用 - 纯 JS 实现）
 */
export async function scanImageFile(file: File): Promise<QRScanResult> {
  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    return {
      success: false,
      error: '请选择图片文件',
    };
  }

  // 策略 1: 优先使用 Web Barcode Detection API（桌面 Chrome）
  const { webAPI } = await isScannerAvailable();
  if (webAPI) {
    const result = await scanWithWebAPI(file);
    if (result.success) {
      return result;
    }
  }

  // 策略 2: jsQR 作为后备方案
  return await scanWithJsQR(file);
}
