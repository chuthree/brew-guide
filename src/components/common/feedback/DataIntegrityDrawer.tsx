'use client';

import Image from 'next/image';
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
import { exportJsonFile } from '@/lib/utils/jsonExport';
import { useDataLayer } from '@/providers/DataLayerProvider';

export default function DataIntegrityDrawer() {
  const { isInitialized } = useDataLayer();
  const [report, setReport] = useState<CrashDiagnosticReport | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    let mounted = true;
    const refresh = async () => {
      try {
        const next = await getCrashDiagnosticReport();
        if (mounted) setReport(next);
      } catch (error) {
        console.warn('读取数据异常诊断失败:', error);
      }
    };
    window.addEventListener(CRASH_DIAGNOSTIC_REPORT_UPDATED_EVENT, refresh);
    void refresh();
    return () => {
      mounted = false;
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
  const [view, setView] = useState<'notice' | 'help' | 'contact'>('notice');
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState('');
  const [closed, setClosed] = useState(false);

  const close = useCallback(async () => {
    setClosed(true);
    try {
      await acknowledgeCrashDiagnosticReport(report.session.sessionId);
    } catch (error) {
      console.warn('保存数据异常提醒已读状态失败:', error);
    }
  }, [report.session.sessionId]);
  const showHelp = useCallback(() => setView('help'), []);
  const showContact = useCallback(() => setView('contact'), []);

  const exportDiagnostics = useCallback(async () => {
    setExporting(true);
    setStatus('');
    try {
      const result = await exportJsonFile({
        jsonData: JSON.stringify(report, null, 2),
        fileName: 'brew-guide-data-integrity-diagnostics.json',
        title: '导出诊断',
        dialogTitle: '导出诊断',
        returnIncompleteResult: true,
      });
      if (result.mode === 'activation-required') {
        setStatus('请再次点击导出诊断。');
      } else if (result.mode !== 'cancelled') {
        setStatus(
          result.mode === 'native-share' ? '请确认文件已保存。' : '文件已导出。'
        );
      }
    } catch {
      setStatus('导出未完成，请重试。');
    } finally {
      setExporting(false);
    }
  }, [report]);

  const title =
    view === 'notice'
      ? '未找到之前的咖啡数据'
      : view === 'help'
        ? '获取帮助'
        : '联系开发者';

  return (
    <ActionDrawer
      title={title}
      isOpen={!closed && shouldShowDataIntegrityNotice(report)}
      onClose={close}
      historyId="data-integrity-notice"
      priority={1}
      autoFocus
      dismissible={!exporting}
    >
      <ActionDrawer.Switcher activeKey={view}>
        {view === 'notice' && <ActionDrawer.Icon icon={DataAlertIcon} />}
        <ActionDrawer.Content>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">
            {title}
          </p>
          {view === 'notice' ? (
            <p className="text-neutral-500 dark:text-neutral-400">
              之前保存的数据现在为空。如果你没有主动清空，请先不要卸载应用或清除数据。
            </p>
          ) : view === 'help' ? (
            <p className="text-neutral-500 dark:text-neutral-400">
              导出诊断后发给开发者，协助查找原因。
            </p>
          ) : (
            <Image
              src="/images/content/chu-code.jpg"
              alt="开发者微信二维码"
              width={200}
              height={200}
              className="mx-auto rounded-xl bg-white"
            />
          )}
          {status && <p role="status">{status}</p>}
        </ActionDrawer.Content>
        {view === 'help' && (
          <ActionDrawer.Actions className="mb-3 flex-col">
            <ActionDrawer.SecondaryButton
              onClick={exportDiagnostics}
              disabled={exporting}
            >
              导出诊断
            </ActionDrawer.SecondaryButton>
            <ActionDrawer.SecondaryButton
              onClick={showContact}
              disabled={exporting}
            >
              联系开发者
            </ActionDrawer.SecondaryButton>
          </ActionDrawer.Actions>
        )}
        <ActionDrawer.Actions>
          <ActionDrawer.SecondaryButton onClick={close} disabled={exporting}>
            关闭
          </ActionDrawer.SecondaryButton>
          {view !== 'help' && (
            <ActionDrawer.PrimaryButton onClick={showHelp}>
              {view === 'notice' ? '获取帮助' : '返回'}
            </ActionDrawer.PrimaryButton>
          )}
        </ActionDrawer.Actions>
      </ActionDrawer.Switcher>
    </ActionDrawer>
  );
}
