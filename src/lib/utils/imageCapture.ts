import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export interface ImageCaptureOptions {
  source: 'camera' | 'gallery';
  quality?: number;
  allowEditing?: boolean;
  resultType?: CameraResultType;
}

export interface ImageCaptureResult {
  dataUrl: string;
  format: string;
}

export interface MultipleImageCaptureOptions {
  limit?: number; // 限制数量，默认为 9
}

/**
 * 统一的多图选择工具函数
 */
export async function captureImages(
  options: MultipleImageCaptureOptions = {}
): Promise<ImageCaptureResult[]> {
  const { limit = 9 } = options;

  // 在原生平台使用 Capacitor Camera API
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Camera.pickImages({
        quality: 90,
        limit,
      });

      const photos = result.photos;
      const processedPhotos: ImageCaptureResult[] = [];

      for (const photo of photos) {
        if (photo.webPath) {
          // fetch webPath 并转为 base64
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          processedPhotos.push({
            dataUrl: base64,
            format: photo.format || 'jpeg',
          });
        }
      }
      return processedPhotos;
    } catch (e) {
      console.warn('pickImages failed or cancelled, fallback to input', e);
      // 如果出错可能是取消或者不支持，尝试降级（虽然pickImages不支持通常也没办法）
      // 这里如果出错直接返回空数组或者抛出
      return [];
    }
  }

  // 网页端使用 HTML input
  return captureImagesWithHtmlInput(limit);
}

/**
 * 使用 HTML input 元素多选图片的方案
 */
