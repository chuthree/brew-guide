import { useState, useEffect } from 'react'
import { AnimationStyles } from './types'

export const useAnimation = (): { imagesLoaded: boolean; textLoaded: boolean; styles: AnimationStyles } => {
    const [imagesLoaded, setImagesLoaded] = useState(false)
    const [textLoaded, setTextLoaded] = useState(false)
    
    // 存储已计算的统计类别索引，用于自动分配动画顺序
    const [categoryIndices] = useState<Map<number, number>>(new Map())
    
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
    
    // 优化统计视图动画顺序的计算
    // 根据组的索引自动分配动画顺序，确保相似的内容组在相近的时间显示
    const statsAnimStyle = (groupIndex: number) => {
        // 检查该组索引是否已分配过动画顺序
        if (!categoryIndices.has(groupIndex)) {
            // 获取当前已分配的最大顺序值
            const maxIndex = categoryIndices.size > 0 
                ? Math.max(...Array.from(categoryIndices.values())) 
                : -1;
                
            // 为新的组分配下一个顺序值
            categoryIndices.set(groupIndex, maxIndex + 1);
        }
        
        // 获取该组对应的动画顺序
        const animationOrder = categoryIndices.get(groupIndex) || 0;
        
        // 基础延迟为450ms，每个组间隔100ms
        const delayTime = 450 + animationOrder * 100;
        
        return {
            opacity: textLoaded ? 1 : 0,
            filter: textLoaded ? 'blur(0)' : 'blur(5px)',
            transform: textLoaded ? 'translateY(0)' : 'translateY(15px)',
            transition: 'opacity 0.7s ease, filter 0.7s ease, transform 0.7s ease',
            transitionDelay: `${delayTime}ms` // 使用计算出的延迟时间
        };
    };

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