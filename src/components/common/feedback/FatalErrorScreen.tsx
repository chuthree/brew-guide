'use client';

import Image from 'next/image';
import { useCallback, useState } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { ErrorReportDrawer } from './ErrorReportDrawer';
import {
  createErrorReport,
  type ErrorReport,
} from '@/lib/feedback/errorReport';
import {
  getCrashDiagnosticReport,
  getCurrentCrashDiagnosticSession,
} from '@/lib/app/crashDiagnostics';

export default function FatalErrorScreen({
  title,
  description,
  error,
}: {
  title: string;
  description: string;
  error: string;
}) {
  const [report, setReport] = useState<ErrorReport | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [preparedData, setPreparedData] = useState<string>();
  const showDiagnostics = useCallback(async () => {
    setLoadingDiagnostics(true);
    try {
      const [session, previousReport] = await Promise.all([
        getCurrentCrashDiagnosticSession().catch(() => null),
        getCrashDiagnosticReport().catch(() => null),
      ]);
      setReport(
        createErrorReport({
          title,
          source: 'app:fatal-error',
          error,
          logs: [
            session
              ? `当前会话诊断:\n${JSON.stringify(session, null, 2)}`
              : '当前会话诊断不可用',
            previousReport
              ? `历史异常（不代表本次错误）:\n${JSON.stringify(previousReport, null, 2)}`
              : '历史异常报告不存在或无法读取',
          ],
        })
      );
    } finally {
      setLoadingDiagnostics(false);
    }
  }, [title, error]);
  const showContact = useCallback(() => {
    setPanelOpen(true);
  }, []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const closeReport = useCallback(() => setReport(null), []);

  const exportData = useCallback(async () => {
    setExporting(true);
    setExportStatus('');
    try {
      const [{ DataManager }, { exportDataAsJsonFile }] = await Promise.all([
        import('@/lib/core/dataManager'),
        import('@/lib/utils/dataExportUtils'),
      ]);
      const data =
        preparedData ??
        (await DataManager.exportAllData({ readPersistedSettings: true }));
      const { mode } = await exportDataAsJsonFile(data, {
        returnIncompleteResult: true,
      });
      if (mode === 'cancelled') return;
      if (mode === 'activation-required') {
        setPreparedData(data);
        setExportStatus('再次点击导出');
        return;
      }
      setPreparedData(undefined);
      setExportStatus(
        mode === 'native-share'
          ? '确认文件已保存后可再次导出'
          : '已导出 · 再次导出'
      );
    } catch {
      setExportStatus('导出失败 · 重试');
    } finally {
      setExporting(false);
    }
  }, [preparedData]);

  return (
    <main className="app-viewport overflow-y-auto bg-neutral-50 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="flex min-h-full flex-col items-center justify-end px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(var(--safe-area-bottom,0px),env(safe-area-inset-bottom,0px))] md:justify-center">
        <section className="flex w-full max-w-sm flex-col gap-8 text-left">
          <div className="flex flex-col items-start" role="alert">
            <svg
              aria-hidden="true"
              viewBox="4 4 56 49"
              fill="none"
              className="mb-4 block w-10"
            >
              <path
                className="fill-red-600 dark:fill-red-400"
                fillRule="evenodd"
                d="M9 4h46a5 5 0 0 1 4.33 7.5l-23 39a5 5 0 0 1-8.66 0l-23-39A5 5 0 0 1 9 4Z M30 15a2 2 0 0 1 4 0v11a2 2 0 0 1-4 0Z M29.75 34a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 1 0-4.5 0Z"
              />
            </svg>
            <h1 className="text-xl leading-snug font-semibold">{title}</h1>
            <p className="mt-2 w-full text-sm leading-relaxed text-pretty text-neutral-600 dark:text-neutral-400">
              {description}
            </p>
          </div>
          <ActionDrawer.Actions className="flex-col [&>button]:font-semibold [&>button]:text-neutral-800 dark:[&>button]:text-neutral-100">
            <ActionDrawer.SecondaryButton
              onClick={showDiagnostics}
              disabled={loadingDiagnostics}
              className="min-h-11 text-left"
            >
              {loadingDiagnostics ? '正在读取诊断…' : '诊断信息'}
            </ActionDrawer.SecondaryButton>
            <ActionDrawer.SecondaryButton
              onClick={showContact}
              className="min-h-11 text-left"
            >
              联系开发者
            </ActionDrawer.SecondaryButton>
            <ActionDrawer.SecondaryButton
              onClick={exportData}
              disabled={exporting}
              className="min-h-11 text-left"
            >
              <span aria-live="polite">
                {exporting ? '正在导出…' : exportStatus || '导出数据'}
              </span>
            </ActionDrawer.SecondaryButton>
          </ActionDrawer.Actions>
        </section>
      </div>
      <ActionDrawer
        title="联系开发者"
        isOpen={isPanelOpen}
        onClose={closePanel}
        autoFocus
        disableHistory
      >
        <ActionDrawer.Content>
          <div className="rounded-2xl bg-neutral-100 p-2 dark:bg-neutral-800">
            <Image
              src="/images/content/chu-code.jpg"
              alt="开发者微信二维码"
              width={200}
              height={200}
              className="h-auto w-full rounded-xl bg-white"
            />
          </div>
        </ActionDrawer.Content>
        <ActionDrawer.Actions>
          <ActionDrawer.SecondaryButton
            onClick={closePanel}
            className="text-center"
          >
            关闭
          </ActionDrawer.SecondaryButton>
        </ActionDrawer.Actions>
      </ActionDrawer>
      {report && (
        <ErrorReportDrawer
          key={report.id}
          report={report}
          onClose={closeReport}
          disableHistory
        />
      )}
    </main>
  );
}
