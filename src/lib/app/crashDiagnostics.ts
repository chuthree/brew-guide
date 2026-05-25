import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const CURRENT_SESSION_KEY = 'brew-guide:crash-diagnostics:current-session';
const LAST_REPORT_KEY = 'brew-guide:crash-diagnostics:last-report';
const MAX_CHECKPOINTS = 24;
const NON_FATAL_BROWSER_ERROR_PHASES = new Set([
  'window-error',
  'unhandled-rejection',
]);
const IGNORED_BROWSER_ERROR_PATTERNS: RegExp[] = [];
const IGNORE_INFERRED_BOOT_INTERRUPTION_DIAGNOSTICS = true;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface CrashCheckpoint {
  name: string;
  at: string;
  meta?: Record<string, JsonValue>;
}

export interface CrashErrorRecord {
  phase: string;
  name: string;
  message: string;
  stack?: string;
  at: string;
}

export interface NativeCrashRecord {
  platform: 'android' | 'ios';
  reason: string;
  didCrash?: boolean;
  rendererPriorityAtExit?: number;
  at: string;
}

export interface CrashDiagnosticSession {
  sessionId: string;
  startedAt: string;
  updatedAt: string;
  startupState: 'booting' | 'ready' | 'failed';
  checkpoints: CrashCheckpoint[];
  lastCheckpoint?: CrashCheckpoint;
  fatalError?: CrashErrorRecord;
  nativeCrash?: NativeCrashRecord;
}

export interface CrashDiagnosticReport {
  source: 'native' | 'inferred';
  inferredReason: string;
  session: CrashDiagnosticSession;
  detectedAt: string;
}

let activeSession: CrashDiagnosticSession | null = null;
let installPromise: Promise<void> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

const nowIso = (): string => new Date().toISOString();

