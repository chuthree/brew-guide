import { beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  registerPlugin: () => native,
  Capacitor: { getPlatform: () => 'android' },
}));
beforeEach(() => {
  vi.resetModules();
  native.command
    .mockReset()
    .mockImplementation(async (input: { operation: string }) => {
      if (input.operation === 'begin')
        return { session: 'ui:tx', changes: { changes: 0 } };
      if (input.operation === 'acquireMutation') return { session: 'ui:outer' };
      if (input.operation === 'query')
        return { values: [{ amount: 12, empty: null }] };
      if (input.operation === 'isTransactionActive') return { result: true };
      return { changes: { changes: 1 } };
    });
});
describe('Android unified provider database driver', () => {
  it('shares one connection and scopes transaction bridge commands', async () => {
    const { openCapacitorSqliteDriver } =
      await import('./capacitorSqliteDriver');
    const [driver, second] = await Promise.all([
      openCapacitorSqliteDriver(),
      openCapacitorSqliteDriver(),
    ]);
    expect(driver).toBe(second);
    expect(await driver.query('SELECT amount')).toEqual([
      { amount: 12, empty: null },
    ]);
    await driver.transaction(tx =>
      tx.execute('UPDATE beans SET amount = ?', [12])
    );
    expect(native.command).toHaveBeenCalledWith({
      database: 'brew-guide',
      operation: 'execute',
      session: 'ui:tx',
      sql: 'UPDATE beans SET amount = ?',
      params: [12],
    });
    expect(native.command).toHaveBeenCalledWith({
      database: 'brew-guide',
      operation: 'commit',
      session: 'ui:tx',
    });
    await driver.close();
    await expect(driver.query('SELECT 1')).rejects.toThrow('closed');
  });
  it('rolls back failed work without losing its original error', async () => {
    const { openProviderSqliteDriver } = await import('./providerSqliteDriver');
    const driver = await openProviderSqliteDriver(
      'brew-guide',
      () => undefined
    );
    const error = new Error('business validation');
    await expect(
      driver.transaction(async () => {
        throw error;
      })
    ).rejects.toBe(error);
    expect(native.command).toHaveBeenCalledWith({
      database: 'brew-guide',
      operation: 'rollback',
      session: 'ui:tx',
    });
    await driver.query('SELECT 1');
    expect(native.command).toHaveBeenLastCalledWith({
      database: 'brew-guide',
      operation: 'query',
      session: undefined,
      sql: 'SELECT 1',
      params: [],
    });
  });
  it('holds an outer native owner across UI reads and transaction writes', async () => {
    const { openProviderSqliteDriver, withAndroidDatabaseMutation } =
      await import('./providerSqliteDriver');
    const driver = await openProviderSqliteDriver(
      'brew-guide',
      () => undefined
    );
    await withAndroidDatabaseMutation(async () => {
      await driver.query('SELECT 1');
      await driver.transaction(tx =>
        tx.execute('UPDATE notes SET value = ?', ['same owner'])
      );
    });
    expect(native.command).toHaveBeenCalledWith({
      database: 'brew-guide',
      operation: 'query',
      session: 'ui:outer',
      sql: 'SELECT 1',
      params: [],
    });
    expect(native.command).toHaveBeenCalledWith({
      database: 'brew-guide',
      operation: 'begin',
      session: 'ui:outer',
    });
    expect(native.command).toHaveBeenLastCalledWith({
      database: 'brew-guide',
      operation: 'releaseMutation',
      session: 'ui:outer',
    });
  });
  it('only deletes the explicitly isolated test database', async () => {
    const { deleteAndroidSqliteTestDatabase } =
      await import('./capacitorSqliteDriver');
    await deleteAndroidSqliteTestDatabase();
    expect(native.command).toHaveBeenCalledWith({
      database: 'brew-guide-stage3d-test',
      operation: 'deleteTestDatabase',
    });
  });
  it('projects committed Provider writes before any UI mutation reads cached state', async () => {
    const {
      withAndroidDatabaseMutation,
      setAndroidMutationPreparation,
      providerDatabase,
    } = await import('./providerSqliteDriver');
    const order: string[] = [];
    setAndroidMutationPreparation(async session => {
      expect(session).toBe('ui:outer');
      await providerDatabase.command({
        database: 'brew-guide',
        operation: 'pendingPublications',
        session,
      });
      order.push('provider:cache-and-sync');
    });
    await withAndroidDatabaseMutation(async () => {
      order.push('ui:read-write');
    });
    expect(order).toEqual(['provider:cache-and-sync', 'ui:read-write']);
    expect(native.command).toHaveBeenLastCalledWith({
      database: 'brew-guide',
      operation: 'releaseMutation',
      session: 'ui:outer',
    });
  });
  it('does not run stale UI writes when Provider projection fails, and releases ownership', async () => {
    const { withAndroidDatabaseMutation, setAndroidMutationPreparation } =
      await import('./providerSqliteDriver');
    const work = vi.fn();
    setAndroidMutationPreparation(async () => {
      throw new Error('projection failed');
    });
    await expect(withAndroidDatabaseMutation(work)).rejects.toThrow(
      'projection failed'
    );
    expect(work).not.toHaveBeenCalled();
    expect(native.command).toHaveBeenLastCalledWith({
      database: 'brew-guide',
      operation: 'releaseMutation',
      session: 'ui:outer',
    });
  });
  it('drains an already dispatched unscoped query before acquiring the mutation lease', async () => {
    const { openProviderSqliteDriver, withAndroidDatabaseMutation } =
      await import('./providerSqliteDriver');
    const driver = await openProviderSqliteDriver(
      'brew-guide',
      () => undefined
    );
    const entered = deferred(),
      resume = deferred();
    const fallback = native.command.getMockImplementation()!;
    native.command.mockImplementation(async (input: { operation: string }) => {
      if (input.operation === 'query') {
        entered.resolve();
        await resume.promise;
      }
      return fallback(input);
    });
    const query = driver.query('SELECT 1');
    await entered.promise;
    const mutation = withAndroidDatabaseMutation(async () => undefined);
    await Promise.resolve();
    expect(
      native.command.mock.calls.some(
        ([input]) => input.operation === 'acquireMutation'
      )
    ).toBe(false);
    resume.resolve();
    await Promise.all([query, mutation]);
    expect(native.command.mock.calls.map(([input]) => input.operation)).toEqual(
      ['open', 'query', 'acquireMutation', 'releaseMutation']
    );
  });

  it('attaches the acquired owner to SQL arriving while lease acquisition is pending', async () => {
    const { openProviderSqliteDriver, withAndroidDatabaseMutation } =
      await import('./providerSqliteDriver');
    const driver = await openProviderSqliteDriver(
      'brew-guide',
      () => undefined
    );
    const entered = deferred(),
      resume = deferred(),
      queryDone = deferred();
    const fallback = native.command.getMockImplementation()!;
    native.command.mockImplementation(async (input: { operation: string }) => {
      if (input.operation === 'acquireMutation') {
        entered.resolve();
        await resume.promise;
      }
      return fallback(input);
    });
    const mutation = withAndroidDatabaseMutation(async () => queryDone.promise);
    await entered.promise;
    const query = driver.query('SELECT 1');
    await Promise.resolve();
    expect(
      native.command.mock.calls.some(([input]) => input.operation === 'query')
    ).toBe(false);
    resume.resolve();
    await query;
    expect(native.command).toHaveBeenCalledWith({
      database: 'brew-guide',
      operation: 'query',
      session: 'ui:outer',
      sql: 'SELECT 1',
      params: [],
    });
    queryDone.resolve();
    await mutation;
  });

  it('queues unscoped SQL behind release rather than reusing a closing lease', async () => {
    const { openProviderSqliteDriver, withAndroidDatabaseMutation } =
      await import('./providerSqliteDriver');
    const driver = await openProviderSqliteDriver(
      'brew-guide',
      () => undefined
    );
    const entered = deferred(),
      resume = deferred();
    const fallback = native.command.getMockImplementation()!;
    native.command.mockImplementation(async (input: { operation: string }) => {
      if (input.operation === 'releaseMutation') {
        entered.resolve();
        await resume.promise;
      }
      return fallback(input);
    });
    const mutation = withAndroidDatabaseMutation(async () => undefined);
    await entered.promise;
    const query = driver.query('SELECT 1');
    await Promise.resolve();
    expect(
      native.command.mock.calls.some(([input]) => input.operation === 'query')
    ).toBe(false);
    resume.resolve();
    await Promise.all([query, mutation]);
    expect(native.command).toHaveBeenLastCalledWith({
      database: 'brew-guide',
      operation: 'query',
      session: undefined,
      sql: 'SELECT 1',
      params: [],
    });
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
