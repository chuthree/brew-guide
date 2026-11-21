import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FilePicker, type PickedFile } from '@capawesome/capacitor-file-picker';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { IMAGE_FILE_ACCEPT } from '@/lib/images/imageFormat';
import { validateImageFileSize } from '@/lib/images/imageProcessing';

export function shouldUseNativeGalleryPicker() {
  return Capacitor.isNativePlatform();
}

export function isImageSelectionCancelled(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return /cancel|cancelled|canceled|用户取消|未选择/i.test(message);
}

function fileDataToBlob(data: string | Blob, mimeType: string) {
  if (typeof data !== 'string') {
    return data.type ? data : new Blob([data], { type: mimeType });
  }

  const base64 = data.includes(',') ? data.split(',').pop() || '' : data;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

async function galleryPhotoToFile(
  photo: PickedFile,
  maxFileSizeBytes?: number
) {
  if (!photo.path) throw new Error('无法读取所选图片');
  validateImageFileSize(photo.size, maxFileSizeBytes);

  const { data } = await Filesystem.readFile({ path: photo.path });
  return new File([fileDataToBlob(data, photo.mimeType)], photo.name, {
    type: photo.mimeType,
    lastModified: photo.modifiedAt,
  });
}

export async function pickNativeGalleryImageFiles({
  limit,
  maxFileSizeBytes,
}: {
  limit: number;
  maxFileSizeBytes?: number;
}) {
  const pickerLimit =
    Capacitor.getPlatform() === 'android' && limit > 1 ? 0 : limit;
  const { files: selected } = await FilePicker.pickImages({
    limit: pickerLimit,
    skipTranscoding: true,
  });
  const files: File[] = [];
  const errors: string[] = [];
  for (const photo of selected) {
    if (files.length >= limit) {
      errors.push(`最多选择 ${limit} 张图片`);
      break;
    }
    try {
      files.push(await galleryPhotoToFile(photo, maxFileSizeBytes));
    } catch (error) {
      errors.push(
        `${photo.name}：${error instanceof Error ? error.message : '图片读取失败'}`
      );
    }
  }
  return { files, errors };
}

export async function captureImage(
  source: 'camera' | 'gallery'
): Promise<File> {
  if (!Capacitor.isNativePlatform()) return captureImageWithHtmlInput(source);
  if (source === 'gallery') {
    const { files, errors } = await pickNativeGalleryImageFiles({ limit: 1 });
    if (!files.length) throw new Error(errors[0] || '未选择图片');
    return files[0];
  }
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
    });
    if (!image.path) throw new Error('无法读取拍摄的图片');
    const { data } = await Filesystem.readFile({ path: image.path });
    const type = `image/${image.format}`;
    return new File([fileDataToBlob(data, type)], `image.${image.format}`, {
      type,
    });
  } catch (error) {
    if (isImageSelectionCancelled(error)) throw error;
    console.error('Capacitor Camera error:', error);
    return captureImageWithHtmlInput(source);
  }
}

/**
 * 使用 HTML input 元素选择图片的降级方案
 * 优化手机端兼容性和用户体验
 */
function captureImageWithHtmlInput(
  source: 'camera' | 'gallery'
): Promise<File> {
  return new Promise((resolve, reject) => {
    try {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = IMAGE_FILE_ACCEPT;
      fileInput.style.display = 'none';

      // 根据来源设置不同的capture属性
      if (source === 'camera') {
        fileInput.setAttribute('capture', 'environment');
      }

      // 添加到DOM中以确保在所有设备上正常工作
      document.body.appendChild(fileInput);

      let isResolved = false;

      // 清理函数
      let cleanup = () => {
        if (fileInput.parentNode) {
          document.body.removeChild(fileInput);
        }
      };

      // 处理文件选择
      fileInput.onchange = () => {
        if (isResolved) return;
        isResolved = true;
        const file = fileInput.files?.[0];
        cleanup();
        if (file) resolve(file);
        else reject(new Error('未选择图片'));
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
            reject(new Error('用户取消了图片选择'));
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

      // 保留打开系统相机所需的用户点击上下文。
      fileInput.click();
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
