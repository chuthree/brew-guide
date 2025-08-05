'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BloggerType, BLOGGER_LABELS } from '@/components/coffee-bean/List/types'
import CoffeeBeanList from '@/components/coffee-bean/List'
import { VIEW_OPTIONS } from '@/components/coffee-bean/List/types'

interface BeanlistClientPageProps {
    blogger: BloggerType
    isValidBlogger: boolean
    validBloggers: BloggerType[]
}

/**
 * 豆单客户端页面组件
 */
export default function BeanlistClientPage({
    blogger: initialBlogger,
    isValidBlogger,
    validBloggers
}: BeanlistClientPageProps) {
    const router = useRouter()
    const [blogger, setBlogger] = useState<BloggerType>(initialBlogger)
    const [isMounted, setIsMounted] = useState(false)

    // 确保组件在客户端完全挂载后再渲染，避免hydration错误
    useEffect(() => {
        setIsMounted(true)
    }, [])

    // 处理博主切换
    const handleBloggerChange = (newBlogger: BloggerType) => {
        setBlogger(newBlogger)
        // 更新URL
        router.push(`/beanlist/${newBlogger}`)
    }

    // 在客户端挂载前显示加载状态，避免hydration错误
    if (!isMounted) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
                <div className="text-neutral-600 dark:text-neutral-400">加载中...</div>
            </div>
        )
    }

    if (!isValidBlogger) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex flex-col items-center justify-center">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">
                        博主不存在
                    </h1>
                    <p className="text-neutral-600 dark:text-neutral-400">
                        请访问有效的博主豆单：
                    </p>
                    <div className="space-y-2">
                        {validBloggers.map((validBlogger) => (
                            <div key={validBlogger}>
                                <button
                                    onClick={() => router.push(`/beanlist/${validBlogger}`)}
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    /beanlist/{validBlogger} - {BLOGGER_LABELS[validBlogger]}豆单
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => router.push('/')}
                        className="mt-4 px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                    >
                        返回首页
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen bg-neutral-50 dark:bg-neutral-900 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
                <CoffeeBeanList
                    isOpen={true}
                    initialViewMode={VIEW_OPTIONS.BLOGGER}
                    initialBloggerType={blogger}
                    onBloggerTypeChange={handleBloggerChange}
                />
            </div>
        </div>
    )
}
