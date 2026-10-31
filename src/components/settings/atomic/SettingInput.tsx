'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type SettingInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'className'
>;

/** 设置行中的文本输入，密码字段使用同一套显示按钮。 */
export default function SettingInput({
  type = 'text',
  disabled,
  onPointerDown,
  ...props
}: SettingInputProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="flex h-4 w-full min-w-0 items-center gap-1">
      <input
        {...props}
        data-vaul-no-drag
        onPointerDown={event => {
          event.stopPropagation();
          onPointerDown?.(event);
        }}
        disabled={disabled}
        type={isPassword && visible ? 'text' : type}
        className="h-4 min-w-0 flex-1 appearance-none rounded-none border-0 bg-transparent p-0 text-right text-sm leading-none font-normal text-neutral-600 shadow-none select-text placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-600 disabled:opacity-40 dark:text-neutral-300 dark:placeholder:text-neutral-500 dark:focus-visible:outline-neutral-300"
      />
      {isPassword && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVisible(current => !current)}
          aria-label={`${visible ? '隐藏' : '显示'}${props['aria-label'] || '密码'}`}
          aria-pressed={visible}
          className="-my-1 -mr-1 flex size-6 shrink-0 items-center justify-center text-neutral-400 active:opacity-70 disabled:opacity-40 dark:text-neutral-500"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      )}
    </div>
  );
}
