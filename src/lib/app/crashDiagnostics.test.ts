import { describe, expect, it } from 'vitest';
import {
  shouldShowCrashDiagnosticReport,
  type CrashDiagnosticReport,
  type CrashDiagnosticSession,
} from './crashDiagnostics';

const createSession = (
  overrides: Partial<CrashDiagnosticSession> = {}
): CrashDiagnosticSession => ({
  sessionId: 'session-test',
  startedAt: '2026-05-24T11:28:13.787Z',
  updatedAt: '2026-05-24T11:28:15.116Z',
  startupState: 'ready',
  checkpoints: [],
  ...overrides,
});

const createReport = (
  sessionOverrides: Partial<CrashDiagnosticSession> = {}
): CrashDiagnosticReport => ({
  source: 'inferred',
  inferredReason:
    '应用在启动完成前中断，可能是内存压力、WebView 崩溃或系统强杀',
  detectedAt: '2026-05-24T23:03:22.382Z',
  session: createSession(sessionOverrides),
});

describe('shouldShowCrashDiagnosticReport', () => {
  it('temporarily ignores inferred startup interruptions that never reached ready', () => {
    const report = createReport({
      startupState: 'booting',
      lastCheckpoint: {
        name: 'data-layer:notes:normalize',
        at: '2026-05-24T11:28:15.116Z',
      },
      checkpoints: [
        {
          name: 'app:boot',
          at: '2026-05-24T11:28:13.789Z',
        },
        {
          name: 'data-layer:db:migrate',
          at: '2026-05-24T11:28:14.729Z',
        },
        {
          name: 'data-layer:notes:normalize',
          at: '2026-05-24T11:28:15.116Z',
        },
      ],
    });

    expect(shouldShowCrashDiagnosticReport(report)).toBe(false);
  });

  it('continues to show native crash diagnostics', () => {
    const report = createReport({
      startupState: 'failed',
      nativeCrash: {
        platform: 'android',
        reason: 'Android WebView render process gone',
        at: '2026-05-24T11:28:15.116Z',
      },
    });

    expect(shouldShowCrashDiagnosticReport(report)).toBe(true);
  });

  it('shows data integrity reports', () => {
    expect(
      shouldShowCrashDiagnosticReport({
        ...createReport({
          startupState: 'failed',
          lastCheckpoint: {
            name: 'data-integrity:unexpected-empty-core',
            at: '2026-05-24T11:28:15.116Z',
          },
        }),
        source: 'data-integrity',
      })
    ).toBe(true);
  });
});
