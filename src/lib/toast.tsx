'use client'

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface ToastOptions {
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    duration?: number;
}

interface ToastState extends ToastOptions {
    id: number;
}

let toastId = 0;
let showToastFn: ((options: ToastOptions) => void) | null = null;

export function setToastCallback(callback: (options: ToastOptions) => void) {
    showToastFn = callback;
}

export function showToast(options: ToastOptions) {
    if (showToastFn) {
        showToastFn(options);
    } else {
        console.warn('Toast callback not set');
    }
}

export function Toast() {
    const [toasts, setToasts] = useState<ToastState[]>([]);

    useEffect(() => {
        setToastCallback((options: ToastOptions) => {
            const id = ++toastId;
            setToasts(prev => [...prev, { ...options, id }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(toast => toast.id !== id));
            }, options.duration || 3000);
        });

        return () => setToastCallback(() => {});
    }, []);

    return (
        <div className="fixed top-0 right-0 z-50 p-4 space-y-4">
            <AnimatePresence>
                {toasts.map(toast => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`px-4 py-2 rounded-md shadow-lg text-sm ${
                            toast.type === 'success'
                                ? 'bg-green-500 text-neutral-100'
                                : toast.type === 'error'
                                ? 'bg-red-500 text-neutral-100'
                                : toast.type === 'warning'
                                ? 'bg-yellow-500 text-neutral-100'
                                : 'bg-blue-500 text-neutral-100'
                        }`}
                    >
                        {toast.title}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
} 