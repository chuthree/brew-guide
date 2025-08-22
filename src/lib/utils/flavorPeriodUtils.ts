import { CoffeeBean } from '@/types/app';
import { defaultSettings, type SettingsOptions } from '@/components/settings/Settings';

// 赏味期信息接口
export interface FlavorInfo {
    phase: string;
    remainingDays: number;
    status?: string;
}

// 获取自定义赏味期设置
export const getCustomFlavorPeriodSettings = async () => {
    try {
        const { Storage } = await import('@/lib/core/storage');
        const settingsStr = await Storage.get('brewGuideSettings');
        
        if (settingsStr) {
            const settings: SettingsOptions = JSON.parse(settingsStr);
            return settings.customFlavorPeriod || defaultSettings.customFlavorPeriod;
        }
        
        return defaultSettings.customFlavorPeriod;
    } catch (error) {
        console.error('获取自定义赏味期设置失败:', error);
        return defaultSettings.customFlavorPeriod;
    }
};

// 根据烘焙度获取默认赏味期参数
export const getDefaultFlavorPeriodByRoastLevel = async (roastLevel: string) => {
    const customFlavorPeriod = await getCustomFlavorPeriodSettings();
    
    if (roastLevel?.includes('浅')) {
        return {
            startDay: customFlavorPeriod!.light.startDay,
            endDay: customFlavorPeriod!.light.endDay
        };
    } else if (roastLevel?.includes('深')) {
        return {
            startDay: customFlavorPeriod!.dark.startDay,
            endDay: customFlavorPeriod!.dark.endDay
        };
    } else {
        // 默认为中烘焙
        return {
            startDay: customFlavorPeriod!.medium.startDay,
            endDay: customFlavorPeriod!.medium.endDay
        };
    }
};

// 同步版本的赏味期参数获取（使用默认值）
export const getDefaultFlavorPeriodByRoastLevelSync = (roastLevel: string, customFlavorPeriod?: SettingsOptions['customFlavorPeriod']) => {
    const flavorPeriod = customFlavorPeriod || defaultSettings.customFlavorPeriod;
    
    if (roastLevel?.includes('浅')) {
        return {
            startDay: flavorPeriod!.light.startDay,
            endDay: flavorPeriod!.light.endDay
        };
    } else if (roastLevel?.includes('深')) {
        return {
            startDay: flavorPeriod!.dark.startDay,
            endDay: flavorPeriod!.dark.endDay
        };
    } else {
        // 默认为中烘焙
        return {
            startDay: flavorPeriod!.medium.startDay,
            endDay: flavorPeriod!.medium.endDay
        };
    }
};

// 计算咖啡豆的赏味期信息
export const calculateFlavorInfo = (bean: CoffeeBean, customFlavorPeriod?: SettingsOptions['customFlavorPeriod']): FlavorInfo => {
    // 处理特殊状态
    if (bean.isInTransit) {
        return { phase: '在途', remainingDays: 0, status: '在途中' };
    }
    
    if (bean.isFrozen) {
        return { phase: '冰冻', remainingDays: 0, status: '冰冻保存' };
    }
    
    if (!bean.roastDate) {
        return { phase: '未知', remainingDays: 0, status: '未设置烘焙日期' };
    }

    // 计算天数差
    const today = new Date();
    const roastDate = new Date(bean.roastDate);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const roastDateOnly = new Date(roastDate.getFullYear(), roastDate.getMonth(), roastDate.getDate());
    const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24));

    // 优先使用自定义赏味期参数，如果没有则根据烘焙度计算
    let startDay = bean.startDay || 0;
    let endDay = bean.endDay || 0;

    // 如果没有自定义值，则根据烘焙度设置默认值
    if (startDay === 0 && endDay === 0) {
        const defaultPeriod = getDefaultFlavorPeriodByRoastLevelSync(bean.roastLevel || '', customFlavorPeriod);
        startDay = defaultPeriod.startDay;
        endDay = defaultPeriod.endDay;
    }

    // 判断当前阶段
    if (daysSinceRoast < startDay) {
        // 养豆期
        return { 
            phase: '养豆期', 
            remainingDays: startDay - daysSinceRoast,
            status: `还需养豆 ${startDay - daysSinceRoast} 天`
        };
    } else if (daysSinceRoast <= endDay) {
        // 赏味期
        return { 
            phase: '赏味期', 
            remainingDays: endDay - daysSinceRoast,
            status: `剩余 ${endDay - daysSinceRoast} 天`
        };
    } else {
        // 衰退期
        return { 
            phase: '衰退期', 
            remainingDays: 0,
            status: '已过赏味期'
        };
    }
};
