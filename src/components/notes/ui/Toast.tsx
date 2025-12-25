'use client';

import React from 'react';
import { ToastProps } from '../types';

const Toast: React.FC<ToastProps> = ({ visible, message, type }) => {
  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 transform rounded-md border border-neutral-200/50 bg-white px-4 py-2 text-sm shadow-lg transition-opacity duration-300 ease-in-out dark:border-neutral-700 dark:bg-neutral-800">
      <div
        className={`text-center ${type === 'error' ? 'text-red-500 dark:text-red-400' : type === 'success' ? 'text-emerald-600 dark:text-emerald-500' : 'text-neutral-800 dark:text-neutral-100'}`}
      >
        {message}
      </div>
    </div>
  );
};

export default Toast;
