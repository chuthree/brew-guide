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

/**
 * 统一的图片选择/拍照工具函数
 * 在原生平台使用 Capacitor Camera API，在网页端使用 HTML input
 */
export async function captureImage(options: ImageCaptureOptions): Promise<ImageCaptureResult> {
  const { source, quality = 90, allowEditing = false, resultType = CameraResultType.DataUrl } = options;

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
        format: image.format || 'jpeg'
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
 */
function captureImageWithHtmlInput(source: 'camera' | 'gallery'): Promise<ImageCaptureResult> {
  return new Promise((resolve, reject) => {
    try {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      
      // 根据来源设置不同的capture属性
      if (source === 'camera') {
        fileInput.setAttribute('capture', 'environment');
      }
      
      fileInput.onchange = (e) => {
        const input = e.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
          reject(new Error('No file selected'));
          return;
        }
        
        const file = input.files[0];
        if (!file.type.startsWith('image/')) {
          reject(new Error('Selected file is not an image'));
          return;
        }
        
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            dataUrl: reader.result as string,
            format: file.type.split('/')[1] || 'jpeg'
          });
        };
        reader.onerror = () => {
          reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
      };
      
      fileInput.click();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 检查是否支持相机功能
 */
export function isCameraSupported(): boolean {
  if (Capacitor.isNativePlatform()) {
    return true;
  }
  
  // 在网页端检查是否支持 getUserMedia
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * 请求相机权限（仅在原生平台有效）
 */
export async function requestCameraPermissions(): Promise<boolean> {
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