function captureImagesWithHtmlInput(
  limit: number
): Promise<ImageCaptureResult[]> {
  return new Promise((resolve, reject) => {
    try {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.multiple = true; // 开启多选
      fileInput.accept =
        'image/jpeg,image/png,image/webp,image/heic,image/heif';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);

      let isResolved = false;

      const timeout = setTimeout(() => {
        if (!isResolved) {
          cleanup();
          reject(new Error('图片选择超时'));
        }
      }, 60000);

      const cleanup = () => {
        clearTimeout(timeout);
        if (fileInput.parentNode) {
          document.body.removeChild(fileInput);
        }
        window.removeEventListener('focus', handleFocus);
      };

      fileInput.onchange = async e => {
        if (isResolved) return;
        const input = e.target as HTMLInputElement;

        if (!input.files || input.files.length === 0) {
          isResolved = true;
          cleanup();
          reject(new Error('未选择图片'));
          return;
        }

        if (input.files.length > limit) {
          isResolved = true;
          cleanup();
          reject(new Error(`最多只能选择 ${limit} 张图片`));
          return;
        }

        try {
          const results: ImageCaptureResult[] = [];

          for (let i = 0; i < input.files.length; i++) {
            const file = input.files[i];

            // 简单验证
            if (file.size > 50 * 1024 * 1024) continue; // 跳过过大图片

            const base64 = await new Promise<string>((res, rej) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result as string);
              reader.onerror = rej;
              reader.readAsDataURL(file);
            });

            results.push({
              dataUrl: base64,
              format: file.type.split('/')[1] || 'jpeg',
            });
          }

          isResolved = true;
          cleanup();
          resolve(results);
        } catch (error) {
          isResolved = true;
          cleanup();
          reject(error);
        }
      };

      // 检测取消
      let focusTimeout: NodeJS.Timeout;
      const handleFocus = () => {
        focusTimeout = setTimeout(() => {
          if (
            !isResolved &&
            (!fileInput.files || fileInput.files.length === 0)
          ) {
            isResolved = true;
            cleanup();
            reject(new Error('用户取消了图片选择'));
          }
        }, 3000); // 增加延时
      };
      window.addEventListener('focus', handleFocus);

      fileInput.click();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 统一的图片选择/拍照工具函数
 * 在原生平台使用 Capacitor Camera API，在网页端使用 HTML input
 */
export async function captureImage(
  options: ImageCaptureOptions
): Promise<ImageCaptureResult> {
  const {
    source,
    quality = 90,
    allowEditing = false,
    resultType = CameraResultType.DataUrl,
  } = options;

  // 在原生平台使用 Capacitor Camera API
  if (Capacitor.isNativePlatform()) {
    try {
      const image = await Camera.getPhoto({
        quality,
        allowEditing,
        resultType,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      });

      if (!image.dataUrl) {
        throw new Error('Failed to get image data');
      }

      return {
        dataUrl: image.dataUrl,
        format: image.format || 'jpeg',
      };
    } catch (error) {
      console.error('Capacitor Camera error:', error);
      // 如果 Capacitor Camera 失败，降级到 HTML input
      return captureImageWithHtmlInput(source);
    }
  } else {
    // 在网页端使用 HTML input
    return captureImageWithHtmlInput(source);
  }
}

/**
 * 使用 HTML input 元素选择图片的降级方案
 * 优化手机端兼容性和用户体验
 */
function captureImageWithHtmlInput(
  source: 'camera' | 'gallery'
): Promise<ImageCaptureResult> {
  return new Promise((resolve, reject) => {
    try {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      // 仅支持 JPG、PNG、WebP、HEIC 格式
      fileInput.accept =
        'image/jpeg,image/png,image/webp,image/heic,image/heif';
      fileInput.style.display = 'none';

      // 根据来源设置不同的capture属性
      if (source === 'camera') {
        fileInput.setAttribute('capture', 'environment');
      }

      // 添加到DOM中以确保在所有设备上正常工作
      document.body.appendChild(fileInput);

      let isResolved = false;

      // 设置超时处理，防止用户长时间不选择
      const timeout = setTimeout(() => {
        if (!isResolved) {
          cleanup();
          reject(new Error('图片选择超时，请重试'));
        }
      }, 60000); // 60秒超时

      // 清理函数
      let cleanup = () => {
        clearTimeout(timeout);
        if (fileInput.parentNode) {
          document.body.removeChild(fileInput);
        }
      };

      // 处理文件选择
      fileInput.onchange = async e => {
        if (isResolved) return;

        const input = e.target as HTMLInputElement;

        try {
          if (!input.files || input.files.length === 0) {
            // 用户取消了选择
            isResolved = true;
            cleanup();
            reject(new Error('未选择图片'));
            return;
          }

          const file = input.files[0];

          // 验证文件类型
          // 仅支持 JPG、PNG、WebP、HEIC 格式
          const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif',
          ];
          if (!allowedTypes.includes(file.type)) {
            isResolved = true;
            cleanup();
            reject(new Error('请上传 JPG、PNG 或 WebP 格式的图片'));
            return;
          }

          // 验证文件大小（最大50MB）
          if (file.size > 50 * 1024 * 1024) {
            isResolved = true;
            cleanup();
            reject(new Error('图片文件过大，请选择小于50MB的图片'));
            return;
          }

          // 读取文件
          const reader = new FileReader();

          reader.onload = () => {
            if (isResolved) return;

            isResolved = true;
            cleanup();

            const result = reader.result as string;
            if (!result) {
              reject(new Error('图片读取失败'));
              return;
            }

            resolve({
              dataUrl: result,
              format: file.type.split('/')[1] || 'jpeg',
            });
          };

          reader.onerror = () => {
            if (isResolved) return;

            isResolved = true;
            cleanup();
            reject(new Error('图片读取失败，请重试'));
          };

          // 开始读取文件
          reader.readAsDataURL(file);
        } catch (error) {
          if (isResolved) return;

          isResolved = true;
          cleanup();
          reject(
            new Error(
              '图片处理失败：' +
                (error instanceof Error ? error.message : '未知错误')
            )
          );
        }
      };

      // 处理用户取消选择（某些浏览器会触发）
      fileInput.oncancel = () => {
        if (isResolved) return;

        isResolved = true;
        cleanup();
        reject(new Error('用户取消了图片选择'));
      };

      // 监听窗口焦点变化，检测用户是否取消了选择
      let focusTimeout: NodeJS.Timeout;
      const handleFocus = () => {
        // 延迟检查，给文件选择器一些时间
        focusTimeout = setTimeout(() => {
          if (
            !isResolved &&
            (!fileInput.files || fileInput.files.length === 0)
          ) {
            // 用户可能取消了选择
            isResolved = true;
            cleanup();
            reject(new Error('图片选择被取消'));
          }
        }, 1000);
      };

      const handleBlur = () => {
        if (focusTimeout) {
          clearTimeout(focusTimeout);
        }
      };

      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);

      // 清理事件监听器
      const originalCleanup = cleanup;
      cleanup = () => {
        originalCleanup();
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
        if (focusTimeout) {
          clearTimeout(focusTimeout);
        }
      };

      // 触发文件选择器
      // 使用 setTimeout 确保在下一个事件循环中执行，提高兼容性
      setTimeout(() => {
        if (!isResolved) {
          fileInput.click();
        }
      }, 100);
    } catch (error) {
      reject(
        new Error(
          '无法打开图片选择器：' +
            (error instanceof Error ? error.message : '未知错误')
        )
      );
    }
  });
}

