'use client'

import { useEffect, useState } from 'react'

export default function ThemeProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [isDarkMode, setIsDarkMode] = useState(false)

    useEffect(() => {
        // Check initial dark mode
        const darkModeMediaQuery = window.matchMedia(
            '(prefers-color-scheme: dark)'
        )
        setIsDarkMode(darkModeMediaQuery.matches)

        // Listen for changes
        const handleChange = (e: MediaQueryListEvent) => {
            setIsDarkMode(e.matches)
        }

        darkModeMediaQuery.addEventListener('change', handleChange)
        return () =>
            darkModeMediaQuery.removeEventListener('change', handleChange)
    }, [])

    return (
        <>
            <meta
                name="theme-color"
                content={isDarkMode ? '#171717' : '#ffffff'}
            />
            <meta
                name="apple-mobile-web-app-status-bar-style"
                content={isDarkMode ? 'black' : 'default'}
            />
            {children}
        </>
    )
}
