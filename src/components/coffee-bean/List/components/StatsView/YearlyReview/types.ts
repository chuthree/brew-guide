import type { CoffeeBean } from '@/types/app';

// 颜色元组类型
export type ColorTuple = [string, string, string, string];

// 屏幕主题配置
export interface ScreenTheme {
  colors: ColorTuple;
  accent: string;
}

// 屏幕组件通用 Props
export interface ScreenProps {
  onComplete?: () => void;
}

// IntroScreen 各 Segment 的通用 Props
export interface SegmentProps {
  onComplete?: () => void;
  blurRef?: React.RefObject<SVGFEGaussianBlurElement | null>;
}

// 带咖啡豆数据的屏幕 Props
export interface BeanScreenProps extends ScreenProps {
  beans: CoffeeBean[];
  beanImages: string[];
  totalWeight: number;
}

// Segment 更新模糊的回调类型
export type UpdateBlurFn = () => void;
