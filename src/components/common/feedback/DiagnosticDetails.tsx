import type { Ref } from 'react';

export default function DiagnosticDetails({
  value,
  ref,
}: {
  value: string;
  ref?: Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      ref={ref}
      aria-label="错误诊断日志"
      readOnly
      value={value}
      data-vaul-no-drag
      className="h-48 max-h-[32dvh] w-full resize-none overscroll-contain rounded-xl bg-neutral-100 p-3 font-mono text-xs leading-relaxed select-text dark:bg-neutral-800"
    />
  );
}
