'use client';

import React from 'react';

interface UndoButtonProps {
  remainingMs: number;
  onUndo: () => void;
  visible: boolean;
}

export default function UndoButton({
  remainingMs,
  onUndo,
  visible,
}: UndoButtonProps) {
  if (!visible) {
    return null;
  }

  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <button
      type="button"
      onClick={onUndo}
      className="rounded-full bg-neutral-800/80 px-4 py-2 text-sm text-white hover:bg-neutral-700/80"
    >
      撤销 ({seconds}s)
    </button>
  );
}
