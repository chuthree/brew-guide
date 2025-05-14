import { Method } from '@/lib/core/config';

// 基础的 Stage 类型
export interface Stage {
  time: number;
  pourTime?: number;
  label: string;
  water: string;
  detail: string;
  pourType?: string;
  valveStatus?: 'open' | 'closed';
}

// 扩展Stage类型以支持自定义注水动画ID
export type ExtendedPourType = string;

// 扩展Stage类型
export interface ExtendedStage extends Stage {
  pourType?: ExtendedPourType;
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
    stages: Stage[];
  };
} 