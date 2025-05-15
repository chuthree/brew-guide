import { Method } from '@/lib/core/config';

// 定义注水方式基本类型，普通器具和意式机共用的基础接口
export type BasePourType = string;

// 定义意式机特有的注水方式枚举
export type EspressoPourType = 'extraction' | 'beverage' | 'other';

// 定义普通器具的注水方式枚举
export type RegularPourType = 'center' | 'circle' | 'ice' | 'other' | string;

// 扩展基础的 Stage 类型，添加意式机特有属性
// 注意：这里不再完全重新定义 Stage，而是引用并扩展 config.ts 中的定义
import { Stage as BaseStage } from '@/lib/core/config';

// 扩展 Stage 类型，添加意式机特有属性
export interface Stage extends BaseStage {
  // 意式机特有属性，表示具体的意式萃取类型
  espressoPourType?: EspressoPourType;
}

// 修改 Method 接口以使用新的 Stage 类型
export interface MethodWithStages extends Omit<Method, 'params'> {
  params: {
    coffee: string;
    water: string;
    ratio: string;
    grindSize: string;
    temp: string;
    videoUrl: string;
    roastLevel?: string;
    stages: Stage[];
    // 意式机特有参数
    extractionTime?: number;
    liquidWeight?: string;
  };
}

// 表单步骤接口
export interface Step {
  name: string;
  component: React.ReactNode;
} 