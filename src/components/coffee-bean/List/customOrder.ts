// 未排序的新豆子追加到末尾；修改豆子资料不会改变已有的手动顺序。
export function orderBeans<T extends { id: string; timestamp: number }>(
  beans: T[],
  savedOrder: unknown
): T[] {
  const ids = Array.isArray(savedOrder)
    ? savedOrder.filter((id): id is string => typeof id === 'string')
    : [];
  const ranks = new Map([...new Set(ids)].map((id, index) => [id, index]));
  return [...beans].sort((a, b) => {
    const left = ranks.get(a.id);
    const right = ranks.get(b.id);
    if (left !== undefined || right !== undefined) {
      return (left ?? ranks.size) - (right ?? ranks.size);
    }
    return b.timestamp - a.timestamp || a.id.localeCompare(b.id);
  });
}

// 只替换可见豆子占据的槽位，保留其他分类、库存状态和隐藏豆子的位置。
export function reorderVisibleBeans(
  fullOrder: string[],
  visibleOrder: string[],
  activeId: string,
  overId: string
): string[] | null {
  const visible = new Set(visibleOrder);
  const current = fullOrder.filter(id => visible.has(id));
  if (
    current.length !== visibleOrder.length ||
    current.some((id, index) => id !== visibleOrder[index])
  )
    return null;
  const from = current.indexOf(activeId);
  const to = current.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return null;
  current.splice(to, 0, current.splice(from, 1)[0]);
  let index = 0;
  return fullOrder.map(id => (visible.has(id) ? current[index++] : id));
}
