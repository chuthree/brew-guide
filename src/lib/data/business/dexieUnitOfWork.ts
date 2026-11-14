import { queueBusinessSyncIntents } from './syncIntents';
import type { BrewGuideDB } from '@/lib/core/db';
import { withDataMutation } from '@/lib/data/mutationCoordinator';
import { McpToolError, recordVersion } from '@/lib/mcp/validation';
import type {
  BusinessMutation,
  BusinessPublisher,
  BusinessResult,
  BusinessUnitOfWork,
} from './types';

/** Injectable database/publisher ports keep transaction tests independent of UI stores. */
export function createDexieBusinessUnitOfWork(
  database: BrewGuideDB,
  publish: BusinessPublisher
): BusinessUnitOfWork {
  async function publishPending(requestId: string): Promise<boolean> {
    try {
      const publication = await database.businessPublications.get(requestId);
      if (!publication) return false;
      await publish(publication.changes);
      await database.businessPublications.delete(requestId);
      return false;
    } catch {
      // The command already committed. Preserve the outbox and return its durable result.
      return true;
    }
  }

  return {
    async execute<T extends Record<string, unknown>>(
      command: BusinessMutation<T>
    ): Promise<BusinessResult<T>> {
      const { tool, args, signal, work, prepare } = command;
      const requestId = args.requestId;
      if (
        typeof requestId !== 'string' ||
        requestId.length < 8 ||
        requestId.length > 128
      )
        throw new McpToolError(
          'INVALID_ARGUMENT',
          'requestId must contain 8 to 128 characters.'
        );
      if (!tool)
        throw new McpToolError(
          'INVALID_ARGUMENT',
          'A command name is required.'
        );
      signal?.throwIfAborted();
      // Hash outside the transaction; all record hashes inside work are covered by waitFor.
      const argsHash = await recordVersion(args);
      return withDataMutation(async () => {
        signal?.throwIfAborted();
        const knownReceipt = await database.businessOperations.get(requestId);
        let prepared = !prepare;
        if (!knownReceipt && prepare) {
          await prepare();
          prepared = true;
        }
        signal?.throwIfAborted();
        const committed = await database.transaction(
          'rw',
          database.tables,
          async () => {
            signal?.throwIfAborted();
            const previous = await database.businessOperations.get(requestId);
            if (previous) {
              if (previous.tool !== tool || previous.argsHash !== argsHash)
                throw new McpToolError(
                  'IDEMPOTENCY_CONFLICT',
                  'This requestId was used with different arguments.'
                );
              return { result: previous.result as T, replayed: true };
            }
            if (!prepared)
              throw new McpToolError(
                'CONFLICT',
                'Business history changed during preparation. Read current data before retrying.'
              );
            // Work awaits database operations only; prepare images/import modules before entering.
            // Version helpers explicitly keep the transaction alive around their crypto await.
            const mutation = await work();
            signal?.throwIfAborted();
            await queueBusinessSyncIntents(database, mutation.changes);
            const createdAt = Date.now();
            await database.businessOperations.add({
              requestId,
              tool,
              argsHash,
              result: mutation.result,
              createdAt,
            });
            if (mutation.changes.length)
              await database.businessPublications.add({
                requestId,
                changes: mutation.changes,
                createdAt,
              });
            return { result: mutation.result, replayed: false };
          }
        );
        // Do not honor cancellation here: the committed outbox must remain recoverable.
        const publicationPending = await publishPending(requestId);
        return {
          ...committed.result,
          requestId,
          replayed: committed.replayed,
          publicationPending,
        };
      });
    },
    async recoverPublications() {
      return withDataMutation(async () => {
        const pending = await database.businessPublications
          .orderBy('createdAt')
          .toArray();
        let published = 0;
        for (const publication of pending)
          if (!(await publishPending(publication.requestId))) published += 1;
        return {
          published,
          pending: await database.businessPublications.count(),
        };
      });
    },
  };
}

let defaultUnitOfWork: Promise<BusinessUnitOfWork> | undefined;
async function defaultUnit() {
  defaultUnitOfWork ??= Promise.all([
    import('@/lib/core/db'),
    import('./publishChanges'),
  ]).then(([{ db }, { publishBusinessChanges }]) =>
    createDexieBusinessUnitOfWork(db, publishBusinessChanges)
  );
  return defaultUnitOfWork;
}

export async function recoverDexieBusinessPublications() {
  return (await defaultUnit()).recoverPublications();
}
