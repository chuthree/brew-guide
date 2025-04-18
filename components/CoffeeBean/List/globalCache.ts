import { ExtendedCoffeeBean } from './types';

// 创建全局缓存对象，确保跨组件实例保持数据
export const globalCache: {
    beans: ExtendedCoffeeBean[];
    ratedBeans: ExtendedCoffeeBean[];
    filteredBeans: ExtendedCoffeeBean[];
    bloggerBeans: { 
        2024: ExtendedCoffeeBean[];
        2025: ExtendedCoffeeBean[];
    };
    varieties: string[];
    selectedVariety: string | null;
    showEmptyBeans: boolean;
    initialized: boolean;
} = {
    beans: [],
    ratedBeans: [],
    filteredBeans: [],
    bloggerBeans: { 2024: [], 2025: [] }, // 初始化两年的博主榜单
    varieties: [],
    selectedVariety: null,
    showEmptyBeans: false,
    initialized: false
};

// 从localStorage读取已用完状态的函数
export const getShowEmptyBeansPreference = (): boolean => {
    try {
        const value = localStorage.getItem('brew-guide:showEmptyBeans');
        return value === 'true';
    } catch (_e) {
        return false;
    }
};

// 保存已用完状态到localStorage的函数
export const saveShowEmptyBeansPreference = (value: boolean): void => {
    try {
        localStorage.setItem('brew-guide:showEmptyBeans', value.toString());
    } catch (_e) {
        // 忽略错误，仅在控制台记录
        console.error('无法保存显示已用完豆子的偏好设置', _e);
    }
};

// 初始化全局缓存的已用完状态
globalCache.showEmptyBeans = getShowEmptyBeansPreference();

// 检查咖啡豆是否用完
export const isBeanEmpty = (bean: ExtendedCoffeeBean): boolean => {
    return (bean.remaining === "0" || bean.remaining === "0g") && bean.capacity !== undefined;
};

// 获取咖啡豆的赏味期信息
export const getFlavorInfo = (bean: ExtendedCoffeeBean): { phase: string, remainingDays: number } => {
    if (!bean.roastDate) {
        return { phase: '衰退期', remainingDays: 0 };
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
        if (bean.roastLevel?.includes('浅')) {
            startDay = 7;
            endDay = 30;
        } else if (bean.roastLevel?.includes('深')) {
            startDay = 14;
            endDay = 60;
        } else {
            // 默认为中烘焙
            startDay = 10;
            endDay = 30;
        }
    }

    let phase = '';
    let remainingDays = 0;
    
    if (daysSinceRoast < startDay) {
        phase = '养豆期';
        remainingDays = startDay - daysSinceRoast;
    } else if (daysSinceRoast <= endDay) {
        phase = '赏味期';
        remainingDays = endDay - daysSinceRoast;
    } else {
        phase = '衰退期';
        remainingDays = 0;
    }

    return { phase, remainingDays };
}; 