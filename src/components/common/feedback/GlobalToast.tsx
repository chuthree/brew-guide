'use client'

import React, { useState, useEffect, createContext, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// 定义消息类型
type ToastType = 'success' | 'info' | 'error' | 'warning'

// 定义Toast消息接口
interface ToastMessage {
    id: string
    type: ToastType
    title: string
    listItems?: string[]
    duration?: number
}

// 定义上下文接口
interface ToastContextType {
    showToast: (toast: Omit<ToastMessage, 'id'>) => void
    hideToast: (id: string) => void
}

// 创建上下文
const ToastContext = createContext<ToastContextType | undefined>(undefined)

// 自定义Hook
export const useToast = () => {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

// 全局函数用于直接显示提示（用于非React环境）
export let globalShowToast: (toast: Omit<ToastMessage, 'id'>) => void
let showToastFn: ((options: Omit<ToastMessage, 'id'>) => void) | null = null

export const setGlobalShowToast = (fn: (toast: Omit<ToastMessage, 'id'>) => void) => {
    globalShowToast = fn
    showToastFn = fn
}

export function showToast(options: Omit<ToastMessage, 'id'>) {
    if (showToastFn) {
        showToastFn(options)
    } else {
        console.warn('Toast callback not set')
    }
}

// Toast提供者组件
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([])

    // 显示Toast
    const showToast = (toast: Omit<ToastMessage, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9)
        const newToast: ToastMessage = {
            ...toast,
            id,
            duration: toast.duration || 3000 // 默认3秒
        }
        setToasts((prevToasts) => [...prevToasts, newToast])
    }

    // 隐藏Toast
    const hideToast = (id: string) => {
        setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id))
    }

    useEffect(() => {
        setGlobalShowToast(showToast)
        return () => setGlobalShowToast(() => {})
    }, [])

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}
            <ToastContainer toasts={toasts} hideToast={hideToast} />
        </ToastContext.Provider>
    )
}

// Toast容器组件
const ToastContainer: React.FC<{ toasts: ToastMessage[], hideToast: (id: string) => void }> = ({ toasts, hideToast }) => {
    return (
        <div className="fixed top-[calc(env(safe-area-inset-top)+16px)] right-4 z-[200] flex flex-col gap-2 max-w-[320px]">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <Toast key={toast.id} toast={toast} onClose={() => hideToast(toast.id)} />
                ))}
            </AnimatePresence>
        </div>
    )
}

// 单个Toast组件
export const Toast: React.FC<{ toast: ToastMessage, onClose: () => void }> = ({ toast, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose()
        }, toast.duration)

        return () => clearTimeout(timer)
    }, [toast.duration, onClose])

    // 根据类型返回合适的图标
    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-green-400 dark:text-green-500">
                        <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )
            case 'error':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-400 dark:text-red-500">
                        <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )
            case 'warning':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-yellow-400 dark:text-yellow-500">
                        <path d="M12 8V12M12 16H12.01M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )
            default:
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-400 dark:text-blue-500">
                        <path d="M12 8V12M12 16H12.01M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -10, x: 10 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 p-4 rounded-lg shadow-lg"
        >
            <div className="flex items-start">
                <div className="flex-shrink-0 mr-2">
                    {getIcon()}
                </div>
                <div className="flex-1">
                    <p className="font-medium text-sm mb-1">{toast.title}</p>
                    {toast.listItems && toast.listItems.length > 0 && (
                        <ol className="text-xs text-neutral-300 dark:text-neutral-600 ml-4 list-decimal">
                            {toast.listItems.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ol>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="text-neutral-400 hover:text-neutral-100 dark:hover:text-neutral-800 ml-2"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>
        </motion.div>
    )
} 