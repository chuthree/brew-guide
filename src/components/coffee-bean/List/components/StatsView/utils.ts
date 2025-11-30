// 格式化数字，保留2位小数
export const formatNumber = (num: number): string => {
  if (!isFinite(num)) return '0';
  const rounded = Math.round(num * 100) / 100;
  return rounded
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
};
