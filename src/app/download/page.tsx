import React from 'react'

export default function DownloadPage(): React.ReactElement {
    return (
        <div className="flex min-h-screen w-full items-center justify-center">
            <div className="max-w-md p-6 text-center">
                <h1 className="text-2xl font-bold mb-6">Brew Guide 下载</h1>
                <div className="space-y-4">
                    <a 
                        href="https://www.123912.com/s/prGKTd-HpJWA" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        🔗 国内下载
                    </a>
                    <a 
                        href="https://github.com/chu3/brew-guide/releases" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                        🔗 GitHub 下载
                    </a>
                </div>
                <p className="text-sm text-gray-500 mt-6">
                    Brew Guide - 一站式管理器具、方案、咖啡豆以及笔记的小工具
                </p>
            </div>
        </div>
    )
}
