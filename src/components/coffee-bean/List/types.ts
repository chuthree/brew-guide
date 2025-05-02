import { CoffeeBean } from '@/types/app'

// 添加BlendComponent类型
export interface BlendComponent {
    percentage?: number;  // 百分比 (1-100)，改为可选
    origin?: string;     // 产地
    process?: string;    // 处理法
    variety?: string;    // 品种
}

// 扩展CoffeeBean类型
export interface ExtendedCoffeeBean extends CoffeeBean {
    blendComponents?: BlendComponent[];
}

// 视图模式定义
export const VIEW_OPTIONS = {
    INVENTORY: 'inventory',
    RANKING: 'ranking',
    BLOGGER: 'blogger', // 新增博主榜单视图
    STATS: 'stats', // 新增统计视图
} as const;

export type ViewOption = typeof VIEW_OPTIONS[keyof typeof VIEW_OPTIONS];

// 视图选项的显示名称
export const VIEW_LABELS: Record<ViewOption, string> = {
    [VIEW_OPTIONS.INVENTORY]: '咖啡豆仓库',
    [VIEW_OPTIONS.RANKING]: '个人榜单',
    [VIEW_OPTIONS.BLOGGER]: '博主榜单',
    [VIEW_OPTIONS.STATS]: '统计视图',
};

export interface CoffeeBeansProps {
    isOpen: boolean
    showBeanForm?: (bean: ExtendedCoffeeBean | null) => void
    onShowImport?: () => void
}

// 导出工具函数
export const generateBeanTitle = (bean: ExtendedCoffeeBean): string => {
    // 安全检查：确保bean是有效对象且有名称
    if (!bean || typeof bean !== 'object' || !bean.name) {
        return bean?.name || '未命名咖啡豆';
    }
    
    // 将豆子名称转换为小写以便比较
    const nameLower = bean.name.toLowerCase();
    
    // 创建一个函数来检查参数是否已包含在名称中
    const isIncluded = (param?: string | null): boolean => {
        // 如果参数为空或不是字符串类型，视为已包含
        if (!param || typeof param !== 'string') return true;
        
        // 将参数转换为小写并分割成单词
        const paramWords = param.toLowerCase().split(/\s+/);
        
        // 检查每个单词是否都包含在名称中
        return paramWords.every(word => nameLower.includes(word));
    };

    // 收集需要添加的参数
    const additionalParams: string[] = [];

    // 如果是拼配咖啡且有拼配成分，将成分添加到标题中
    if (bean.blendComponents && Array.isArray(bean.blendComponents) && bean.blendComponents.length > 0) {
        // 拼配豆情况下，不再在标题中添加拼配成分信息
        if (bean.type === '拼配' && bean.blendComponents.length > 1) {
            // 不添加拼配成分到标题
        } else {
            // 单品豆的情况，仍然添加信息到标题
            // 获取成分信息
            const comp = bean.blendComponents[0];
            if (comp) {
                // 检查并添加烘焙度
                if (bean.roastLevel && !isIncluded(bean.roastLevel)) {
                    additionalParams.push(bean.roastLevel);
                }
                
                // 检查并添加产地
                if (comp.origin && !isIncluded(comp.origin)) {
                    additionalParams.push(comp.origin);
                }
                
                // 检查并添加处理法
                if (comp.process && !isIncluded(comp.process)) {
                    additionalParams.push(comp.process);
                }
                
                // 检查并添加品种
                if (comp.variety && !isIncluded(comp.variety)) {
                    additionalParams.push(comp.variety);
                }
            }
        }
    } else {
        // 单品咖啡的情况，保持原有逻辑
        // 检查并添加烘焙度
        if (bean.roastLevel && !isIncluded(bean.roastLevel)) {
            additionalParams.push(bean.roastLevel);
        }

        // 检查并添加产地
        if (bean.origin && !isIncluded(bean.origin)) {
            additionalParams.push(bean.origin);
        }

        // 检查并添加处理法
        if (bean.process && !isIncluded(bean.process)) {
            additionalParams.push(bean.process);
        }

        // 检查并添加品种
        if (bean.variety && !isIncluded(bean.variety)) {
            additionalParams.push(bean.variety);
        }
    }

    // 如果有额外参数，将它们添加到名称后面
    return additionalParams.length > 0
        ? `${bean.name} ${additionalParams.join(' ')}`
        : bean.name;
};

export type BloggerBeansYear = 2024 | 2025;
export type BeanType = 'all' | 'espresso' | 'filter'; 