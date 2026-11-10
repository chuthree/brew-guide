'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import SettingSection from './SettingSection';

const levelStyles = {
  info: 'bg-blue-600 text-white',
  warning: 'bg-amber-400 text-black',
  important: 'bg-red-600 text-white',
};

interface SettingNoticeProps {
  id: string;
  message: string;
  level?: keyof typeof levelStyles;
  onClose: () => void;
  className?: string;
}

export default function SettingNotice({
  id,
  message,
  level = 'info',
  onClose,
  className,
}: SettingNoticeProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isMultiline, setIsMultiline] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const updateShape = () => {
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
      setIsMultiline(element.getBoundingClientRect().height > lineHeight + 1);
    };
    updateShape();
    const observer = new ResizeObserver(updateShape);
    observer.observe(element);
    return () => observer.disconnect();
  }, [message]);

  return (
    <SettingSection unstyled className={className}>
      <div
        id={id}
        className={`flex items-start gap-4 px-3.5 py-3.5 ${isMultiline ? 'rounded-xl' : 'rounded-full'} ${levelStyles[level]}`}
      >
        <p
          ref={textRef}
          role="status"
          className="min-w-0 flex-1 text-sm leading-5 font-medium"
        >
          {message}
        </p>
        <button
          type="button"
          aria-label="关闭提示"
          onClick={onClose}
          className="relative mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full after:absolute after:-inset-3 focus-visible:outline-2 focus-visible:outline-offset-2 active:opacity-70"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </SettingSection>
  );
}
