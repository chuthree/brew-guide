'use client';

import { type Method, type CustomEquipment } from '../core/config';

/**
 * 导出器具数据为文本
 * @param equipment 要导出的器具
 * @returns 格式化的JSON字符串
 */
export function exportEquipment(equipment: CustomEquipment): string {
  // 创建一个副本以避免修改原始对象
  const exportData = { ...equipment };

  // 不再删除ID，保留原始ID以确保关联性
  // delete (exportData as Partial<CustomEquipment>).id;

  // 格式化为易读的JSON字符串
  return JSON.stringify(exportData, null, 2);
}

/**
 * 导出方案数据为文本
 * @param method 要导出的方案
 * @returns 格式化的JSON字符串
 */
export function exportMethod(method: Method): string {
  // 创建一个副本以避免修改原始对象
  const exportData = { ...method };

  // 不再删除ID，保留原始ID以确保关联性
  // delete (exportData as Partial<Method>).id;

  // 格式化为易读的JSON字符串
  return JSON.stringify(exportData, null, 2);
}

export interface CopyResult {
  success: boolean;
  content?: string;
}

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @returns Promise<CopyResult> 包含复制结果和失败时的内容
 */
export async function copyToClipboard(text: string): Promise<CopyResult> {
  try {
    // 首先尝试使用现代API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return { success: true };
    }

    // 回退方法：创建临时textarea元素
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // 设置样式使其不可见
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);

    // 选择文本并复制
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');

    // 清理
    document.body.removeChild(textArea);

    if (successful) {
      return { success: true };
    } else {
      return { success: false, content: text };
    }
  } catch (error) {
    console.error('复制到剪贴板失败:', error);
    return { success: false, content: text };
  }
}
