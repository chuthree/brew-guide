/**
 * 咖啡豆类型推断
 *
 * 规则：
 * 1. 精准匹配：
 *    - 手冲：15/16/112/224g
 *    - 意式：18/250/252/500/504g
 * 2. 范围匹配：
 *    - ≤150g → 手冲
 *    - ≥200g → 意式
 */

export type InferredBeanType = 'filter' | 'espresso' | null;

/**
 * 根据容量推断豆子类型
 */
export function inferBeanType(capacity?: string): InferredBeanType {
  if (!capacity) return null;

  const grams = parseFloat(capacity);
  if (!grams || grams <= 0) return null;

  // 精确匹配常见规格
  const filterSizes = [15, 16, 112, 224];
  const espressoSizes = [18, 250, 252, 500, 504];

  if (filterSizes.includes(grams)) return 'filter';
  if (espressoSizes.includes(grams)) return 'espresso';

  // 范围匹配
  if (grams <= 150) return 'filter';
  if (grams >= 200 && grams <= 504) return 'espresso';

  // 其他无法判断
  return null;
}
