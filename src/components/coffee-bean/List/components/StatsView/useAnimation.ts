import { useState, useEffect } from 'react'
import { AnimationStyles } from './types'

export const useAnimation = (): { imagesLoaded: boolean; textLoaded: boolean; styles: AnimationStyles } => {
    const [imagesLoaded, setImagesLoaded] = useState(false)
    const [textLoaded, setTextLoaded] = useState(false)

    // 组件挂载后立即触发所有动画
    useEffect(() => {
        // 设置一个短暂延迟，让组件先完全渲染
        const timer = setTimeout(() => {
            setImagesLoaded(true)
            
            // 文字稍晚一点出现，让图片先展示
            const textTimer = setTimeout(() => {
                setTextLoaded(true)
            }, 200)
            
            return () => clearTimeout(textTimer)
        }, 200) // 适当增加初始延迟时间
        
        return () => clearTimeout(timer)
    }, [])

    // 平滑的动画过渡效果
    const titleAnimStyle = {
        opacity: textLoaded ? 1 : 0,
        filter: textLoaded ? 'blur(0)' : 'blur(5px)',
        transform: textLoaded ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.7s ease, filter 0.7s ease, transform 0.7s ease',
        transitionDelay: '150ms'
    }

    const usernameAnimStyle = {
        ...titleAnimStyle,
        transitionDelay: '250ms'
    }
    
    const infoAnimStyle = {
        ...titleAnimStyle,
        transitionDelay: '350ms'
    }
    
    const statsAnimStyle = (index: number) => ({
        opacity: textLoaded ? 1 : 0,
        filter: textLoaded ? 'blur(0)' : 'blur(5px)',
        transform: textLoaded ? 'translateY(0)' : 'translateY(15px)',
        transition: 'opacity 0.7s ease, filter 0.7s ease, transform 0.7s ease',
        transitionDelay: `${450 + index * 100}ms` // 增加基础延迟和间隔，使各部分动画更自然
    })

    return {
        imagesLoaded,
        textLoaded,
        styles: {
            titleAnimStyle,
            usernameAnimStyle,
            infoAnimStyle,
            statsAnimStyle
        }
    }
} 