const createSessionId = (): string =>
  `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const safelyStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const sanitizeMeta = (
  meta?: Record<string, unknown>
): Record<string, JsonValue> | undefined => {
  if (!meta) return undefined;

  const output: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) {
      continue;
    }

    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      output[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      output[key] = value.map(item => String(item));
      continue;
    }

    if (typeof value === 'object') {
      output[key] = safelyStringify(value);
      continue;
    }

    output[key] = String(value);
  }

  return Object.keys(output).length > 0 ? output : undefined;
};

const parseJson = <T>(value: string | null | undefined): T | null => {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const readStorageValue = async <T>(key: string): Promise<T | null> => {
  if (isNativePlatform()) {
    const { value } = await Preferences.get({ key });
    return parseJson<T>(value);
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return parseJson<T>(window.localStorage.getItem(key));
};

const writeStorageValue = async (
  key: string,
  value: unknown
): Promise<void> => {
  const serialized = JSON.stringify(value);

  if (isNativePlatform()) {
    await Preferences.set({ key, value: serialized });
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, serialized);
};

const removeStorageValue = async (key: string): Promise<void> => {
  if (isNativePlatform()) {
    await Preferences.remove({ key });
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(key);
};

const queuePersist = (session: CrashDiagnosticSession | null) => {
  persistQueue = persistQueue
    .catch(() => undefined)
    .then(async () => {
      if (!session) {
        await removeStorageValue(CURRENT_SESSION_KEY);
        return;
      }

      await writeStorageValue(CURRENT_SESSION_KEY, session);
    });
};

const isNonFatalBrowserError = (error: CrashErrorRecord | undefined): boolean =>
  Boolean(error && NON_FATAL_BROWSER_ERROR_PHASES.has(error.phase));

const isIgnoredBrowserError = (error: CrashErrorRecord | undefined): boolean =>
  Boolean(
    error &&
    isNonFatalBrowserError(error) &&
    IGNORED_BROWSER_ERROR_PATTERNS.some(pattern => pattern.test(error.message))
  );

const isTemporarilyIgnoredInferredBootInterruption = (
  session: CrashDiagnosticSession
): boolean =>
  IGNORE_INFERRED_BOOT_INTERRUPTION_DIAGNOSTICS &&
  !session.nativeCrash &&
  !session.fatalError &&
  session.startupState === 'booting';

const isUnexpectedPreviousSession = (
  session: CrashDiagnosticSession | null
): boolean => {
  if (!session) return false;

  if (session.nativeCrash) return true;
  if (isIgnoredBrowserError(session.fatalError)) return false;
  if (isTemporarilyIgnoredInferredBootInterruption(session)) return false;

  return session.startupState !== 'ready';
};

export const shouldShowCrashDiagnosticReport = (
  report: CrashDiagnosticReport | null
): boolean => {
  if (!report) return false;

  const { session } = report;

  if (session.nativeCrash) return true;
  if (isIgnoredBrowserError(session.fatalError)) return false;
  if (isTemporarilyIgnoredInferredBootInterruption(session)) return false;

  return !(
    session.startupState === 'ready' &&
    isNonFatalBrowserError(session.fatalError)
  );
};

const buildInferredReport = (
  session: CrashDiagnosticSession
): CrashDiagnosticReport => ({
  source: session.nativeCrash ? 'native' : 'inferred',
  inferredReason: session.nativeCrash
    ? session.nativeCrash.reason
    : session.fatalError
      ? `${session.fatalError.phase}: ${session.fatalError.message}`
      : '应用在启动完成前中断，可能是内存压力、WebView 崩溃或系统强杀',
  session,
  detectedAt: nowIso(),
});

const updateActiveSession = (
  updater: (session: CrashDiagnosticSession) => CrashDiagnosticSession
) => {
  if (!activeSession) {
    return;
  }

  activeSession = updater(activeSession);
  queuePersist(activeSession);
};

const serializeError = (error: unknown, phase: string): CrashErrorRecord => {
  if (error instanceof Error) {
    return {
      phase,
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack,
      at: nowIso(),
    };
  }

  return {
    phase,
    name: 'UnknownError',
    message: typeof error === 'string' ? error : safelyStringify(error),
    at: nowIso(),
  };
};

export async function installCrashDiagnostics(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (installPromise) {
    return installPromise;
  }

  installPromise = (async () => {
    const [previousSession, storedReport] = await Promise.all([
      readStorageValue<CrashDiagnosticSession>(CURRENT_SESSION_KEY),
      readStorageValue<CrashDiagnosticReport>(LAST_REPORT_KEY),
    ]);
    const existingReport = shouldShowCrashDiagnosticReport(storedReport)
      ? storedReport
      : null;

    if (storedReport && !existingReport) {
      await removeStorageValue(LAST_REPORT_KEY);
    }

    if (
      !existingReport &&
      previousSession &&
      isUnexpectedPreviousSession(previousSession)
    ) {
      await writeStorageValue(
        LAST_REPORT_KEY,
        buildInferredReport(previousSession)
      );
    }

    activeSession = {
      sessionId: createSessionId(),
      startedAt: nowIso(),
      updatedAt: nowIso(),
      startupState: 'booting',
      checkpoints: [
        {
          name: 'app:boot',
          at: nowIso(),
        },
      ],
    };
    queuePersist(activeSession);

    window.addEventListener('error', event => {
      recordObservedBrowserError(event.error || event.message, 'window-error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', event => {
      recordObservedBrowserError(event.reason, 'unhandled-rejection');
    });
  })();

  return installPromise;
}

export function recordCrashCheckpoint(
  name: string,
  meta?: Record<string, unknown>
): void {
  updateActiveSession(session => {
    const checkpoint: CrashCheckpoint = {
      name,
      at: nowIso(),
      meta: sanitizeMeta(meta),
    };

    const checkpoints = [...session.checkpoints, checkpoint].slice(
      -MAX_CHECKPOINTS
    );

    return {
      ...session,
      updatedAt: checkpoint.at,
      lastCheckpoint: checkpoint,
      checkpoints,
    };
  });
}

export function markCrashDiagnosticsReady(
  meta?: Record<string, unknown>
): void {
  updateActiveSession(session => {
    const checkpoint: CrashCheckpoint = {
      name: 'app:ready',
      at: nowIso(),
      meta: sanitizeMeta(meta),
    };

    return {
      ...session,
      startupState: 'ready',
      fatalError: undefined,
      updatedAt: checkpoint.at,
      lastCheckpoint: checkpoint,
      checkpoints: [...session.checkpoints, checkpoint].slice(-MAX_CHECKPOINTS),
    };
  });
}

export function recordCrashError(
  error: unknown,
  phase: string,
  meta?: Record<string, unknown>
): void {
  updateActiveSession(session => {
    const fatalError = serializeError(error, phase);
    const checkpoint: CrashCheckpoint = {
      name: `error:${phase}`,
      at: fatalError.at,
      meta: sanitizeMeta(meta),
    };

    return {
      ...session,
      startupState: 'failed',
      updatedAt: fatalError.at,
      fatalError,
      lastCheckpoint: checkpoint,
      checkpoints: [...session.checkpoints, checkpoint].slice(-MAX_CHECKPOINTS),
    };
  });
}

export function recordObservedBrowserError(
  error: unknown,
  phase: 'window-error' | 'unhandled-rejection',
  meta?: Record<string, unknown>
): void {
  const errorRecord = serializeError(error, phase);

  recordCrashCheckpoint(`error:${phase}`, {
    ...meta,
    errorName: errorRecord.name,
    message: errorRecord.message,
  });
}

export async function getCrashDiagnosticReport(): Promise<CrashDiagnosticReport | null> {
  const report = await readStorageValue<CrashDiagnosticReport>(LAST_REPORT_KEY);

  if (!shouldShowCrashDiagnosticReport(report)) {
    await removeStorageValue(LAST_REPORT_KEY);
    return null;
  }

  return report;
}

export async function dismissCrashDiagnosticReport(): Promise<void> {
  await removeStorageValue(LAST_REPORT_KEY);
}

export async function getCurrentCrashDiagnosticSession(): Promise<CrashDiagnosticSession | null> {
  return readStorageValue<CrashDiagnosticSession>(CURRENT_SESSION_KEY);
}

export const formatCrashDiagnosticReport = (
  report: CrashDiagnosticReport
): string => {
  const { session } = report;
  const header = [
    `检测时间: ${report.detectedAt}`,
    `来源: ${report.source}`,
    `推断原因: ${report.inferredReason}`,
    `会话 ID: ${session.sessionId}`,
    `启动状态: ${session.startupState}`,
    `开始时间: ${session.startedAt}`,
    `最后更新时间: ${session.updatedAt}`,
  ];

  const lastCheckpoint = session.lastCheckpoint
    ? [
        '',
        '最后检查点:',
        `${session.lastCheckpoint.name} @ ${session.lastCheckpoint.at}`,
        session.lastCheckpoint.meta
          ? safelyStringify(session.lastCheckpoint.meta)
          : '',
      ]
    : [];

  const fatalError = session.fatalError
    ? [
        '',
        '致命错误:',
        `${session.fatalError.name}: ${session.fatalError.message}`,
        `Phase: ${session.fatalError.phase}`,
        session.fatalError.stack || '',
      ]
    : [];

  const nativeCrash = session.nativeCrash
    ? ['', '原生崩溃记录:', safelyStringify(session.nativeCrash)]
    : [];

  const checkpoints = session.checkpoints.length
    ? [
        '',
        '最近检查点:',
        ...session.checkpoints.map(
          checkpoint =>
            `${checkpoint.at} ${checkpoint.name}${
              checkpoint.meta ? ` ${safelyStringify(checkpoint.meta)}` : ''
            }`
        ),
      ]
    : [];

  return [
    ...header,
    ...lastCheckpoint,
    ...fatalError,
    ...nativeCrash,
    ...checkpoints,
  ]
    .filter(Boolean)
    .join('\n');
};
