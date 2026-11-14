'use client';

import { useCallback, useRef, useState } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';
import { copyToClipboard } from '@/lib/utils/exportUtils';
import {
  dismissErrorReport,
  useErrorReportStore,
  type ErrorReport,
} from '@/lib/feedback/errorReport';

export function ErrorReportDrawer({
  report,
  onClose,
  disableHistory = false,
  pendingCount = 0,
  omittedCount = 0,
}: {
  report: ErrorReport;
  onClose: () => void;
  disableHistory?: boolean;
  pendingCount?: number;
  omittedCount?: number;
}) {
  const { error, logs, ...context } = report;
  const title = `${report.title}，可将诊断信息发送给开发者以获取帮助。`;
  const text = [
    JSON.stringify(context, null, 2),
    '',
    '错误详情:',
    error,
    '',
    '操作日志:',
    logs || '无附加操作日志',
    ...(pendingCount > 0 ? [`待查看诊断: ${pendingCount} 条`] : []),
    ...(omittedCount > 0
      ? [`超过保留上限而未记录的错误: ${omittedCount} 次`]
      : []),
  ].join('\n');
  const textArea = useRef<HTMLTextAreaElement>(null);
  const busy = useRef(false);
  const [copyState, setCopyState] = useState<
    'idle' | 'copying' | 'copied' | 'failed'
  >('idle');
  const [open, setOpen] = useState(true);
  const close = useCallback(() => {
    if (!busy.current) setOpen(false);
  }, []);

  const copy = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setCopyState('copying');
    try {
      const result = await copyToClipboard(text);
      setCopyState(result.success ? 'copied' : 'failed');
      if (!result.success) {
        textArea.current?.focus();
        textArea.current?.select();
      }
    } finally {
      busy.current = false;
    }
  }, [text]);

  return (
    <ActionDrawer
      title={title}
      isOpen={open}
      onClose={close}
      onExitComplete={onClose}
      disableHistory={disableHistory}
      priority={2}
      autoFocus
      dismissible={copyState !== 'copying'}
    >
      <ActionDrawer.Icon icon={DataAlertIcon} />
      <ActionDrawer.Content>
        <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {title}
        </p>
        <textarea
          ref={textArea}
          aria-label="错误诊断日志"
          readOnly
          value={text}
          data-vaul-no-drag
          className="h-48 max-h-[32dvh] w-full resize-none overscroll-contain rounded-xl bg-neutral-100 p-3 font-mono text-xs leading-relaxed select-text dark:bg-neutral-800"
        />
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton
          onClick={close}
          disabled={copyState === 'copying'}
        >
          关闭
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton
          onClick={copy}
          disabled={copyState === 'copying'}
        >
          <span aria-live="polite">
            {copyState === 'copied'
              ? '已复制'
              : copyState === 'copying'
                ? '正在复制…'
                : copyState === 'failed'
                  ? '复制失败，重试'
                  : '复制诊断'}
          </span>
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
}

export default function ErrorReportHost() {
  const reports = useErrorReportStore(state => state.reports);
  const omittedCount = useErrorReportStore(state => state.omittedCount);
  const report = reports[0];
  const close = useCallback(() => {
    if (report) dismissErrorReport(report);
  }, [report]);
  return report ? (
    <ErrorReportDrawer
      key={report.id}
      report={report}
      onClose={close}
      pendingCount={reports.length - 1}
      omittedCount={omittedCount}
    />
  ) : null;
}
