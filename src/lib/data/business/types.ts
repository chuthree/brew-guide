/** Transport/backend-neutral contract for one atomic business command. */
export interface BusinessChange {
  entity:
    | 'bean'
    | 'brew_note'
    | 'equipment'
    | 'method'
    | 'grinder'
    | 'settings';
  id: string;
  before: unknown | null;
  after: unknown | null;
}

export interface BusinessWork<T extends Record<string, unknown>> {
  result: T;
  changes: BusinessChange[];
  summary?: string;
}

export interface BusinessMutation<T extends Record<string, unknown>> {
  tool: string;
  args: Record<string, unknown>;
  signal?: AbortSignal;
  /** Optional expensive/non-transactional preparation, skipped for durable replays. */
  prepare?: () => Promise<void>;
  /**
   * Transactional repository calls only. Preload modules and prepare images before
   * entering; foreign async work must explicitly preserve the backend transaction.
   * UI/network side effects belong to publication.
   */
  work: () => Promise<BusinessWork<T>>;
}

export type BusinessResult<T extends Record<string, unknown>> = T & {
  requestId: string;
  replayed: boolean;
  publicationPending: boolean;
};

export interface BusinessReceipt {
  requestId: string;
  tool: string;
  argsHash: string;
  result: Record<string, unknown>;
  createdAt: number;
}

export interface BusinessPublication {
  requestId: string;
  changes: BusinessChange[];
  createdAt: number;
}

export type BusinessPublisher = (changes: BusinessChange[]) => Promise<void>;

/** Backend implementations commit data, receipt and publication intent together. */
export interface BusinessUnitOfWork {
  execute<T extends Record<string, unknown>>(
    command: BusinessMutation<T>
  ): Promise<BusinessResult<T>>;
  recoverPublications(): Promise<{ published: number; pending: number }>;
}
