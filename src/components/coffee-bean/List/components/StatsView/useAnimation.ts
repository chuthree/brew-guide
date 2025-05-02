import { useState, useEffect } from 'react'
import { AnimationStyles } from './types'

export const useAnimation = (): { imagesLoaded: boolean; textLoaded: boolean; styles: AnimationStyles } => {
    const [imagesLoaded, setImagesLoaded] = useState(false)
    const [textLoaded, setTextLoaded] = useState(false)

    // 组件挂载后触发动画
    useEffect(() => {
        // 设置一个短暂延迟，让组件先完全渲染
        const timer = setTimeout(() => {
            setImagesLoaded(true)
            
            // 图片加载后再显示文字
            const textTimer = setTimeout(() => {
                setTextLoaded(true)
            }, 500)
            
            return () => clearTimeout(textTimer)
        }, 300)
        
        return () => clearTimeout(timer)
    }, [])

    // 文字元素的动画样式
    const titleAnimStyle = {
        opacity: textLoaded ? 1 : 0,
        filter: textLoaded ? 'blur(0)' : 'blur(5px)',
        transform: textLoaded ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.8s ease, filter 0.8s ease, transform 0.8s ease',
        transitionDelay: '100ms'
    }

    const usernameAnimStyle = {
        ...titleAnimStyle,
        transitionDelay: '300ms'
    }
    
    const infoAnimStyle = {
        ...titleAnimStyle,
        transitionDelay: '500ms'
    }
    
    const statsAnimStyle = (index: number) => ({
        opacity: textLoaded ? 1 : 0,
        filter: textLoaded ? 'blur(0)' : 'blur(5px)',
        transform: textLoaded ? 'translateY(0)' : 'translateY(15px)',
        transition: 'opacity 0.7s ease, filter 0.7s ease, transform 0.7s ease',
        transitionDelay: `${600 + index * 120}ms`
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