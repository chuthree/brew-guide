import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { saveImageToAndroidGallery } from './nativeGallerySaver';
import {
  isAndroidDocumentSaverUnavailable,
  saveFileWithAndroidDocumentPicker,
} from './nativeDocumentSaver';
import { getIsIOS, getIsStandalone } from './pwaInstallEnvironment';

/**
 * 分享选项接口
 */
interface ShareOptions {
  title: string;
  text: string;
  dialogTitle: string;
}

export type JsonFileSaveMode =
  | 'web-download'
  | 'android-document'
  | 'ios-document'
  | 'tauri-document'
  | 'native-share'
  | 'cancelled'
  | 'activation-required';

export type ImageSaveOutcome =
  | 'saved'
  | 'downloaded'
  | 'shared'
  | 'cancelled'
  | 'activation-required';

export type FileShareOutcome = Exclude<ImageSaveOutcome, 'saved'>;

/**
 * 临时文件管理器
 * 提供统一的临时文件创建、分享和自动清理功能
 */
export class TempFileManager {
  private static readonly TEMP_FILE_PREFIX = 'brew-guide-temp-';
  private static readonly NATIVE_TEXT_CHUNK_SIZE = 128 * 1024;
  private static readonly JSON_MIME_TYPE = 'application/json';
  private static pendingIOSPWAShare:
    | {
        file: File;
        shareOptions: Pick<ShareOptions, 'title' | 'text'>;
        unsupportedMessage: string;
      }
    | undefined;
  private static pendingIOSPWAShareAbort: AbortController | undefined;

  private static isUserActivationExpired(): boolean {
    return navigator.userActivation?.isActive === false;
  }

