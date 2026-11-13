'use client';

import { useEffect } from 'react';
import FatalErrorScreen from '@/components/common/feedback/FatalErrorScreen';
import { recordCrashError } from '@/lib/app/crashDiagnostics';
import '@/styles/base/globals.css';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    recordCrashError(error, 'next-global-error');
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <FatalErrorScreen
          title="无法打开页面"
          description="Brew Guide 运行时遇到问题。你可以尝试导出数据副本，或将诊断信息发给开发者以获取协助。"
          error={[error.stack || error.message, error.digest]
            .filter(Boolean)
            .join('\n')}
        />
      </body>
    </html>
  );
}
