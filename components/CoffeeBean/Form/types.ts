// 拼配成分接口定义
export interface BlendComponent {
    percentage?: number;  // 百分比 (1-100)，可选
    origin?: string;     // 产地
    process?: string;    // 处理法
    variety?: string;    // 品种
}

// 咖啡豆基础接口
export interface CoffeeBean {
    id: string;
    timestamp: number;
    name: string;
    type: '单品' | '拼配';
    beanType?: 'espresso' | 'filter';  // 新增：用于区分手冲(filter)或意式(espresso)
    image?: string;
    capacity?: string;
    remaining?: string;
    price?: string;
    roastLevel?: string;
    roastDate?: string;
    origin?: string;
    process?: string;
    variety?: string;
    acidity?: number;
    sweetness?: number;
    body?: number;
    aftertaste?: number;
    flavor?: string[];
    aroma?: number;
    balance?: number;
    clean?: number;
    notes?: string;
    startDay?: number;
    endDay?: number;
}

// 扩展CoffeeBean类型以支持拼配成分
export type ExtendedCoffeeBean = CoffeeBean & {
    blendComponents?: BlendComponent[];
}

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