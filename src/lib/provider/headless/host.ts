/** The only native entry point. The host never accepts this ABI from IPC callers. */
declare const __brewHost: {
  call(operation: string, payloadJson: string): string;
};
export function host<T>(operation: string, payload: unknown = {}): T {
  return JSON.parse(
    String(__brewHost.call(operation, JSON.stringify(payload)))
  ) as T;
}
