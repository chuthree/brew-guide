'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
    children: ReactNode
    fallback?: ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

/**
 * 错误边界组件
 * 用于捕获子组件树中的JavaScript错误，避免整个应用崩溃
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = {
            hasError: false,
            error: null
        }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        // 更新状态，下次渲染时显示备用UI
        return {
            hasError: true,
            error
        }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // 记录错误信息
        console.error('ErrorBoundary捕获到错误:', error, errorInfo)
        
        // 如果提供了onError回调，则调用它
        if (this.props.onError) {
            this.props.onError(error, errorInfo)
        }

        // 尝试自动修复数据问题
        this.tryFixData()
    }

    // 尝试自动修复数据问题
    async tryFixData() {
        try {
            const { DataManager } = await import('@/lib/dataManager')
            const result = await DataManager.fixBlendBeansData()
            
            if (result.fixedCount > 0) {
                console.log(`自动修复了${result.fixedCount}个问题数据`)
                
                // 如果修复成功，3秒后刷新页面
                setTimeout(() => {
                    window.location.reload()
                }, 3000)
            }
        } catch (err) {
            console.error('自动修复数据失败:', err)
        }
    }

    // 重置错误状态
    resetError = () => {
        this.setState({
            hasError: false,
            error: null
        })
    }

    render() {
        if (this.state.hasError) {
            // 如果提供了自定义的fallback，则使用它
            if (this.props.fallback) {
                return this.props.fallback
            }

            // 默认的错误UI
            return (
                <div className="p-4 rounded-md bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800/50">
                    <h2 className="text-lg font-medium text-red-700 dark:text-red-400 mb-2">
                        渲染出现问题
                    </h2>
                    <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                        应用遇到了一个错误，正在尝试自动修复...
                    </p>
                    <div className="flex space-x-2">
                        <button
                            onClick={this.resetError}
                            className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                        >
                            重试
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors dark:bg-red-800/30 dark:text-red-300 dark:hover:bg-red-800/50"
                        >
                            刷新页面
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary 