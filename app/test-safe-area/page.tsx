'use client'

import React from 'react'
import Link from 'next/link'

export default function TestSafeArea() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* 顶部安全区域测试 */}
            <div className="bg-blue-500 text-white pt-safe">
                <div className="px-6 px-safe py-4">
                    <h1 className="text-lg font-medium">顶部安全区域测试</h1>
                    <p className="text-sm opacity-80">这个区域应该在刘海下方</p>
                </div>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 px-6 px-safe py-8">
                <h2 className="text-xl mb-4">安全区域测试页面</h2>
                <p className="mb-6">
                    这个页面用于测试 tailwindcss-safe-area 插件是否正常工作。
                    在全面屏设备上，内容应该正确地避开刘海、底部手势区域等。
                </p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg">
                        <h3 className="text-sm font-medium mb-2">左侧安全区域</h3>
                        <div className="bg-neutral-200 dark:bg-neutral-700 h-20 rounded ps-safe flex items-center justify-center">
                            <span className="text-xs">ps-safe</span>
                        </div>
                    </div>

                    <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg">
                        <h3 className="text-sm font-medium mb-2">右侧安全区域</h3>
                        <div className="bg-neutral-200 dark:bg-neutral-700 h-20 rounded pe-safe flex items-center justify-center">
                            <span className="text-xs">pe-safe</span>
                        </div>
                    </div>
                </div>

                <Link
                    href="/"
                    className="inline-block bg-neutral-100 dark:bg-neutral-800 px-4 py-2 rounded-full text-sm"
                >
                    返回首页
                </Link>
            </div>

            {/* 底部安全区域测试 */}
            <div className="bg-green-500 text-white pb-safe">
                <div className="px-6 px-safe py-4">
                    <p className="text-sm opacity-80">这个区域应该在底部手势区域上方</p>
                    <h2 className="text-lg font-medium">底部安全区域测试</h2>
                </div>
            </div>
        </div>
    )
} 