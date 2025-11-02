/**
 * 烘焙商图标设置器
 * 管理烘焙商的 Logo 图标，包括上传、存储、获取等功能
 */

import { compressImage } from '@/lib/utils/imageCompression';

export interface RoasterLogo {
  roasterName: string; // 烘焙商名称
  logoData: string; // Base64 编码的图片数据
  updatedAt: number; // 更新时间戳
}

const STORAGE_KEY = 'roaster-logos';

class RoasterLogoManager {
  /**
   * 获取所有烘焙商图标
   */
  async getAllLogos(): Promise<RoasterLogo[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to get roaster logos:', error);
      return [];
    }
  }

  /**
   * 获取指定烘焙商的图标
   */
  async getLogoByRoaster(roasterName: string): Promise<string | null> {
    try {
      const logos = await this.getAllLogos();
      const logo = logos.find(l => l.roasterName === roasterName);
      return logo?.logoData || null;
    } catch (error) {
      console.error('Failed to get logo for roaster:', roasterName, error);
      return null;
    }
  }

  /**
   * 设置或更新烘焙商图标
   */
  async setLogo(roasterName: string, logoData: string): Promise<boolean> {
    try {
      const logos = await this.getAllLogos();
      const existingIndex = logos.findIndex(l => l.roasterName === roasterName);

      const newLogo: RoasterLogo = {
        roasterName,
        logoData,
        updatedAt: Date.now(),
      };

      if (existingIndex >= 0) {
        logos[existingIndex] = newLogo;
      } else {
        logos.push(newLogo);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(logos));
      return true;
    } catch (error) {
      console.error('Failed to set logo for roaster:', roasterName, error);
      return false;
    }
  }

  /**
   * 删除指定烘焙商的图标
   */
  async deleteLogo(roasterName: string): Promise<boolean> {
    try {
      const logos = await this.getAllLogos();
      const filteredLogos = logos.filter(l => l.roasterName !== roasterName);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredLogos));
      return true;
    } catch (error) {
      console.error('Failed to delete logo for roaster:', roasterName, error);
      return false;
    }
  }

  /**
   * 将图片文件转换为 Base64
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * 上传并设置烘焙商图标
   * 使用统一的图片压缩工具压缩为正方形图标，限制文件大小
   */
  async uploadLogo(roasterName: string, file: File): Promise<boolean> {
    try {
      // 使用统一的压缩工具压缩图片（正方形 200x200，限制 50KB 以内）
      const compressedFile = await compressImage(file, {
        maxWidth: 200,
        maxHeight: 200,
        quality: 0.85,
        mimeType: 'image/jpeg',
        maxSizeMB: 0.05, // 限制 50KB，适合图标
      });

      // 转换为 Base64
      const base64Data = await this.fileToBase64(compressedFile);

      // 保存图标
      return await this.setLogo(roasterName, base64Data);
    } catch (error) {
      console.error('Failed to upload logo:', error);
      return false;
    }
  }

  /**
   * 批量导出所有图标（用于备份）
   */
  async exportLogos(): Promise<string> {
    const logos = await this.getAllLogos();
    return JSON.stringify(logos, null, 2);
  }

  /**
   * 批量导入图标（用于恢复）
   */
  async importLogos(jsonData: string): Promise<boolean> {
    try {
      const logos = JSON.parse(jsonData) as RoasterLogo[];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logos));
      return true;
    } catch (error) {
      console.error('Failed to import logos:', error);
      return false;
    }
  }
}

// 导出单例实例
export default new RoasterLogoManager();
