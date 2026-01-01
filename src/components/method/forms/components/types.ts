import { Method, PourType } from '@/lib/core/config';

// 定义意式机特有的注水方式值，与config.ts中保持一致
export type EspressoPourTypeValues = 'extraction' | 'beverage' | 'other';

// 定义普通器具的注水方式枚举（包含 wait）
export type RegularPourType =
  | 'center'
  | 'circle'
  | 'ice'
  | 'bypass'
  | 'wait'
  | 'other'
  | string;

// 扩展基础的 Stage 类型，从config.ts中引用
import { Stage as BaseStage } from '@/lib/core/config';

// 扩展 Stage 类型，所有类型都使用pourType字段
export interface Stage extends BaseStage {
  // pourType可以是普通器具的类型，也可以是意式机的类型
  pourType?: RegularPourType | EspressoPourTypeValues;
}

// 重新导出 PourType 以便其他模块使用
export type { PourType };

// MethodWithStages 已移至 @/lib/types/method 统一管理
// 请从 @/lib/types/method 导入使用
