/**
 * 烘焙商图标设置器
 * 管理烘焙商的 Logo 图标，包括上传、存储、获取等功能
 */

import { compressImage } from '@/lib/utils/imageCompression';

export interface RoasterFlavorPeriod {
  light: { startDay: number; endDay: number };
  medium: { startDay: number; endDay: number };
  dark: { startDay: number; endDay: number };
}

export interface RoasterConfig {
  roasterName: string; // 烘焙商名称
  logoData?: string; // Base64 编码的图片数据
  flavorPeriod?: RoasterFlavorPeriod; // 自定义赏味期设置
  updatedAt: number; // 更新时间戳
}

const STORAGE_KEY = 'roaster-logos';

class RoasterLogoManager {
  /**
   * 获取所有烘焙商配置
   */
  async getAllConfigs(): Promise<RoasterConfig[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to get roaster configs:', error);
      return [];
    }
  }

  /**
   * 同步获取所有烘焙商配置
   */
  getAllConfigsSync(): RoasterConfig[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to get roaster configs sync:', error);
      return [];
    }
  }

  /**
   * 获取所有烘焙商图标 (兼容旧接口)
   */
  async getAllLogos(): Promise<RoasterConfig[]> {
    return this.getAllConfigs();
  }

  /**
   * 获取指定烘焙商的配置
   */
  async getConfigByRoaster(roasterName: string): Promise<RoasterConfig | null> {
    try {
      const configs = await this.getAllConfigs();
      return configs.find(c => c.roasterName === roasterName) || null;
    } catch (error) {
      console.error('Failed to get config for roaster:', roasterName, error);
      return null;
    }
  }

  /**
   * 同步获取指定烘焙商的配置
   */
  getConfigByRoasterSync(roasterName: string): RoasterConfig | null {
    try {
      const configs = this.getAllConfigsSync();
      return configs.find(c => c.roasterName === roasterName) || null;
    } catch (error) {
      console.error(
        'Failed to get config for roaster sync:',
        roasterName,
        error
      );
      return null;
    }
  }

  /**
   * 获取指定烘焙商的图标 (兼容旧接口)
   */
  async getLogoByRoaster(roasterName: string): Promise<string | null> {
    const config = await this.getConfigByRoaster(roasterName);
    return config?.logoData || null;
  }

  /**
   * 更新烘焙商配置
   */
  async updateConfig(
    roasterName: string,
    updates: Partial<Omit<RoasterConfig, 'roasterName' | 'updatedAt'>>
  ): Promise<boolean> {
    try {
      const configs = await this.getAllConfigs();
      const existingIndex = configs.findIndex(
        c => c.roasterName === roasterName
      );

      if (existingIndex >= 0) {
        configs[existingIndex] = {
          ...configs[existingIndex],
          ...updates,
          updatedAt: Date.now(),
        };
      } else {
        configs.push({
          roasterName,
          updatedAt: Date.now(),
          ...updates,
        });
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
      return true;
    } catch (error) {
      console.error('Failed to update config for roaster:', roasterName, error);
      return false;
    }
  }

  /**
   * 设置或更新烘焙商图标 (兼容旧接口)
   */
  async setLogo(roasterName: string, logoData: string): Promise<boolean> {
    return this.updateConfig(roasterName, { logoData });
  }

  /**
   * 设置烘焙商赏味期
   */
  async setFlavorPeriod(
    roasterName: string,
    flavorPeriod: RoasterFlavorPeriod
  ): Promise<boolean> {
    return this.updateConfig(roasterName, { flavorPeriod });
  }

  /**
   * 删除指定烘焙商的配置
   */
  async deleteConfig(roasterName: string): Promise<boolean> {
    try {
      const configs = await this.getAllConfigs();
      const filteredConfigs = configs.filter(
        c => c.roasterName !== roasterName
      );

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredConfigs));
      return true;
    } catch (error) {
      console.error('Failed to delete config for roaster:', roasterName, error);
      return false;
    }
  }

  /**
   * 删除指定烘焙商的图标 (兼容旧接口)
   * 注意：这会删除整个配置，如果只想删除图标保留设置，需要修改逻辑
   * 修改为只清除 logoData
   */
  async deleteLogo(roasterName: string): Promise<boolean> {
    try {
      const configs = await this.getAllConfigs();
      const index = configs.findIndex(c => c.roasterName === roasterName);

      if (index >= 0) {
        // 如果有其他设置（如赏味期），只清除 logoData
        if (configs[index].flavorPeriod) {
          delete configs[index].logoData;
          configs[index].updatedAt = Date.now();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
          return true;
        } else {
          // 如果没有其他设置，直接删除条目
          configs.splice(index, 1);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
          return true;
        }
      }
      return false;
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
   * 使用统一的图片压缩工具压缩为正方形图标,限制文件大小
   */
  async uploadLogo(roasterName: string, file: File): Promise<boolean> {
    try {
      // 使用统一的压缩工具压缩图片(正方形 800x800,限制 50KB 以内)
      const compressedFile = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.85,
        mimeType: 'image/jpeg',
        maxSizeMB: 0.05, // 限制 50KB,适合图标
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
      const logos = JSON.parse(jsonData) as RoasterConfig[];
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
