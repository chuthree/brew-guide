'use client';

import { useEffect, useState } from 'react';
import {
  dismissCrashDiagnosticReport,
  formatCrashDiagnosticReport,
  getCrashDiagnosticReport,
  type CrashDiagnosticReport,
} from '@/lib/app/crashDiagnostics';

export default function CrashRecoveryNotice() {
  const [report, setReport] = useState<CrashDiagnosticReport | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;

    void getCrashDiagnosticReport().then(nextReport => {
      if (mounted) {
        setReport(nextReport);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!report) {
    return null;
  }

  const handleDismiss = async () => {
    await dismissCrashDiagnosticReport();
    setReport(null);
  };

  const handleCopy = async () => {
    const text = formatCrashDiagnosticReport(report);

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-9998 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-amber-200/80 bg-white/96 p-4 shadow-xl shadow-amber-100/60 backdrop-blur dark:border-amber-400/20 dark:bg-neutral-900/96 dark:shadow-black/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              检测到上次启动异常中断
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
              {report.inferredReason}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void handleDismiss();
            }}
            className="rounded-full px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            关闭
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              void handleCopy();
            }}
            className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {copied ? '已复制' : '复制诊断'}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleDismiss();
            }}
            className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            稍后处理
          </button>
        </div>
      </div>
    </div>
  );
}