/**
 * 检查是否支持相机功能
 */
function isCameraSupported(): boolean {
  if (Capacitor.isNativePlatform()) {
    return true;
  }

  // 在网页端检查是否支持 getUserMedia
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * 请求相机权限（仅在原生平台有效）
 */
async function requestCameraPermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true; // 网页端不需要显式权限
  }

  try {
    const permissions = await Camera.requestPermissions();
    return permissions.camera === 'granted';
  } catch (error) {
    console.error('Failed to request camera permissions:', error);
    return false;
  }
}

/**
 * 图片压缩配置接口
 */
export interface ImageCompressionOptions {
  /** 最大文件大小（MB），默认 0.1MB (100KB) */
  maxSizeMB?: number;
  /** 最大宽度或高度，默认 1200px */
  maxWidthOrHeight?: number;
  /** 图片质量，0-1之间，默认 0.8 */
  initialQuality?: number;
  /** 输出格式，默认 'image/jpeg' */
  fileType?: string;
}

/**
 * 内部图片压缩工具函数
 * 使用 Canvas 进行高质量图片压缩
 * 确保所有图片压缩到指定大小以内，避免黑屏/白屏问题
 * 注意：此函数仅供内部使用，外部应使用 compressBase64Image
 */
async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  try {
    return await canvasCompression(file, options);
  } catch (error) {
    console.error('图片压缩失败:', error);
    throw error;
  }
}

/**
 * Canvas 图片压缩方法
 * 使用高质量 Canvas 渲染进行图片压缩
 */
async function canvasCompression(
  file: File,
  options: ImageCompressionOptions
): Promise<File> {
  const {
    maxSizeMB = 0.1,
    maxWidthOrHeight = 1200,
    initialQuality = 0.8,
    fileType = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = event => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // 计算缩放比例
          if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
            const scale = maxWidthOrHeight / Math.max(width, height);
            width = Math.floor(width * scale);
            height = Math.floor(height * scale);
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('无法创建Canvas上下文');
          }

          // 设置高质量渲染
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // 绘制图片
          ctx.drawImage(img, 0, 0, width, height);

          // 递归压缩直到达到目标大小
          let quality = initialQuality;
          const targetSize = maxSizeMB * 1024 * 1024;

          const tryCompress = () => {
            canvas.toBlob(
              blob => {
                if (!blob) {
                  reject(new Error('Canvas压缩失败'));
                  return;
                }

                if (blob.size <= targetSize || quality <= 0.1) {
                  // 创建新的File对象
                  const compressedFile = new File(
                    [blob],
                    file.name.replace(/\.[^/.]+$/, '.jpg'),
                    {
                      type: fileType,
                      lastModified: Date.now(),
                    }
                  );
                  resolve(compressedFile);
                } else {
                  // 降低质量继续压缩
                  quality = Math.max(0.1, quality - 0.1);
                  tryCompress();
                }
              },
              fileType,
              quality
            );
          };

          tryCompress();
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 压缩base64格式的图片
 * 将base64转换为File，压缩后再转回base64
 */
export async function compressBase64Image(
  base64: string,
  options: ImageCompressionOptions = {}
): Promise<string> {
  try {
    // 将base64转换为File对象
    const file = await base64ToFile(base64, 'image.jpg');

    // 使用统一的压缩函数
    const compressedFile = await compressImage(file, options);

    // 转换回base64
    return await fileToBase64(compressedFile);
  } catch (error) {
    console.error('Base64图片压缩失败:', error);
    throw error;
  }
}

/**
 * 将base64字符串转换为File对象
 * 使用手动解析方式，避免在原生App环境中fetch data URL 的兼容性问题
 */
async function base64ToFile(base64: string, filename: string): Promise<File> {
  // 解析 base64 data URL
  const arr = base64.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * 将File对象转换为base64字符串
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
