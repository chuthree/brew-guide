import type { ColorTuple, ScreenTheme } from './types';

// 预设屏幕总数（当前预览版有 12 个屏幕，最后2个不计入进度条）
export const TOTAL_SCREENS = 12;

// 每个屏幕的动画时长（秒），用于进度条同步
// Screen 0 (IntroScreen): SegmentTitle(3.0) + SegmentHeadline(3.5) + SegmentImages(2.2) + SegmentReview(3.5) + SegmentWeight(3.5) + SegmentGrid(3.5) + SegmentCost(3.5) ≈ 22.5s
// Screen 1 (FavoriteRoasterScreen): Segment1(3.0) + Segment2(2.8) ≈ 5.8s
// Screen 2 (CategoryFlowScreen): 图片流动画 ≈ 5s
// Screen 3 (InsightScreen): ExploreStats ≈ 4.5s (数字滚动需要足够时间展示)
// Screen 4 (OriginCategoryScreen): 产地统计 ≈ 3s
// Screen 5 (VarietyCategoryScreen): 品种统计 ≈ 3s
// Screen 6 (ProcessCategoryScreen): 处理法统计 ≈ 3s
// Screen 7 (BrewTimeScreen - earliest): 最早冲咖啡时间 ≈ 4.5s
// Screen 8 (BrewTimeScreen - latest): 最晚冲咖啡时间 ≈ 4.5s
// Screen 9 (SummaryScreen): 年度总结 ≈ 18s
// Screen 10 (EndingScreen): 结束过渡页 - 不计入进度条
// Screen 11 (ReportScreen): 年度报告页 - 不计入进度条
export const SCREEN_DURATIONS = [22.5, 5.8, 5, 4.5, 3, 3, 3, 4.5, 4.5, 18];

// 进度条显示的屏幕数量（不包含结束页和报告页）
export const PROGRESS_SCREENS = 10;

// 欢迎页主题 - 清新的薄荷青绿
export const WELCOME_THEME: ScreenTheme = {
  colors: ['#00B894', '#55EFC4', '#00CEC9', '#81ECEC'],
  accent: '#00B894',
};

// 结束页主题 - 宁静的蓝色
export const ENDING_THEME: ScreenTheme = {
  colors: ['#0984E3', '#74B9FF', '#0652DD', '#A3D8F4'],
  accent: '#0984E3',
};

// 年度报告主题 - Cloud Dancer 宁静白色
export const REPORT_THEME: ScreenTheme = {
  colors: ['#EEEDE6', '#E5E4DD', '#D8D7D0', '#F5F4ED'],
  accent: '#EEEDE6',
};

// 每个屏幕的主题渐变配置 - 水果风味色系，鲜艳活泼
export const SCREEN_THEMES: ScreenTheme[] = [
  {
    // 🍓 莓果 - 甜蜜的草莓红开场
    colors: ['#FF6B8A', '#FF8FA3', '#FF4D6D', '#FFB3C1'],
    accent: '#FF6B8A',
  },
  {
    // 🍊 柑橘 - 阳光活力的橘子色
    colors: ['#FF9F43', '#FFB86C', '#FF7F50', '#FFD699'],
    accent: '#FF9F43',
  },
  {
    // 🍋 柠檬 - 清新明亮的黄色调
    colors: ['#FFD93D', '#FFE66D', '#FFC107', '#FFF176'],
    accent: '#FFD93D',
  },
  {
    // 🥝 奇异果 - 清新的绿色
    colors: ['#7CB342', '#9CCC65', '#8BC34A', '#C5E1A5'],
    accent: '#7CB342',
  },
  {
    // 🫐 蓝莓 - 神秘梦幻的蓝紫
    colors: ['#6C5CE7', '#A29BFE', '#7C73E6', '#B8B5FF'],
    accent: '#6C5CE7',
  },
  {
    // 🍑 水蜜桃 - 温柔甜美的桃粉
    colors: ['#FFAB91', '#FFCCBC', '#FF8A65', '#FFE0B2'],
    accent: '#FFAB91',
  },
  {
    // 🍉 西瓜 - 夏日清爽的红绿撞色
    colors: ['#FF5252', '#FF8A80', '#FF1744', '#90CAF9'],
    accent: '#FF5252',
  },
  {
    // 🌅 日出 - 最早冲咖啡，温暖的晨曦
    colors: ['#FF8C42', '#FFD166', '#F4A261', '#FFBE76'],
    accent: '#FF8C42',
  },
  {
    // 🌙 星夜 - 最晚冲咖啡，深邃的午夜蓝
    colors: ['#1E3A5F', '#3D5A80', '#293241', '#457B9D'],
    accent: '#3D5A80',
  },
  {
    // 🩶 高级灰 - 年度总结，简约质感
    colors: ['#4a4a4a', '#5c5c5c', '#3d3d3d', '#6e6e6e'],
    accent: '#4a4a4a',
  },
  {
    // 🍒 樱桃 - 甜蜜收尾的深红
    colors: ['#E91E63', '#F48FB1', '#EC407A', '#F8BBD9'],
    accent: '#E91E63',
  },
];

/**
 * 颜色插值函数 - 将 hex 转为 rgb 并线性插值
 */
export const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return (
    '#' +
    [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('')
  );
};

export const lerpColor = (
  color1: string,
  color2: string,
  t: number
): string => {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  return rgbToHex(
    rgb1[0] + (rgb2[0] - rgb1[0]) * t,
    rgb1[1] + (rgb2[1] - rgb1[1]) * t,
    rgb1[2] + (rgb2[2] - rgb1[2]) * t
  );
};
