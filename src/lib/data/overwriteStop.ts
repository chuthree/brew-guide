export class OverwriteStop extends Error {
  constructor(
    message: string,
    readonly reason: 'blocked' | 'cancelled' = 'blocked'
  ) {
    super(message);
  }
}
