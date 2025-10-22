/**
 * 数据清理工具
 * 用于清理咖啡豆数据中的占位符和无效信息
 */

import { db } from '@/lib/core/db';
import { CoffeeBean } from '@/types/app';

// 动态导入 Storage 的辅助函数
const getStorage = async () => {
  const { Storage } = await import('@/lib/core/storage');
  return Storage;
};

// 占位符文本列表
const PLACEHOLDER_TEXTS = [
  '产地',
  'origin',
  'Origin',
  '处理法',
  'process',
  'Process',
  '水洗',
  '日晒',
  '蜜处理',
  '品种',
  'variety',
  'Variety',
  '烘焙度',
  'roast',
  'Roast',
  '',
  ' ',
  '  ',
  '   ', // 空字符串和空格
];

/**
 * 检查文本是否为占位符或无效值
 * @param text 要检查的文本
 * @returns 是否为有效的真实数据
 */
const isValidText = (text: string | undefined | null): boolean => {
  if (!text || typeof text !== 'string') return false;

  const trimmed = text.trim();
  if (trimmed === '') return false;

  // 检查是否为占位符文本
  return !PLACEHOLDER_TEXTS.includes(trimmed);
};

/**
 * 清理单个咖啡豆的占位符数据
 * @param bean 咖啡豆对象
 * @returns 清理后的咖啡豆对象和是否有修改
 */
const cleanBeanData = (
  bean: Record<string, unknown>
): { cleanedBean: Record<string, unknown>; hasChanges: boolean } => {
  const cleanedBean = { ...bean };
  let hasChanges = false;

  // 清理 blendComponents 中的占位符
  if (
    cleanedBean.blendComponents &&
    Array.isArray(cleanedBean.blendComponents)
  ) {
    cleanedBean.blendComponents = (
      cleanedBean.blendComponents as Record<string, unknown>[]
    ).map((component: Record<string, unknown>) => {
      const cleanedComponent = { ...component };

      // 清理产地
      if (!isValidText(cleanedComponent.origin as string)) {
        cleanedComponent.origin = '';
        hasChanges = true;
      }

      // 清理处理法
      if (!isValidText(cleanedComponent.process as string)) {
        cleanedComponent.process = '';
        hasChanges = true;
      }

      // 清理品种
      if (!isValidText(cleanedComponent.variety as string)) {
        cleanedComponent.variety = '';
        hasChanges = true;
      }

      return cleanedComponent;
    });
  }

  // 清理顶层的旧格式字段（如果还存在）
  if (!isValidText(cleanedBean.origin as string)) {
    delete cleanedBean.origin;
    hasChanges = true;
  }

  if (!isValidText(cleanedBean.process as string)) {
    delete cleanedBean.process;
    hasChanges = true;
  }

  if (!isValidText(cleanedBean.variety as string)) {
    delete cleanedBean.variety;
    hasChanges = true;
  }

  return { cleanedBean, hasChanges };
};

/**
 * 分析咖啡豆数据中的占位符问题
 * @returns 分析结果
 */
export const analyzePlaceholderData = async () => {
  try {
    const storage = await getStorage();
    const beansStr = await storage.get('coffeeBeans');
    if (!beansStr) {
      return {
        totalBeans: 0,
        beansWithPlaceholders: 0,
        placeholderDetails: [],
      };
    }

    const beans = JSON.parse(beansStr);
    if (!Array.isArray(beans)) {
      return {
        totalBeans: 0,
        beansWithPlaceholders: 0,
        placeholderDetails: [],
      };
    }

    let beansWithPlaceholders = 0;
    const placeholderDetails: Array<{
      beanIndex: number;
      beanName: string;
      issues: string[];
    }> = [];

    beans.forEach((bean, index) => {
      const issues: string[] = [];

      // 检查 blendComponents
      if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
        (bean.blendComponents as Record<string, unknown>[]).forEach(
          (component: Record<string, unknown>, compIndex: number) => {
            if (!isValidText(component.origin as string) && component.origin) {
              issues.push(
                `blendComponents[${compIndex}].origin: "${component.origin}"`
              );
            }
            if (
              !isValidText(component.process as string) &&
              component.process
            ) {
              issues.push(
                `blendComponents[${compIndex}].process: "${component.process}"`
              );
            }
            if (
              !isValidText(component.variety as string) &&
              component.variety
            ) {
              issues.push(
                `blendComponents[${compIndex}].variety: "${component.variety}"`
              );
            }
          }
        );
      }

      // 检查顶层字段
      if (!isValidText(bean.origin as string) && bean.origin) {
        issues.push(`origin: "${bean.origin}"`);
      }
      if (!isValidText(bean.process as string) && bean.process) {
        issues.push(`process: "${bean.process}"`);
      }
      if (!isValidText(bean.variety as string) && bean.variety) {
        issues.push(`variety: "${bean.variety}"`);
      }

      if (issues.length > 0) {
        beansWithPlaceholders++;
        placeholderDetails.push({
          beanIndex: index,
          beanName: bean.name || `咖啡豆 ${index + 1}`,
          issues,
        });
      }
    });

    return {
      totalBeans: beans.length,
      beansWithPlaceholders,
      placeholderDetails,
    };
  } catch (error) {
    // Log error in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('分析占位符数据失败:', error);
    }
    return {
      totalBeans: 0,
      beansWithPlaceholders: 0,
      placeholderDetails: [],
      error: (error as Error).message,
    };
  }
};

/**
 * 清理所有咖啡豆数据中的占位符
 * @returns 清理结果
 */
export const cleanAllPlaceholderData = async () => {
  try {
    const storage = await getStorage();
    const beansStr = await storage.get('coffeeBeans');
    if (!beansStr) {
      return {
        success: true,
        totalBeans: 0,
        cleanedBeans: 0,
        message: '没有找到咖啡豆数据',
      };
    }

    const beans = JSON.parse(beansStr);
    if (!Array.isArray(beans)) {
      return {
        success: false,
        totalBeans: 0,
        cleanedBeans: 0,
        message: '咖啡豆数据格式错误',
      };
    }

    let cleanedBeans = 0;
    const cleanedBeansArray = beans.map(bean => {
      const { cleanedBean, hasChanges } = cleanBeanData(bean);
      if (hasChanges) {
        cleanedBeans++;
      }
      return cleanedBean;
    });

    // 如果有清理，更新存储
    if (cleanedBeans > 0) {
      await storage.set('coffeeBeans', JSON.stringify(cleanedBeansArray));

      // 同时更新IndexedDB
      try {
        await db.coffeeBeans.clear();
        await db.coffeeBeans.bulkPut(
          cleanedBeansArray as unknown as CoffeeBean[]
        );
      } catch (dbError) {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('更新IndexedDB失败:', dbError);
        }
      }
    }

    return {
      success: true,
      totalBeans: beans.length,
      cleanedBeans,
      message:
        cleanedBeans > 0
          ? `成功清理了${cleanedBeans}个咖啡豆的占位符数据`
          : '没有发现需要清理的占位符数据',
    };
  } catch (error) {
    // Log error in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('清理占位符数据失败:', error);
    }
    return {
      success: false,
      totalBeans: 0,
      cleanedBeans: 0,
      message: `清理失败: ${(error as Error).message}`,
    };
  }
};
