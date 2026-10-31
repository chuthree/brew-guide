import type { RoasterConfig } from '@/lib/data/models';

/** 图标独立合并，缺失列表或旧客户端的空值不代表删除。 */
export function mergeRoasterLogos(
  incoming: RoasterConfig[] = [],
  existing: RoasterConfig[] = []
): RoasterConfig[] {
  const result = new Map(incoming.map(config => [config.roasterName, config]));
  for (const saved of existing) {
    const next = result.get(saved.roasterName);
    if (!next) {
      if (saved.logoData || saved.logoUpdatedAt)
        result.set(saved.roasterName, saved);
      continue;
    }

    const savedVersion = saved.logoUpdatedAt ?? 0;
    const nextVersion = next.logoUpdatedAt ?? 0;
    // 新协议的图标版本优先于旧客户端更新其他设置产生的 updatedAt。
    const keepSaved =
      savedVersion || nextVersion
        ? savedVersion > nextVersion ||
          (savedVersion === nextVersion &&
            (saved.logoData ?? '') < (next.logoData ?? ''))
        : Boolean(saved.logoData) &&
          (!next.logoData ||
            saved.updatedAt > next.updatedAt ||
            (saved.updatedAt === next.updatedAt &&
              saved.logoData! > next.logoData));
    if (keepSaved) {
      result.set(saved.roasterName, {
        ...next,
        logoData: saved.logoData,
        logoUpdatedAt: saved.logoUpdatedAt,
      });
    }
  }
  return [...result.values()];
}
