// 类型定义已统一到 @/types/app，从那里导入
import type { CoffeeBean, BlendComponent } from '@/types/app';

// 重新导出类型
export type { CoffeeBean, BlendComponent };

// ExtendedCoffeeBean 已移除，直接使用 CoffeeBean
export type ExtendedCoffeeBean = CoffeeBean;

// 表单属性接口
export interface CoffeeBeanFormProps {
    onSave: (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => void;
    onCancel: () => void;
    initialBean?: ExtendedCoffeeBean;
}

// 定义步骤类型
export type Step = 'basic' | 'detail' | 'flavor' | 'complete';

// 步骤配置接口
export interface StepConfig {
    id: Step;
    label: string;
} 