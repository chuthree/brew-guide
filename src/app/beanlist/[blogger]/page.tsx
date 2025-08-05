import React from 'react'
import { BloggerType } from '@/components/coffee-bean/List/types'
import BeanlistClientPage from './BeanlistClientPage'

// 有效的博主名称
const VALID_BLOGGERS: BloggerType[] = ['peter', 'fenix']

// 生成静态参数 - Next.js静态导出需要
export async function generateStaticParams() {
    return VALID_BLOGGERS.map((blogger) => ({
        blogger: blogger,
    }))
}

/**
 * 豆单页面组件 - 服务器组件
 * 支持通过URL访问特定博主的豆单，如 /beanlist/peter 或 /beanlist/fenix
 */
export default async function BeanlistPage({ params }: { params: Promise<{ blogger: string }> }) {
    const { blogger: bloggerParam } = await params

    // 检查博主参数是否有效
    const isValidBlogger = VALID_BLOGGERS.includes(bloggerParam as BloggerType)
    const blogger = isValidBlogger ? (bloggerParam as BloggerType) : 'peter'

    return (
        <BeanlistClientPage
            blogger={blogger}
            isValidBlogger={isValidBlogger}
            validBloggers={VALID_BLOGGERS}
        />
    )
}
