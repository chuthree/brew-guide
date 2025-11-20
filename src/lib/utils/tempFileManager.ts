import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

/**
 * 分享选项接口
 */
interface ShareOptions {
  title: string;
  text: string;
  dialogTitle: string;
}

/**
 * 临时文件管理器
 * 提供统一的临时文件创建、分享和自动清理功能
 */
export class TempFileManager {
  private static readonly TEMP_FILE_PREFIX = 'brew-guide-temp-';

  /**
   * 保存图片到相册
   * @param imageData base64格式的图片数据（支持带 data:image/png;base64, 前缀或纯 base64）
   * @returns Promise<void>
   */
  static async saveImageToGallery(imageData: string): Promise<void> {
    // Web 平台直接下载
    if (!Capacitor.isNativePlatform()) {
      const link = document.createElement('a');
      link.download = `brew-guide-${new Date().getTime()}.png`;
      link.href = imageData;
      link.click();
      return;
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
        } catch (albumError) {
          // 相册不存在，保存到系统相册
          await Media.savePhoto({
            path: fileUri.uri,
          });
        }
      }

      // 步骤4: 清理临时文件
      await this.cleanupTempFile(tempFileName);
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
   * @returns Promise<void>
   */
  static async shareImageFile(
    imageData: string,
    fileName: string,
    shareOptions: ShareOptions
  ): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await this.shareImageFileNative(imageData, fileName, shareOptions);
    } else {
      await this.shareImageFileWeb(imageData, fileName);
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
   * Web平台图片分享（直接下载）
   */
  private static async shareImageFileWeb(
    imageData: string,
    fileName: string
  ): Promise<void> {
    const link = document.createElement('a');
    link.download = `${fileName}-${new Date().getTime()}.png`;
    link.href = imageData;
    link.click();

    // Web平台不需要清理，因为没有创建持久化文件
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
  ): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await this.shareJsonFileNative(jsonData, fileName, shareOptions);
    } else {
      await this.shareJsonFileWeb(jsonData, fileName);
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
    const timestamp = new Date().getTime();
    const fullFileName = `${this.TEMP_FILE_PREFIX}${fileName}-${timestamp}.json`;

    try {
      // 写入临时文件
      await Filesystem.writeFile({
        path: fullFileName,
        data: jsonData,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
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
        url: uriResult.uri,
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
   * Web平台JSON文件分享（直接下载）
   */
  private static async shareJsonFileWeb(
    jsonData: string,
    fileName: string
  ): Promise<void> {
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = `${fileName}-${new Date().getTime()}.json`;
    link.href = url;
    link.click();

    // 清理URL对象
    URL.revokeObjectURL(url);
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
