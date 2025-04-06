'use client'

import { type Method, type CustomEquipment } from './config'

/**
 * 导出器具数据为文本
 * @param equipment 要导出的器具
 * @returns 格式化的JSON字符串
 */
export function exportEquipment(equipment: CustomEquipment): string {
    // 创建一个副本以避免修改原始对象
    const exportData = { ...equipment };
    
    // 移除不需要导出的字段
    delete (exportData as Partial<CustomEquipment>).id;  // 导入时会生成新的ID
    
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
    
    // 移除不需要导出的字段
    delete (exportData as Partial<Method>).id;  // 导入时会生成新的ID
    
    // 格式化为易读的JSON字符串
    return JSON.stringify(exportData, null, 2);
}

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @returns Promise<boolean> 是否复制成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        // 首先尝试使用现代API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
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
        
        return successful;
    } catch (error) {
        console.error('复制到剪贴板失败:', error);
        return false;
    }
} 