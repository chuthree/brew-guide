'use client'

import { NextIntlClientProvider } from 'next-intl'
import { ReactNode, useEffect, useState } from 'react'
import { Storage } from '@/lib/core/storage'

// 导入翻译文件
import zhMessages from '@/locales/zh/common.json'
import enMessages from '@/locales/en/common.json'

const messages = {
    zh: zhMessages,
    en: enMessages,
}

// 创建自定义事件名称
export const LANGUAGE_CHANGE_EVENT = 'languageChange'

// 创建触发语言变化的函数
export function notifyLanguageChange() {
    // 创建并分发自定义事件
    const event = new CustomEvent(LANGUAGE_CHANGE_EVENT)
    window.dispatchEvent(event)
}

export function TranslationsProvider({
    children,
}: {
    children: ReactNode
}) {
    const [locale, setLocale] = useState<string>('zh')

    useEffect(() => {
        // 从本地存储加载语言设置
        const loadLanguage = async () => {
            try {
                const settings = await Storage.get('brewGuideSettings')
                if (settings) {
                    const parsedSettings = JSON.parse(settings)
                    setLocale(parsedSettings.language || 'zh')
                }
            } catch (error) {
                console.error('Error loading language settings:', error)
            }
        }

        // 初始加载
        loadLanguage()

        // 监听自定义语言变化事件
        const handleLanguageChange = () => {
            loadLanguage()
        }

        window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange)
        
        // 同时保留 storage 事件监听，以支持多标签页同步
        window.addEventListener('storage', handleLanguageChange)

        return () => {
            window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange)
            window.removeEventListener('storage', handleLanguageChange)
        }
    }, [])

    return (
        <NextIntlClientProvider messages={messages[locale as keyof typeof messages]} locale={locale}>
            {children}
        </NextIntlClientProvider>
    )
} 