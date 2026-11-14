'use client';

import { useCallback, useEffect, useState } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';
import {
  CRASH_DIAGNOSTIC_REPORT_UPDATED_EVENT,
  acknowledgeCrashDiagnosticReport,
  getCrashDiagnosticReport,
  shouldShowDataIntegrityNotice,
  type CrashDiagnosticReport,
} from '@/lib/app/crashDiagnostics';
import { showErrorReport } from '@/lib/feedback/errorReport';
import { useDataLayer } from '@/providers/DataLayerProvider';

export default function DataIntegrityDrawer() {
  const { isInitialized } = useDataLayer();
  const [report, setReport] = useState<CrashDiagnosticReport | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    let revision = 0;
    const refresh = async () => {
      const current = ++revision;
      try {
        const next = await getCrashDiagnosticReport();
        if (current === revision) setReport(next);
      } catch (error) {
        console.warn('读取数据异常诊断失败:', error);
      }
    };
    window.addEventListener(CRASH_DIAGNOSTIC_REPORT_UPDATED_EVENT, refresh);
    void refresh();
    return () => {
      revision++;
      window.removeEventListener(
        CRASH_DIAGNOSTIC_REPORT_UPDATED_EVENT,
        refresh
      );
    };
  }, [isInitialized]);

  return report?.source === 'data-integrity' ? (
    <DataIntegrityNotice key={report.session.sessionId} report={report} />
  ) : null;
}

function DataIntegrityNotice({ report }: { report: CrashDiagnosticReport }) {
  const [closed, setClosed] = useState(false);
  const close = useCallback(async () => {
    setClosed(true);
    try {
      await acknowledgeCrashDiagnosticReport(report.session.sessionId);
    } catch (error) {
      console.warn('保存数据异常提醒已读状态失败:', error);
    }
  }, [report.session.sessionId]);
  const showDiagnostics = useCallback(() => {
    void close();
    showErrorReport({
      title: '数据异常诊断',
      source: 'data:integrity',
      error: report.inferredReason,
      logs: [JSON.stringify(report, null, 2)],
    });
  }, [close, report]);

  return (
    <ActionDrawer
      title="未找到之前的咖啡数据"
      isOpen={!closed && shouldShowDataIntegrityNotice(report)}
      onClose={close}
      historyId="data-integrity-notice"
      priority={1}
      autoFocus
    >
      <ActionDrawer.Icon icon={DataAlertIcon} />
      <ActionDrawer.Content>
        <p className="font-medium text-neutral-900 dark:text-neutral-100">
          未找到之前的咖啡数据
        </p>
        <p className="text-neutral-500 dark:text-neutral-400">
          之前保存的数据现在为空。如果你没有主动清空，请先不要卸载应用或清除数据。
        </p>
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={close}>
          关闭
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton onClick={showDiagnostics}>
          查看诊断
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
}
