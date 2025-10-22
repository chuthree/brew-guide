'use client';

import React from 'react';
import { AddNoteButtonProps } from '../types';

const AddNoteButton: React.FC<AddNoteButtonProps> = ({ onAddNote }) => {
  return (
    <div className="bottom-action-bar">
      <div className="pointer-events-none absolute right-0 bottom-full left-0 h-12 bg-linear-to-t from-neutral-50 to-transparent dark:from-neutral-900"></div>
      <div className="pb-safe-bottom relative mx-auto flex max-w-[500px] items-center bg-neutral-50 dark:bg-neutral-900">
        <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
        <button
          onClick={onAddNote}
          className="flex items-center justify-center px-3 text-xs font-medium text-neutral-600 dark:text-neutral-400"
        >
          <span className="mr-1">+</span> 手动添加
        </button>
        <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
      </div>
    </div>
  );
};

export default AddNoteButton;
