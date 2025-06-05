/**
 * 导航状态持久化工具
 * 用于保存和恢复用户的导航选择状态
 */

import { getStringState, saveStringState } from '@/lib/core/statePersistence';

// 模块名称
const MODULE_NAME = 'navigation';

// 主标签页类型定义
export type MainTabType = '冲煮' | '咖啡豆' | '笔记';

// 默认主标签页
const DEFAULT_MAIN_TAB: MainTabType = '冲煮';

/**
 * 从localStorage读取上次选择的主标签页
 * @returns 上次选择的主标签页或默认值
 */
export const getMainTabPreference = (): MainTabType => {
    const value = getStringState(MODULE_NAME, 'activeMainTab', DEFAULT_MAIN_TAB);
    // 验证值是否有效
    const validTabs: MainTabType[] = ['冲煮', '咖啡豆', '笔记'];
    return validTabs.includes(value as MainTabType) ? (value as MainTabType) : DEFAULT_MAIN_TAB;
};

/**
 * 保存主标签页选择到localStorage
 * @param tab 要保存的主标签页
 */
export const saveMainTabPreference = (tab: MainTabType): void => {
    saveStringState(MODULE_NAME, 'activeMainTab', tab);
    
    // 触发自定义事件，通知其他组件导航状态已更新
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('navigationCacheChanged', {
            detail: { activeMainTab: tab }
        }));
    }
};

/**
 * 清除导航状态缓存
 */
export const clearNavigationCache = (): void => {
    if (typeof window !== 'undefined') {
        try {
            localStorage.removeItem('brew-guide:navigation:activeMainTab');
        } catch (error) {
            console.error('清除导航缓存失败:', error);
        }
    }
};

// 监听全局缓存重置事件，自动清除导航缓存
if (typeof window !== 'undefined') {
    window.addEventListener('globalCacheReset', () => {
        clearNavigationCache();
        console.log('导航缓存已重置');
    });
}
