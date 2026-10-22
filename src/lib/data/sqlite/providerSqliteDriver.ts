import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { SqliteDriver, SqlValue } from './driver';
import { createSqliteDriverCore } from './driverCore';

interface DatabaseCommand {
  database: string;
  operation: string;
  session?: string;
  sql?: string;
  params?: readonly SqlValue[];
  id?: string;
}
interface DatabaseResult {
  session?: string;
  result?: boolean;
  changes?: { changes: number };
  values?: Array<Record<string, SqlValue>>;
  publications?: Array<{ id: string; changes_json: string }>;
}
interface DatabasePlugin {
  command(command: DatabaseCommand): Promise<DatabaseResult>;
  addListener(
    name: 'providerDataChanged',
    listener: () => void
  ): Promise<PluginListenerHandle>;
}
export const providerDatabase =
  registerPlugin<DatabasePlugin>('BrewGuideDatabase');

let mutationSession: string | undefined;
let mutationPending = false;
let leaseRequestTail: Promise<void> = Promise.resolve();
let prepareMutation: ((session: string) => Promise<void>) | undefined;

/** Drain unscoped SQL before acquiring a lease that subsequent SQL must reuse. */
function serializeLeaseRequest<T>(work: () => Promise<T>): Promise<T> {
  const request = leaseRequestTail.then(work);
  leaseRequestTail = request.then(
    () => undefined,
    () => undefined
  );
  return request;
}

/** Registered after Stores are initialized; refresh committed Provider data before UI reads. */
export function setAndroidMutationPreparation(
  prepare: (session: string) => Promise<void>
): void {
  prepareMutation = prepare;
}

/** Native lease covers the entire UI read/compute/write/publication boundary. */
export async function withAndroidDatabaseMutation<T>(
  work: () => Promise<T>
): Promise<T> {
  if (mutationPending)
    throw new Error('Nested Android mutation is not supported');
  mutationPending = true;
  try {
    const session = await serializeLeaseRequest(async () => {
      const result = await providerDatabase.command({
        database: 'brew-guide',
        operation: 'acquireMutation',
      });
      if (!result.session) throw new Error('Native mutation has no session');
      mutationSession = result.session;
      return result.session;
    });
    try {
      await prepareMutation?.(session);
      return await work();
    } finally {
      await serializeLeaseRequest(async () => {
        // New unscoped SQL now queues behind release instead of reusing a
        // session whose native lease is already being closed.
        mutationSession = undefined;
        await providerDatabase.command({
          database: 'brew-guide',
          operation: 'releaseMutation',
          session,
        });
      });
    }
  } finally {
    mutationPending = false;
  }
}

export async function resetAndroidBusinessRuntime(): Promise<void> {
  const reset = () =>
    providerDatabase.command({
      database: 'brew-guide',
      operation: 'resetBusinessRuntime',
      session: mutationSession,
    });
  await (mutationSession ? reset() : serializeLeaseRequest(reset));
}

/** Android UI and ContentProvider share one native connection and owner lease. */
export async function openProviderSqliteDriver(
  database: string,
  onClose: () => void
): Promise<SqliteDriver> {
  let session: string | undefined;
  const currentSession = () =>
    session ?? (database === 'brew-guide' ? mutationSession : undefined);
  const command = (operation: string, extra: Partial<DatabaseCommand> = {}) => {
    const invoke = () =>
      providerDatabase.command({
        database,
        operation,
        session: currentSession(),
        ...extra,
      });
    // Active owners must be able to commit/release while another owner waits.
    // Queued unscoped calls resolve the session only after lease acquisition.
    return currentSession() ? invoke() : serializeLeaseRequest(invoke);
  };
  await command('open');
  return createSqliteDriverCore(
    {
      execute: sql => command('execute', { sql, params: [] }),
      run: (sql, params) => command('execute', { sql, params }),
      query: (sql, params) => command('query', { sql, params }),
      beginTransaction: async () => {
        const result = await command('begin');
        if (!result.session)
          throw new Error('Native transaction has no session');
        session = result.session;
        return result;
      },
      commitTransaction: async () => {
        try {
          return await command('commit');
        } finally {
          session = undefined;
        }
      },
      rollbackTransaction: async () => {
        try {
          return await command('rollback');
        } finally {
          session = undefined;
        }
      },
      isTransactionActive: async () => {
        if (!session) return false;
        try {
          const result = await command('isTransactionActive');
          if (typeof result.result !== 'boolean')
            throw new Error('Native transaction status is invalid');
          return result.result;
        } catch (error) {
          session = undefined;
          throw error;
        }
      },
    },
    async () => {
      await command('close');
      session = undefined;
      onClose();
    }
  );
}
