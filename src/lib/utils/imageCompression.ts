/**
 * 图片压缩工具
 * 用于在上传前压缩图片，减少网络传输时间
 */

export interface CompressionOptions {
  maxWidth?: number; // 最大宽度，默认 1920
  maxHeight?: number; // 最大高度，默认 1920
  quality?: number; // 图片质量 0-1，默认 0.8
  mimeType?: string; // 输出格式，默认 'image/jpeg'
  maxSizeMB?: number; // 最大文件大小（MB），如果指定则会循环压缩直到达到目标
}

/**
 * 压缩图片文件
 * @param file 原始图片文件
 * @param options 压缩选项
 * @returns 压缩后的文件
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    mimeType = 'image/jpeg',
    maxSizeMB,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      const img = new Image();

      img.onload = () => {
        // 计算压缩后的尺寸
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // 创建 canvas 进行压缩
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 canvas context'));
          return;
        }

        // 设置高质量渲染
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height);

        // 如果指定了最大文件大小，则循环压缩
        if (maxSizeMB) {
          const targetSize = maxSizeMB * 1024 * 1024;
          let currentQuality = quality;

          const tryCompress = () => {
            canvas.toBlob(
              blob => {
                if (!blob) {
                  reject(new Error('图片压缩失败'));
                  return;
                }

                // 达到目标大小或质量已经很低了
                if (blob.size <= targetSize || currentQuality <= 0.1) {
                  const compressedFile = new File([blob], file.name, {
                    type: mimeType,
                    lastModified: Date.now(),
                  });

                  console.log(
                    `📦 图片压缩完成: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% 压缩率, 质量: ${Math.round(currentQuality * 100)}%)`
                  );

                  resolve(compressedFile);
                } else {
                  // 降低质量继续压缩
                  currentQuality = Math.max(0.1, currentQuality - 0.1);
                  tryCompress();
                }
              },
              mimeType,
              currentQuality
            );
          };

          tryCompress();
        } else {
          // 不限制文件大小，直接压缩一次
          canvas.toBlob(
            blob => {
              if (!blob) {
                reject(new Error('图片压缩失败'));
                return;
              }

              const compressedFile = new File([blob], file.name, {
                type: mimeType,
                lastModified: Date.now(),
              });

              console.log(
                `📦 图片压缩完成: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% 压缩率)`
              );

              resolve(compressedFile);
            },
            mimeType,
            quality
          );
        }
      };

      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 智能压缩：根据文件大小自动选择压缩策略
 * @param file 原始图片文件
 * @returns 压缩后的文件
 */
export async function smartCompress(file: File): Promise<File> {
  const fileSizeKB = file.size / 1024;

  // AI 识别专用：强力压缩到 100KB 以内，提升识别速度
  console.log(
    `📸 原始图片大小: ${fileSizeKB.toFixed(1)}KB，开始压缩以加速 AI 识别...`
  );

  // 所有图片都压缩，目标是 80-100KB
  return compressImage(file, {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.75,
    maxSizeMB: 0.1, // 限制在 100KB 以内
  });
}
