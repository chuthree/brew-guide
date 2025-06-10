import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center px-6 py-4">
            <h2 className="text-xl font-light tracking-wide">页面未找到</h2>
            <p className="mt-4 text-sm text-neutral-500">无法找到请求的页面</p>
            <Link
                href="/"
                className="mt-8 rounded-full bg-neutral-100 px-4 py-2 text-sm text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
            >
                返回首页
            </Link>
        </div>
    )
}