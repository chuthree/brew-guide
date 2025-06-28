'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import Image from 'next/image'
import { CoffeeBean } from '@/types/app'

interface CoffeeBeanRandomPickerProps {
  beans: CoffeeBean[]
  isOpen: boolean
  onClose: () => void
  onSelect: (bean: CoffeeBean) => void
}

// 刮刮卡组件
const ScratchCard: React.FC<{
  bean: CoffeeBean
  onReveal: () => void
  onConfirm: () => void
  onClose: () => void
}> = ({ bean, onReveal, onConfirm, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isRevealed, setIsRevealed] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [revealPercentage, setRevealPercentage] = useState(0)
  const [isCanvasVisible, setIsCanvasVisible] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // 设置画布尺寸
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // 绘制简洁的刮刮卡表面
    ctx.fillStyle = '#9ca3af'
    ctx.fillRect(0, 0, rect.width, rect.height)

    // 设置混合模式为擦除
    ctx.globalCompositeOperation = 'destination-out'
  }, [])

  const lastPositionRef = useRef<{ x: number; y: number } | null>(null)

  const scratch = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const currentX = (x - rect.left) * scaleX / window.devicePixelRatio
    const currentY = (y - rect.top) * scaleY / window.devicePixelRatio

    // 如果有上一个位置，绘制连接线让刮擦更丝滑
    if (lastPositionRef.current) {
      ctx.lineWidth = 40
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(lastPositionRef.current.x, lastPositionRef.current.y)
      ctx.lineTo(currentX, currentY)
      ctx.stroke()
    } else {
      // 第一次点击，绘制圆形
      ctx.beginPath()
      ctx.arc(currentX, currentY, 20, 0, 2 * Math.PI)
      ctx.fill()
    }

    lastPositionRef.current = { x: currentX, y: currentY }

    // 每隔几次刮擦才检查一次百分比，提高性能
    if (Math.random() < 0.3) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data
      let transparentPixels = 0

      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) transparentPixels++
      }

      const percentage = (transparentPixels / (pixels.length / 4)) * 100
      setRevealPercentage(percentage)

      if (percentage > 25 && !isRevealed) {
        setIsRevealed(true)
        onReveal()
        // 刮开足够多时，使用动画清除刮刮层
        setTimeout(() => {
          setIsCanvasVisible(false)
        }, 500)
      }
    }
  }, [isRevealed, onReveal])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDrawing(true)
    lastPositionRef.current = null // 重置位置
    scratch(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDrawing) {
      scratch(e.clientX, e.clientY)
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
    lastPositionRef.current = null // 重置位置
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    setIsDrawing(true)
    lastPositionRef.current = null // 重置位置
    const touch = e.touches[0]
    scratch(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (isDrawing) {
      const touch = e.touches[0]
      scratch(touch.clientX, touch.clientY)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    setIsDrawing(false)
    lastPositionRef.current = null // 重置位置
  }

  const springTransition = { type: "spring", stiffness: 500, damping: 25 }

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full p-6">
      {/* 刮刮卡区域 */}
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-6">
          <h2 className="text-xl font-medium text-neutral-800 dark:text-neutral-100 mb-2">
            发现隐藏的咖啡豆
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            刮开表面看看是什么豆子
          </p>
        </div>

        {/* 卡片容器 - 固定高度防止布局变形 */}
        <div className="relative w-full h-64 rounded-lg overflow-hidden bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700">
          {/* 底层内容 - 咖啡豆信息 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            {bean.image ? (
              <div className="w-20 h-20 relative mb-4">
                <Image
                  src={bean.image}
                  alt={bean.name}
                  fill
                  className="object-contain"
                  sizes="80px"
                />
              </div>
            ) : (
              <div className="w-20 h-20 flex items-center justify-center mb-4">
                <span className="text-4xl">☕</span>
              </div>
            )}
            <h3 className="text-lg font-medium text-center text-neutral-800 dark:text-neutral-100">
              {bean.name}
            </h3>
            {bean.origin && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                {bean.origin}
              </p>
            )}
          </div>

          {/* 刮刮层 - 使用动画控制显示/隐藏 */}
          <motion.canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-pointer touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: 'none' }}
            animate={{
              opacity: isCanvasVisible ? 1 : 0,
            }}
            transition={{
              duration: 0.3,
              ease: [0.4, 0.0, 0.2, 1]
            }}
          />
        </div>

        {/* 固定高度的提示区域防止布局变形 */}
        <div className="mt-4 h-6 flex items-center justify-center">
          {revealPercentage > 10 && revealPercentage < 25 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-sm text-neutral-600 dark:text-neutral-400"
            >
              继续刮开...
            </motion.div>
          )}
        </div>
      </div>

      {/* 底部按钮 - 固定高度防止布局变形 */}
      <div className="mt-8 h-12 flex items-center justify-center gap-4">
        <AnimatePresence>
          {isRevealed && (
            <>
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: 0.2, ...springTransition }}
                className="px-8 py-3 rounded-full bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900"
                onClick={onConfirm}
              >
                使用
              </motion.button>

              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: 0.3, ...springTransition }}
                className="px-8 py-3 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
                onClick={onClose}
              >
                取消
              </motion.button>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

