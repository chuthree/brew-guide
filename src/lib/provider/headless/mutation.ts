/** Native runtime holds the shared Android database coordinator lease. */
export async function withDataMutation<T>(work: () => Promise<T>): Promise<T> {
  return work();
}
