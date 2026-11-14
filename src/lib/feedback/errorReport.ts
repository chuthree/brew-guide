import { create } from 'zustand';
import { BUILD_INFO } from '@/lib/core/buildInfo';
import { detectAppRuntime } from '@/lib/app/runtime';
import { sanitizeDiagnosticText } from './sanitizeDiagnosticText';

export interface ErrorReportInput {
  title: string;
  source: string;
  error: unknown;
  logs?: readonly string[];
}

let nextReportId = 0;

function describeError(error: unknown, depth = 0): string {
  if (depth > 3) return '[原因链已截断]';
  if (error == null) return '未提供底层错误';
  if (typeof error !== 'object') return String(error);
  const fields = error as Record<string, unknown>;
  const lines = ['name', 'message', 'code', 'status', 'stack'].flatMap(key => {
    const value = fields[key];
    return typeof value === 'string' || typeof value === 'number'
      ? [`${key}: ${value}`]
      : [];
  });
  if (fields.cause != null)
    lines.push(`cause: ${describeError(fields.cause, depth + 1)}`);
  return lines.join('\n') || '错误对象未提供 message、code 或 stack';
}

function safeText(text: string, limit: number): string {
  const sanitized = sanitizeDiagnosticText(text);
  return sanitized.length > limit
    ? `${sanitized.slice(0, limit)}\n[内容已截断]`
    : sanitized;
}

/** Capture once at the failure boundary; never pass settings, records or request bodies. */
export function createErrorReport(input: ErrorReportInput) {
  return {
    id: ++nextReportId,
    title: safeText(input.title, 200),
    source: safeText(input.source, 200),
    capturedAt: new Date().toISOString(),
    build: { ...BUILD_INFO },
    runtime: detectAppRuntime(),
    userAgent:
      typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
    online: typeof navigator === 'undefined' ? null : navigator.onLine,
    error: safeText(describeError(input.error), 12000),
    logs: safeText((input.logs ?? []).join('\n'), 36000),
  };
}

export type ErrorReport = ReturnType<typeof createErrorReport>;

// Keep the visible snapshot stable; identical pending failures do not stack dialogs.
export const useErrorReportStore = create<{
  reports: ErrorReport[];
  omittedCount: number;
}>(() => ({ reports: [], omittedCount: 0 }));

export function showErrorReport(input: ErrorReportInput): void {
  const report = createErrorReport(input);
  useErrorReportStore.setState(state => {
    if (
      state.reports.some(
        item =>
          item.source === report.source &&
          item.error === report.error &&
          item.logs === report.logs
      )
    )
      return state;
    if (state.reports.length >= 10)
      return { omittedCount: state.omittedCount + 1 };
    return { reports: [...state.reports, report] };
  });
}

export function dismissErrorReport(report: ErrorReport): void {
  useErrorReportStore.setState(state => {
    const reports = state.reports.filter(item => item !== report);
    return { reports, omittedCount: reports.length ? state.omittedCount : 0 };
  });
}
