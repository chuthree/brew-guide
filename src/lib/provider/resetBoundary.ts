import { detectAppRuntime } from '@/lib/app/runtime';
import { resolveStorageBackend } from '@/lib/data/runtime';

/** Reset never races a Provider call and invalidates cached native previews. */
export async function withAndroidProviderReset<T>(
  work: () => Promise<T>
): Promise<T> {
  const runtime = detectAppRuntime();
  if (resolveStorageBackend(runtime) === 'dexie') {
    const { withDataMutation } = await import('@/lib/data/mutationCoordinator');
    const { invalidateWebBusinessHistoryInMutation } =
      await import('@/lib/data/business/maintenance');
    return withDataMutation(async () => {
      await invalidateWebBusinessHistoryInMutation();
      try {
        return await work();
      } finally {
        // On browsers without Web Locks, do not retain receipts from a command
        // another tab may have committed during this multi-transaction reset.
        await invalidateWebBusinessHistoryInMutation();
      }
    });
  }
  if (
    runtime.runtime !== 'capacitor' ||
    runtime.capacitorPlatform !== 'android' ||
    runtime.capacitorBundled === false
  )
    return work();
  const { withDataMutation } = await import('@/lib/data/mutationCoordinator');
  const { resetAndroidBusinessRuntime } =
    await import('@/lib/data/sqlite/providerSqliteDriver');
  return withDataMutation(async () => {
    try {
      const result = await work();
      if (
        !(
          result &&
          typeof result === 'object' &&
          'success' in result &&
          result.success === false
        )
      ) {
        const { openCapacitorSqliteDriver } =
          await import('@/lib/data/sqlite/capacitorSqliteDriver');
        const { clearOptionalMcpTables } =
          await import('@/lib/data/sqlite/mcpMaintenance');
        const driver = await openCapacitorSqliteDriver();
        await driver.transaction(clearOptionalMcpTables);
      }
      return result;
    } finally {
      await resetAndroidBusinessRuntime();
    }
  });
}