  private static createTempFileName(fileName: string): string {
    const sanitizedFileName = fileName.replace(/[\\/:*?"<>|]/g, '-');
    return `${this.TEMP_FILE_PREFIX}${Date.now()}-${sanitizedFileName}`;
  }

  private static createImageFile(imageData: string, fileName: string): File {
    const match = imageData.match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) {
      throw new Error('图片数据格式无效');
    }

    const [, mimeType, base64Data] = match;
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new File([bytes], fileName, { type: mimeType });
  }

  private static createJsonFile(jsonData: string, fileName: string): File {
    return new File([jsonData], fileName, { type: this.JSON_MIME_TYPE });
  }

  private static async blobToBase64Data(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('文件数据读取失败'));
          return;
        }

        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(new Error('文件数据读取失败'));
      reader.readAsDataURL(blob);
    });
  }

  private static downloadImage(imageData: string, fileName: string): void {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = imageData;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private static downloadBlob(data: Blob, fileName: string): void {
    const url = URL.createObjectURL(data);

    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
  }

  private static async shareFileInIOSPWA(
    file: File,
    shareOptions: Pick<ShareOptions, 'title' | 'text'>,
    unsupportedMessage: string,
    retryOnNextClick = false
  ): Promise<Exclude<FileShareOutcome, 'downloaded'>> {
    const shareData: ShareData = {
      files: [file],
      title: shareOptions.title,
    };

    if (shareOptions.text) {
      shareData.text = shareOptions.text;
    }

    if (
      typeof navigator.share !== 'function' ||
      (typeof navigator.canShare === 'function' &&
        !navigator.canShare(shareData))
    ) {
      throw new Error(unsupportedMessage);
    }

    if (this.isUserActivationExpired()) {
      if (retryOnNextClick) {
        this.scheduleIOSPWAShareRetry(file, shareOptions, unsupportedMessage);
      }
      return 'activation-required';
    }

    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
      if (
        error instanceof DOMException &&
        error.name === 'NotAllowedError' &&
        this.isUserActivationExpired()
      ) {
        if (retryOnNextClick) {
          this.scheduleIOSPWAShareRetry(file, shareOptions, unsupportedMessage);
        }
        return 'activation-required';
      }
      throw error;
    }
  }

  private static scheduleIOSPWAShareRetry(
    file: File,
    shareOptions: Pick<ShareOptions, 'title' | 'text'>,
    unsupportedMessage: string
  ): void {
    if (typeof document === 'undefined') return;
    if (typeof document.addEventListener !== 'function') return;

    this.pendingIOSPWAShareAbort?.abort();
    this.pendingIOSPWAShare = { file, shareOptions, unsupportedMessage };

    const controller = new AbortController();
    this.pendingIOSPWAShareAbort = controller;

    document.addEventListener(
      'click',
      event => {
        const pendingShare = this.pendingIOSPWAShare;
        if (!pendingShare) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        controller.abort();
        if (this.pendingIOSPWAShareAbort === controller) {
          this.pendingIOSPWAShareAbort = undefined;
        }
        this.pendingIOSPWAShare = undefined;

        void this.shareFileInIOSPWA(
          pendingShare.file,
          pendingShare.shareOptions,
          pendingShare.unsupportedMessage
        ).catch(error => {
          console.error('分享文件失败:', error);
        });
      },
      { capture: true, once: true, signal: controller.signal }
    );
  }

  private static async shareImageInIOSPWA(
    imageData: string,
    fileName: string
  ): Promise<ImageSaveOutcome> {
    return this.shareFileInIOSPWA(
      this.createImageFile(imageData, fileName),
      {
        title: 'Brew Guide 图片',
        text: '',
      },
      '当前设备不支持分享图片文件'
    );
  }

  private static async shareJsonInIOSPWA(
    jsonData: string,
    fileName: string,
    shareOptions: ShareOptions
  ): Promise<JsonFileSaveMode> {
    const outcome = await this.shareFileInIOSPWA(
      this.createJsonFile(jsonData, fileName),
      shareOptions,
      '当前设备不支持分享数据文件'
    );

    return outcome === 'shared' ? 'native-share' : outcome;
  }

  /**
   * 保存图片到相册
   * @param imageData base64格式的图片数据（支持带 data:image/png;base64, 前缀或纯 base64）
   * @returns 可用于区分直接保存、下载、分享和用户取消的结果
   */
  static async saveImageToGallery(
    imageData: string
  ): Promise<ImageSaveOutcome> {
    if (!Capacitor.isNativePlatform()) {
      const fileName = `brew-guide-${Date.now()}.png`;
      if (getIsIOS() && getIsStandalone()) {
        return this.shareImageInIOSPWA(imageData, fileName);
      }
      this.downloadImage(imageData, fileName);
      return 'downloaded';
    }

    if (Capacitor.getPlatform() === 'android') {
      await saveImageToAndroidGallery(
        imageData,
        `brew-guide-${new Date().getTime()}`
      );
      return 'saved';
    }

    const timestamp = new Date().getTime();
    const tempFileName = `${this.TEMP_FILE_PREFIX}save-${timestamp}.png`;

    try {
      // 确保正确处理base64数据（去掉 data:image/png;base64, 前缀）
      const base64Data = imageData.includes(',')
        ? imageData.split(',')[1]
        : imageData;

      // 步骤1: 先将 base64 保存为临时文件
      await Filesystem.writeFile({
        path: tempFileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      // 步骤2: 获取文件的完整路径
      const fileUri = await Filesystem.getUri({
        path: tempFileName,
        directory: Directory.Cache,
      });

      // 步骤3: 使用 Media 插件保存到相册
      const { Media } = await import('@capacitor-community/media');
      const platform = Capacitor.getPlatform();

      if (platform === 'android') {
        // Android: 先获取相册列表，找到可用的相册 identifier
        try {
          const albums = await Media.getAlbums();

          // 查找是否已有 BrewGuide 相册
          let albumId = albums.albums?.find(
            (a: any) => a.name === 'BrewGuide'
          )?.identifier;

          if (!albumId) {
            // 创建新相册
            const result: any = await Media.createAlbum({ name: 'BrewGuide' });
            albumId = result?.identifier;
          }

          // 如果还是没有 albumId，使用第一个可用相册
          if (!albumId && albums.albums && albums.albums.length > 0) {
            albumId = albums.albums[0].identifier;
          }

          // 保存照片
          if (albumId) {
            await Media.savePhoto({
              path: fileUri.uri,
              albumIdentifier: albumId,
            });
          } else {
            // 最后尝试：不指定相册直接保存（可能保存到默认位置）
            throw new Error('无法找到或创建相册，尝试其他方式');
          }
        } catch (error) {
          console.error('Android 相册保存失败:', error);
          throw error; // 抛出错误让外层处理
        }
      } else {
        // iOS: 尝试保存到自定义相册，如果失败则保存到系统相册
        try {
          await Media.savePhoto({
            path: fileUri.uri,
            albumIdentifier: 'BrewGuide',
          });
        } catch (_albumError) {
          // 相册不存在，保存到系统相册
          await Media.savePhoto({
            path: fileUri.uri,
          });
        }
      }

      // 步骤4: 清理临时文件
      await this.cleanupTempFile(tempFileName);
      return 'saved';
    } catch (error) {
      // 即使失败也要尝试清理临时文件
      try {
        await this.cleanupTempFile(tempFileName);
      } catch (cleanupError) {
        console.warn('清理临时文件失败:', cleanupError);
      }
      console.error('保存到相册失败:', error);
      throw error;
    }
  }

  /**
   * 创建临时图片文件并分享
   * @param imageData base64格式的图片数据
   * @param fileName 文件名（不包含扩展名）
   * @param shareOptions 分享选项
   * @returns 导出方式或分享状态
   */
  static async shareImageFile(
    imageData: string,
    fileName: string,
    shareOptions: ShareOptions
  ): Promise<FileShareOutcome> {
    if (Capacitor.isNativePlatform()) {
      await this.shareImageFileNative(imageData, fileName, shareOptions);
      return 'shared';
    } else {
      return this.shareImageFileWeb(imageData, fileName, shareOptions);
    }
  }

  /**
   * 原生平台图片分享（带自动清理）
   */
  private static async shareImageFileNative(
    imageData: string,
    fileName: string,
    shareOptions: ShareOptions
  ): Promise<void> {
    const timestamp = new Date().getTime();
    const fullFileName = `${this.TEMP_FILE_PREFIX}${fileName}-${timestamp}.png`;

    try {
      // 确保正确处理base64数据
      const base64Data = imageData.split(',')[1];

      // 写入临时文件
      await Filesystem.writeFile({
        path: fullFileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      // 获取文件URI
      const uriResult = await Filesystem.getUri({
        path: fullFileName,
        directory: Directory.Cache,
      });

      // 分享文件
      await Share.share({
        title: shareOptions.title,
        text: shareOptions.text,
        files: [uriResult.uri],
        dialogTitle: shareOptions.dialogTitle,
      });

      // 分享完成后立即清理临时文件
      await this.cleanupTempFile(fullFileName);
    } catch (error) {
      // 即使分享失败也要尝试清理文件
      try {
        await this.cleanupTempFile(fullFileName);
      } catch (cleanupError) {
        console.warn('清理临时文件失败:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Web平台图片分享：iOS PWA 使用系统分享，其他浏览器直接下载。
   */
  private static async shareImageFileWeb(
    imageData: string,
    fileName: string,
    shareOptions: ShareOptions
  ): Promise<FileShareOutcome> {
    const downloadFileName = `${fileName}-${new Date().getTime()}.png`;

    if (getIsIOS() && getIsStandalone()) {
      return this.shareFileInIOSPWA(
        this.createImageFile(imageData, downloadFileName),
        shareOptions,
        '当前设备不支持分享图片文件',
        true
      );
    }

    this.downloadImage(imageData, downloadFileName);
    return 'downloaded';
  }

  /**
   * 创建临时二进制文件并分享。iOS PWA 优先使用系统分享，其他 Web 端直接下载。
   */
  static async shareBinaryFile(
    data: Blob,
    fileName: string,
    shareOptions: ShareOptions
  ): Promise<FileShareOutcome> {
    if (Capacitor.isNativePlatform()) {
      await this.shareBinaryFileNative(data, fileName, shareOptions);
      return 'shared';
    } else {
      return this.shareBinaryFileWeb(data, fileName, shareOptions);
    }
  }

  private static async shareBinaryFileNative(
    data: Blob,
    fileName: string,
    shareOptions: ShareOptions
  ): Promise<void> {
    const fullFileName = this.createTempFileName(fileName);

    try {
      await Filesystem.writeFile({
        path: fullFileName,
        data: await this.blobToBase64Data(data),
        directory: Directory.Cache,
        recursive: true,
      });

      const uriResult = await Filesystem.getUri({
        path: fullFileName,
        directory: Directory.Cache,
      });

      await Share.share({
        title: shareOptions.title,
        text: shareOptions.text,
        files: [uriResult.uri],
        dialogTitle: shareOptions.dialogTitle,
      });

      await this.cleanupTempFile(fullFileName);
    } catch (error) {
      try {
        await this.cleanupTempFile(fullFileName);
      } catch (cleanupError) {
        console.warn('清理临时文件失败:', cleanupError);
      }
      throw error;
    }
  }

  private static async shareBinaryFileWeb(
    data: Blob,
    fileName: string,
    shareOptions: ShareOptions
  ): Promise<FileShareOutcome> {
    if (getIsIOS() && getIsStandalone()) {
      const file = new File([data], fileName, {
        type: data.type || 'application/octet-stream',
      });
      return this.shareFileInIOSPWA(
        file,
        shareOptions,
        '当前设备不支持分享文件',
        true
      );
    }

    this.downloadBlob(data, fileName);
    return 'downloaded';
  }

  /**
   * 创建临时JSON文件并分享
   * @param jsonData JSON字符串数据
   * @param fileName 文件名（不包含扩展名）
   * @param shareOptions 分享选项
   * @returns Promise<void>
   */
  static async shareJsonFile(
    jsonData: string,
    fileName: string,
    shareOptions: ShareOptions
  ): Promise<JsonFileSaveMode> {
    if (Capacitor.isNativePlatform()) {
      await this.shareJsonFileNative(jsonData, fileName, shareOptions);
      return 'native-share';
    } else {
      return this.shareJsonFileWeb(jsonData, fileName, shareOptions);
    }
  }

  /**
   * 保存JSON文件到用户选择的位置。Android 使用系统文件创建器，避免依赖分享面板。
   */
  static async saveJsonFile(
    jsonData: string,
    fileName: string,
    shareOptions: ShareOptions = {
      title: '导出数据',
      text: '请选择保存位置',
      dialogTitle: '导出数据',
    }
  ): Promise<JsonFileSaveMode> {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { invoke } = await import('@tauri-apps/api/core');
      const saved = await invoke<boolean>('migration_save_backup', {
        data: jsonData,
        fileName,
      });
      return saved ? 'tauri-document' : 'cancelled';
    }
    if (!Capacitor.isNativePlatform()) {
      return this.shareJsonFileWeb(jsonData, fileName, shareOptions);
    }

    if (Capacitor.getPlatform() === 'android') {
      try {
        return await this.saveJsonFileWithAndroidDocumentPicker(
          jsonData,
          fileName
        );
      } catch (error) {
        if (!isAndroidDocumentSaverUnavailable(error)) {
          throw error;
        }

        console.warn('Android 文档保存插件不可用，回退到系统分享导出:', error);
        await this.shareJsonFileNative(jsonData, fileName, shareOptions);
        return 'native-share';
      }
    }

    if (Capacitor.getPlatform() === 'ios') {
      return this.saveJsonFileWithIOSDocumentPicker(jsonData, fileName);
    }
    await this.shareJsonFileNative(jsonData, fileName, shareOptions);
    return 'native-share';
  }

  private static async saveJsonFileWithIOSDocumentPicker(
    jsonData: string,
    fileName: string
  ): Promise<'ios-document' | 'cancelled'> {
    const tempName = this.createTempFileName(fileName);
    try {
      await this.writeUtf8TextFile(tempName, jsonData);
      const { uri } = await Filesystem.getUri({
        path: tempName,
        directory: Directory.Cache,
      });
      const { saveFileWithIOSDocumentPicker } =
        await import('./nativeDocumentSaver');
      const hash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(jsonData)
      );
      const sha256 = Array.from(new Uint8Array(hash), byte =>
        byte.toString(16).padStart(2, '0')
      ).join('');
      const outcome = await saveFileWithIOSDocumentPicker({
        sourceUri: uri,
        fileName,
        mimeType: this.JSON_MIME_TYPE,
        sha256,
      });
      return outcome === 'saved' ? 'ios-document' : 'cancelled';
    } finally {
      await this.cleanupTempFile(tempName);
    }
  }

  private static async saveJsonFileWithAndroidDocumentPicker(
    jsonData: string,
    fileName: string
  ): Promise<'android-document' | 'cancelled'> {
    const fullFileName = this.createTempFileName(fileName);

    try {
      await this.writeUtf8TextFile(fullFileName, jsonData);

      const uriResult = await Filesystem.getUri({
        path: fullFileName,
        directory: Directory.Cache,
      });

      const outcome = await saveFileWithAndroidDocumentPicker({
        sourceUri: uriResult.uri,
        fileName,
        mimeType: this.JSON_MIME_TYPE,
      });

      await this.cleanupTempFile(fullFileName);
      return outcome === 'cancelled' ? 'cancelled' : 'android-document';
    } catch (error) {
      try {
        await this.cleanupTempFile(fullFileName);
      } catch (cleanupError) {
        console.warn('清理临时文件失败:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * 原生平台JSON文件分享（带自动清理）
   */
  private static async shareJsonFileNative(
    jsonData: string,
    fileName: string,
    shareOptions: ShareOptions
  ): Promise<void> {
    const fullFileName = this.createTempFileName(fileName);

    try {
      // Android 在大文本单次 writeFile 时可能出现跨桥负载过大，改为统一分块写入。
      await this.writeUtf8TextFile(fullFileName, jsonData);

      // 获取文件URI
      const uriResult = await Filesystem.getUri({
        path: fullFileName,
        directory: Directory.Cache,
      });

      // 分享文件
      await Share.share({
        title: shareOptions.title,
        text: shareOptions.text,
        files: [uriResult.uri],
        dialogTitle: shareOptions.dialogTitle,
      });

      // 分享完成后立即清理临时文件
      await this.cleanupTempFile(fullFileName);
    } catch (error) {
      // 即使分享失败也要尝试清理文件
      try {
        await this.cleanupTempFile(fullFileName);
      } catch (cleanupError) {
        console.warn('清理临时文件失败:', cleanupError);
      }
      throw error;
    }
  }

  private static async writeUtf8TextFile(
    path: string,
    data: string
  ): Promise<void> {
    const chunkSize = this.NATIVE_TEXT_CHUNK_SIZE;
    const firstChunk = data.slice(0, chunkSize);

    await Filesystem.writeFile({
      path,
      data: firstChunk,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    for (let offset = chunkSize; offset < data.length; offset += chunkSize) {
      await Filesystem.appendFile({
        path,
        data: data.slice(offset, offset + chunkSize),
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
    }
  }

  /**
   * Web平台JSON文件分享：iOS PWA 使用系统分享，其他浏览器直接下载。
   */
  private static async shareJsonFileWeb(
    jsonData: string,
    fileName: string,
    shareOptions: ShareOptions
  ): Promise<JsonFileSaveMode> {
    if (getIsIOS() && getIsStandalone()) {
      return this.shareJsonInIOSPWA(jsonData, fileName, shareOptions);
    }

    const blob = new Blob([jsonData], { type: 'application/json' });
    this.downloadBlob(blob, fileName);
    return 'web-download';
  }

  /**
   * 清理单个临时文件
   */
  private static async cleanupTempFile(fileName: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return; // Web平台不需要清理
    }

    try {
      await Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Cache,
      });
      console.warn(`临时文件已清理: ${fileName}`);
    } catch (error) {
      console.warn(`清理临时文件失败: ${fileName}`, error);
    }
  }

  /**
   * 清理所有临时文件
   * 应在应用启动时调用，清理所有遗留的临时文件
   */
  static async cleanupExpiredTempFiles(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return; // Web平台不需要清理
    }

    try {
      // 获取缓存目录中的所有文件
      const result = await Filesystem.readdir({
        path: '',
        directory: Directory.Cache,
      });

      let cleanedCount = 0;

      // 遍历文件，清理所有临时文件（不管时间，因为都是一次性使用）
      for (const file of result.files) {
        if (file.name.startsWith(this.TEMP_FILE_PREFIX)) {
          try {
            await Filesystem.deleteFile({
              path: file.name,
              directory: Directory.Cache,
            });
            cleanedCount++;
            console.warn(`已清理遗留临时文件: ${file.name}`);
          } catch (error) {
            console.warn(`清理临时文件失败: ${file.name}`, error);
          }
        }
      }

      if (cleanedCount > 0) {
        console.warn(`临时文件清理完成，共清理 ${cleanedCount} 个遗留文件`);
      }
    } catch (error) {
      console.warn('清理临时文件失败:', error);
    }
  }

  /**
   * 获取当前临时文件数量和总大小（用于调试）
   */
  static async getTempFileStats(): Promise<{
    count: number;
    totalSize: number;
  }> {
    if (!Capacitor.isNativePlatform()) {
      return { count: 0, totalSize: 0 };
    }

    try {
      const result = await Filesystem.readdir({
        path: '',
        directory: Directory.Cache,
      });

      let count = 0;
      const totalSize = 0;

      for (const file of result.files) {
        if (file.name.startsWith(this.TEMP_FILE_PREFIX)) {
          count++;
          // 注意：Capacitor的readdir不提供文件大小信息
          // 这里只能统计文件数量
        }
      }

      return { count, totalSize };
    } catch (error) {
      console.warn('获取临时文件统计失败:', error);
      return { count: 0, totalSize: 0 };
    }
  }
}