const CoffeeBeanRandomPicker: React.FC<CoffeeBeanRandomPickerProps> = ({
  beans,
  isOpen,
  onClose,
  onSelect
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
  // 刮刮卡状态
  const [showScratchCard, setShowScratchCard] = useState(false)
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

  // 动画过渡参数
  const springTransition = { type: "spring", stiffness: 500, damping: 25 }

  // 获取有效的豆子列表（过滤掉无效或为空的豆子，以及在途状态的豆子）
  const validBeans = beans.filter(bean => {
    // 基础验证
    if (!bean || !bean.id) return false;

    // 过滤掉在途状态的咖啡豆
    if (bean.isInTransit) return false;

    // 如果没有设置容量，则显示（因为无法判断是否用完）
    if (!bean.capacity || bean.capacity === '0' || bean.capacity === '0g') {
      return true;
    }

    // 如果设置了容量，则检查剩余量是否大于0
    const remaining = parseFloat(bean.remaining || '0');
    return remaining > 0;
  })

  // 检查是否只有一款咖啡豆
  const isSingleBean = validBeans.length === 1

  // 重置组件状态
  const resetState = useCallback(() => {
    setAnimationState('initial')
    setSelectedBean(null)
    setShowScratchCard(false)
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

      // 随机选择一个豆子
      const randomIndex = Math.floor(Math.random() * validBeans.length)

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
      setSelectedBean(validBeans[randomIndex])
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

  // 刮刮卡揭示处理
  const handleScratchReveal = useCallback(() => {
    // 刮开后的处理逻辑，可以添加触感反馈等
  }, [])

  // 刮刮卡确认处理
  const handleScratchConfirm = useCallback(() => {
    if (selectedBean) {
      onSelect(selectedBean)
      onClose()
    }
  }, [selectedBean, onSelect, onClose])

  // 刮刮卡取消处理
  const handleScratchCancel = useCallback(() => {
    onClose()
  }, [onClose])

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

  // 自动开始动画或显示刮刮卡
  useEffect(() => {
    if (isOpen && animationState === 'initial' && validBeans.length > 0 && cardDimensionsReady) {
      if (isSingleBean) {
        // 只有一款咖啡豆时显示刮刮卡
        setSelectedBean(validBeans[0])
        setShowScratchCard(true)
      } else {
        // 多款咖啡豆时开始滚动动画
        startRandomSelection()
      }
    }
  }, [isOpen, animationState, validBeans.length, isSingleBean, validBeans, startRandomSelection, cardDimensionsReady])

  // 为动画准备数据 - 创建足够长的序列
  // 优化：减少渲染的卡片数量以提高性能
  const displayBeans = [...validBeans, ...validBeans, ...validBeans, ...validBeans, ...validBeans]

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
          {/* 根据是否为单个咖啡豆显示不同内容 */}
          {showScratchCard && selectedBean ? (
            <ScratchCard
              bean={selectedBean}
              onReveal={handleScratchReveal}
              onConfirm={handleScratchConfirm}
              onClose={handleScratchCancel}
            />
          ) : (
            <div className="relative flex flex-col items-center justify-center w-full h-full p-6">
              {/* 中间指示器和卡片容器 */}
              <div className="relative w-full max-w-md" ref={containerRef}>
                {/* 中间指示器 - 永远在中间 */}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-neutral-800 dark:border-neutral-100 rounded-lg z-10 pointer-events-none"
                  style={{
                    width: `${cardDimensions.width}px`,
                    height: '132px' // 高度保持固定，因为它不受字体缩放影响
                  }}
                ></div>

                {/* 创建渐变遮罩效果 */}
                <div className="absolute inset-0 bg-linear-to-r from-white/95 via-transparent to-white/95 dark:from-neutral-900/95 dark:via-transparent dark:to-neutral-900/95 z-20 pointer-events-none"></div>

                {/* 横向卡片容器 */}
                <div className="relative w-full h-[132px] overflow-hidden">
                  <motion.div
                    className="flex space-x-3 absolute"
                    animate={controls}
                    style={{ willChange: "transform" }} // 性能优化
                  >
                    {displayBeans.map((bean, index) => (
                      <div
                        key={`${bean.id}-${index}`}
                        ref={index === 0 ? cardRef : null}
                        className="w-[160px] h-[132px] shrink-0 flex flex-col items-center justify-center p-3 rounded-lg bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700"
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
                        transition={{ delay: 0.2, ...springTransition }}
                        className="px-8 py-3 rounded-full bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900"
                        onClick={handleConfirm}
                      >
                        使用
                      </motion.button>

                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: 0.3, ...springTransition }}
                        className="px-8 py-3 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
                        onClick={handleReshuffle}
                      >
                        重选
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