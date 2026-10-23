import { detectAppRuntime } from '@/lib/app/runtime';

let mutationTail: Promise<void> = Promise.resolve();

/**
 * Serialize a complete desktop mutation, including its Store update and change
 * notification. SQLite transactions still provide durable atomicity. Keeping
 * publication in this queue prevents a slower UI image save from publishing an
 * older record after an MCP operation has already committed a newer one.
 *
 * Call only at the outer operation boundary. Work must not await another
 * coordinated mutation; use persistence/repository primitives inside it.
 */
export function withDataMutation<T>(work: () => Promise<T>): Promise<T> {
  const runtime = detectAppRuntime();
  const coordinatedDesktop =
    runtime.runtime === 'tauri' && runtime.tauriBundled !== false;
  const coordinatedAndroid =
    runtime.runtime === 'capacitor' &&
    runtime.capacitorPlatform === 'android' &&
    runtime.capacitorBundled !== false;
  if (!coordinatedDesktop && !coordinatedAndroid) {
    return work();
  }
  const operation = mutationTail.then(async () => {
    if (!coordinatedAndroid) return work();
    const { withAndroidDatabaseMutation } =
      await import('./sqlite/providerSqliteDriver');
    return withAndroidDatabaseMutation(work);
  });
  mutationTail = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}
