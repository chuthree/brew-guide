import { detectAppRuntime } from '@/lib/app/runtime';

/** Reset never races a Provider call and invalidates cached native previews. */
export async function withAndroidProviderReset<T>(
  work: () => Promise<T>
): Promise<T> {
  const runtime = detectAppRuntime();
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
