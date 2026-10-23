import { withDataMutation } from '@/lib/data/mutationCoordinator';

const rawActions = new WeakMap<
  object,
  (...args: unknown[]) => Promise<unknown>
>();

/** Queue public Store actions before they read cached state, through publication. */
export function coordinateStoreActions<T extends object>(
  state: T,
  keys: readonly (keyof T)[]
): T {
  const result = { ...state };
  for (const key of keys) {
    const action = state[key];
    if (typeof action !== 'function')
      throw new Error(`Invalid Store action: ${String(key)}`);
    const raw = action as (...args: unknown[]) => Promise<unknown>;
    const wrapped = (...args: unknown[]) =>
      withDataMutation(() => raw(...args));
    rawActions.set(wrapped, raw);
    Object.assign(result, { [key]: wrapped });
  }
  return result;
}

/** Explicit nested call only: caller already owns the complete mutation boundary. */
export function callStoreActionInMutation<A extends unknown[], R>(
  action: (...args: A) => R | Promise<R>,
  ...args: A
): Promise<R> {
  const raw = rawActions.get(action);
  return Promise.resolve(raw ? raw(...args) : action(...args)) as Promise<R>;
}

/** Preserve specialized enqueue-time validation while exposing an explicit nested action. */
export function registerCoordinatedAction<A extends unknown[], R>(
  publicAction: (...args: A) => Promise<R>,
  rawAction: (...args: A) => Promise<R>
): (...args: A) => Promise<R> {
  rawActions.set(
    publicAction,
    rawAction as (...args: unknown[]) => Promise<unknown>
  );
  return publicAction;
}
