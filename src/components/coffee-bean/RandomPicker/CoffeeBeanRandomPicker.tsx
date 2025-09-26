'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import Image from 'next/image'
import { CoffeeBean } from '@/types/app'
import { RandomCoffeeBeanSelector, getRandomCoffeeBeanSettings } from '@/lib/utils/randomCoffeeBeanUtils'

interface CoffeeBeanRandomPickerProps {
  beans: CoffeeBean[]
  isOpen: boolean
  onClose: () => void
  onSelect: (bean: CoffeeBean) => void
  isLongPress?: boolean // 是否为长按触发的随机选择
}



const CoffeeBeanRandomPicker: React.FC<CoffeeBeanRandomPickerProps> = ({
  beans,
  isOpen,
  onClose,
  onSelect,
  isLongPress = false
}) => {
  // 动画状态
  const [animationState, setAnimationState] = useState<'initial' | 'selecting' | 'selected'>('initial')
  // 当前选中的豆子
  const [selectedBean, setSelectedBean] = useState<CoffeeBean | null>(null)
  // 卡片容器控制器
  const controls = useAnimation()
  // 选中的豆子索引
  const [_selectedIndex, setSelectedIndex] = useState<number>(0)
  // 容器引用
  const containerRef = useRef<HTMLDivElement>(null)
  // 卡片引用，用于动态获取实际尺寸
  const cardRef = useRef<HTMLDivElement>(null)
  // 动态获取的卡片尺寸
  const [cardDimensions, setCardDimensions] = useState({
    width: 160,
    margin: 12,
    totalWidth: 172
  })
  // 卡片尺寸是否已初始化
  const [cardDimensionsReady, setCardDimensionsReady] = useState(false)
  // 随机咖啡豆设置
  const [randomSettings, setRandomSettings] = useState<Awaited<ReturnType<typeof getRandomCoffeeBeanSettings>>>(undefined)

  // 动画过渡参数
  const springTransition = { stiffness: 500, damping: 25 }

  // 获取随机咖啡豆设置
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getRandomCoffeeBeanSettings()
      setRandomSettings(settings)
    }
    
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  // 使用memoized的选择器实例
  const selector = useMemo(() => new RandomCoffeeBeanSelector(randomSettings), [randomSettings])
  
  // 按类型分离咖啡豆
  const espressoBeans = useMemo(() => beans.filter(bean => bean.beanType === 'espresso'), [beans])
  const filterBeans = useMemo(() => beans.filter(bean => bean.beanType === 'filter'), [beans])
  
  // 根据是否长按决定咖啡豆类型，然后过滤
  const { beanType: targetBeanType } = randomSettings?.enableLongPressRandomType 
    ? selector.selectRandomBeanByPressType(espressoBeans, filterBeans, isLongPress)
    : { beanType: undefined }

  // 获取有效的豆子列表（使用我们的新工具函数进行过滤）
  const validBeans = useMemo(() => {
    return targetBeanType === 'espresso' 
      ? selector.filterAvailableBeans(espressoBeans, targetBeanType)
      : targetBeanType === 'filter'
      ? selector.filterAvailableBeans(filterBeans, targetBeanType)
      : [...selector.filterAvailableBeans(espressoBeans), ...selector.filterAvailableBeans(filterBeans)]
  }, [selector, espressoBeans, filterBeans, targetBeanType])

  // 检查是否只有一款咖啡豆
  const isSingleBean = validBeans.length === 1

  // 重置组件状态
  const resetState = useCallback(() => {
    setAnimationState('initial')
    setSelectedBean(null)
    setCardDimensionsReady(false)
    controls.set({ x: 0 })
  }, [controls])

  // 动态获取卡片尺寸
  useEffect(() => {
    const updateCardDimensions = () => {
      if (cardRef.current && cardRef.current.nextElementSibling) {
        const rect = cardRef.current.getBoundingClientRect()
        const nextRect = (cardRef.current.nextElementSibling as HTMLElement).getBoundingClientRect()

        // 计算实际的卡片间距
        const actualMargin = nextRect.left - rect.right

        setCardDimensions({
          width: rect.width,
          margin: actualMargin,
          totalWidth: rect.width + actualMargin
        })
        setCardDimensionsReady(true)

        console.warn('Card dimensions updated:', {
          width: rect.width,
          margin: actualMargin,
          totalWidth: rect.width + actualMargin
        })
      }
    }

    // 初始化时获取尺寸
    if (isOpen) {
      // 延迟一帧确保DOM已渲染
      requestAnimationFrame(updateCardDimensions)
    }

    // 监听字体缩放变化
    const handleFontZoomChange = () => {
      requestAnimationFrame(() => {
        updateCardDimensions()
        // 如果当前正在显示动画，重新开始
        if (isOpen && animationState === 'selecting' && !isSingleBean) {
          setTimeout(() => {
            resetState()
          }, 50)
        }
      })
    }

    window.addEventListener('fontZoomChange', handleFontZoomChange)
    window.addEventListener('resize', updateCardDimensions)

    return () => {
      window.removeEventListener('fontZoomChange', handleFontZoomChange)
      window.removeEventListener('resize', updateCardDimensions)
    }
  }, [isOpen, animationState, isSingleBean, resetState])

  // 当isOpen变化时重置状态
  useEffect(() => {
    if (isOpen) {
      resetState()
    }
  }, [isOpen, resetState])

  // 开始随机选择动画
  const startRandomSelection = useCallback(async () => {
    if (validBeans.length === 0 || !containerRef.current) return

    setAnimationState('selecting')

    try {
      // 获取容器宽度以计算中心位置
      const containerWidth = containerRef.current.clientWidth

      // 使用我们的工具函数随机选择一个豆子
      if (validBeans.length === 0) return
      
      const randomIndex = Math.floor(Math.random() * validBeans.length)
      const randomBean = validBeans[randomIndex]

      // 计算初始位置和最终位置
      const initialX = (containerWidth - cardDimensions.width) / 2 // 让第一个卡片在中心

      // 简化动画算法：直接计算最终位置
      // 让动画滚动足够多的卡片来营造旋转效果，最终停在选中的卡片
      const totalScrollDistance = (validBeans.length * 3 + randomIndex) * cardDimensions.totalWidth

      console.warn('Animation calculation:', {
        containerWidth,
        cardWidth: cardDimensions.width,
        cardMargin: cardDimensions.margin,
        cardTotalWidth: cardDimensions.totalWidth,
        randomIndex,
        initialX,
        totalScrollDistance,
        finalX: initialX - totalScrollDistance
      })

      // 设置初始位置并直接执行动画
      controls.set({ x: initialX })

      // 使用更优化的动画设置
      await controls.start({
        x: initialX - totalScrollDistance,
        transition: {
          duration: 3.6, // 稍微缩短动画时间
          ease: [0.2, 0.4, 0.2, 0.98], // 更简单的缓动函数
          type: "tween" // 使用tween而不是spring可能更流畅
        }
      })

      // 动画完成后设置状态
      setSelectedBean(randomBean)
      setSelectedIndex(randomIndex)
      setAnimationState('selected')
    } catch (error) {
      console.error("Animation error:", error)
      // 错误恢复
      setAnimationState('initial')
    }

  }, [validBeans, controls, cardDimensions.width, cardDimensions.totalWidth, cardDimensions.margin])

  // 重新选择
  const handleReshuffle = useCallback(() => {
    resetState()
    startRandomSelection()
  }, [resetState, startRandomSelection])

  // 确认选择当前豆子
  const handleConfirm = useCallback(() => {
    if (selectedBean) {
      onSelect(selectedBean)
      onClose()
    }
  }, [selectedBean, onSelect, onClose])



  // 容器变体
  const containerVariants = {
    open: {
      opacity: 1,
      transition: { duration: 0.3 }
    },
    closed: {
      opacity: 0,
      transition: { duration: 0.3 }
    }
  }

  // 自动开始动画或直接选择
  useEffect(() => {
    if (isOpen && animationState === 'initial' && validBeans.length > 0) {
      if (isSingleBean) {
        // 只有一款咖啡豆时直接选中，不需要等待卡片尺寸
        setSelectedBean(validBeans[0])
        setAnimationState('selected')
      } else if (cardDimensionsReady) {
        // 多款咖啡豆时需要等待卡片尺寸后开始滚动动画
        startRandomSelection()
      }
    }
  }, [isOpen, animationState, validBeans.length, isSingleBean, validBeans, startRandomSelection, cardDimensionsReady])

  // 为动画准备数据 - 单豆时只显示一个，多豆时创建足够长的序列用于滚动动画
  const displayBeans = isSingleBean 
    ? validBeans 
    : [...validBeans, ...validBeans, ...validBeans, ...validBeans, ...validBeans]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xs pt-safe-top"
          initial="closed"
          animate="open"
          exit="closed"
          variants={containerVariants}
        >
          {/* 根据咖啡豆数量显示不同内容 */}
          {validBeans.length === 0 ? (
            // 空状态
            <div className="relative flex flex-col items-center justify-center w-full h-full p-6">
              <div className="text-center">
                <div className="text-6xl mb-4">☕</div>
                <h2 className="text-xl font-medium text-neutral-800 dark:text-neutral-100 mb-2">
                  暂无可选咖啡豆
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  请先添加咖啡豆或检查筛选条件
                </p>
              </div>
            </div>
          ) : (
            // 统一的选择界面
            <div className="relative flex flex-col items-center justify-center w-full h-full p-6">
              {/* 中间指示器和卡片容器 */}
              <div className="relative w-full " ref={containerRef}>
                {/* 中间指示器 - 永远在中间 */}
                {!isSingleBean && (
                  <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-neutral-800 dark:border-neutral-100 rounded-lg z-10 pointer-events-none"
                    style={{
                      width: `${cardDimensions.width}px`,
                      height: '132px' // 高度保持固定，因为它不受字体缩放影响
                    }}
                  ></div>
                )}

                {/* 创建渐变遮罩效果 - 只在多豆时显示 */}
                {!isSingleBean && (
                  <div className="absolute inset-0 bg-linear-to-r from-white/95 via-transparent to-white/95 dark:from-neutral-900/95 dark:via-transparent dark:to-neutral-900/95 z-20 pointer-events-none"></div>
                )}

                {/* 横向卡片容器 */}
                <div className="relative w-full h-[132px] overflow-hidden">
                  <motion.div
                    className={`flex space-x-3 ${isSingleBean ? 'justify-center' : 'absolute'}`}
                    animate={controls}
                    style={{ willChange: "transform" }} // 性能优化
                  >
                    {displayBeans.map((bean, index) => (
                      <div
                        key={`${bean.id}-${index}`}
                        ref={index === 0 ? cardRef : null}
                        className={`w-[160px] h-[132px] shrink-0 flex flex-col items-center justify-center p-3 rounded-lg bg-white dark:bg-neutral-800 border-2 ${
                          isSingleBean && animationState === 'selected'
                            ? 'border-neutral-800 dark:border-neutral-100'
                            : 'border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        {bean.image ? (
                          <div className="w-full h-16 relative mb-2">
                            <Image
                              src={bean.image}
                              alt={bean.name}
                              fill
                              className="object-contain"
                              sizes="(max-width: 768px) 100vw, 160px"
                              loading="eager"
                              priority={index < 10} // 只对前几张图片设置优先加载
                            />
                          </div>
                        ) : (
                          <div className="w-full h-16 flex items-center justify-center mb-2">
                            <span className="text-2xl">☕</span>
                          </div>
                        )}
                        <div className="text-center w-full">
                          <h3 className="text-sm font-medium">{bean.name}</h3>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </div>
              </div>

              {/* 底部按钮 - 使用固定高度避免布局抖动 */}
              <div className="mt-12 flex items-center justify-center gap-4 h-[56px]">
                <AnimatePresence>
                  {animationState === 'selected' && (
                    <>
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={springTransition}
                        className="px-8 py-3 rounded-full bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900"
                        onClick={handleConfirm}
                      >
                        使用
                      </motion.button>

                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={springTransition}
                        className="px-8 py-3 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
                        onClick={isSingleBean ? onClose : handleReshuffle}
                      >
                        {isSingleBean ? '取消' : '重选'}
                      </motion.button>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* 关闭按钮 */}
          <motion.button
            className="absolute top-[calc(env(safe-area-inset-top)+36px)] right-6 p-2 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default CoffeeBeanRandomPicker