'use client'

import React, { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BrewingNote } from '@/lib/config'
import { formatDate } from '../utils'
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { useToast } from '@/components/GlobalToast'

interface NoteShareModalProps {
  isOpen: boolean
  onClose: () => void
  note: BrewingNote
  equipmentName: string
}

// 拖动组件属性
interface DraggableProps {
  children: React.ReactNode
  initialPosition?: { x: number; y: number }
  boundaryRef: React.RefObject<HTMLDivElement>
  onPositionChange?: (position: { x: number; y: number }) => void
  style?: React.CSSProperties
  className?: string
}

// 可拖动组件
const Draggable: React.FC<DraggableProps> = ({
  children,
  initialPosition = { x: 0, y: 0 },
  boundaryRef,
  onPositionChange,
  style,
  className
}) => {
  const [position, setPosition] = useState(initialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const nodeRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true)
    
    if ('clientX' in e) {
      // 鼠标事件
      dragStartRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      }
    } else {
      // 触摸事件
      const touch = e.touches[0]
      dragStartRef.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      }
    }
  }

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return
    
    let clientX, clientY
    
    if (e instanceof MouseEvent) {
      clientX = e.clientX
      clientY = e.clientY
    } else {
      const touch = e.touches[0]
      clientX = touch.clientX
      clientY = touch.clientY
    }
    
    // 计算新位置
    const newX = clientX - dragStartRef.current.x
    const newY = clientY - dragStartRef.current.y
    
    // 边界检查
    if (boundaryRef.current && nodeRef.current) {
      const boundary = boundaryRef.current.getBoundingClientRect()
      const node = nodeRef.current.getBoundingClientRect()
      
      // 确保不超出边界
      const constrainedX = Math.max(0, Math.min(newX, boundary.width - node.width))
      const constrainedY = Math.max(0, Math.min(newY, boundary.height - node.height))
      
      setPosition({ x: constrainedX, y: constrainedY })
      if (onPositionChange) {
        onPositionChange({ x: constrainedX, y: constrainedY })
      }
    } else {
      setPosition({ x: newX, y: newY })
      if (onPositionChange) {
        onPositionChange({ x: newX, y: newY })
      }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('touchmove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchend', handleMouseUp)
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchend', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div
      ref={nodeRef}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
        ...style
      }}
      className={className}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
    >
      {children}
    </div>
  )
}

// 笔记卡片组件
const NoteCard: React.FC<{ note: BrewingNote; equipmentName: string }> = ({ note, equipmentName }) => {
  return (
    <div className="bg-white dark:bg-neutral-800 p-4  w-[250px]">
      <div className="flex flex-col space-y-2">
        {/* 标题 */}
        <div className="text-[11px] font-medium text-neutral-800 dark:text-neutral-100">
          {note.coffeeBeanInfo?.name || '未命名咖啡豆'}
          <span className="text-neutral-600 dark:text-neutral-400 mx-1">·</span>
          <span className="text-neutral-600 dark:text-neutral-400">{note.method}</span>
        </div>
        
        {/* 设备和参数 */}
        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400 space-x-1">
          <span>{equipmentName}</span>
          <span>·</span>
          {note.params && (
            <>
              <span>{note.params.coffee}</span>
              <span>·</span>
              <span>{note.params.ratio}</span>
              {(note.params.grindSize || note.params.temp) && (
                <>
                  <span>·</span>
                  {note.params.grindSize && note.params.temp ? (
                    <span>{note.params.grindSize} · {note.params.temp}</span>
                  ) : (
                    <span>{note.params.grindSize || note.params.temp}</span>
                  )}
                </>
              )}
            </>
          )}
        </div>
        
        {/* 评分 */}
        {note.rating > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                总体评分
              </div>
              <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                {note.rating}
              </div>
            </div>
            <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
              <div
                style={{ width: `${note.rating === 0 ? 0 : (note.rating / 5) * 100}%` }}
                className="h-full bg-neutral-800 dark:bg-neutral-100"
              />
            </div>
          </div>
        )}
        
        {/* 日期 */}
        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
          {formatDate(note.timestamp)}
        </div>
        
        {/* 笔记内容 */}
        {note.notes && (
          <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
            {note.notes}
          </div>
        )}
      </div>
    </div>
  )
}

const NoteShareModal: React.FC<NoteShareModalProps> = ({
  isOpen,
  onClose,
  note,
  equipmentName
}) => {
  const [photo, setPhoto] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [finalImage, setFinalImage] = useState<string | null>(null)
  const photoContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isNative = Capacitor.isNativePlatform()
  const { showToast } = useToast()

  // 清理状态
  const resetState = () => {
    setPhoto(null)
    setFinalImage(null)
    setIsProcessing(false)
  }

  // 处理关闭模态框
  const handleClose = () => {
    resetState()
    onClose()
  }

  // 拍照
  const handleTakePhoto = async () => {
    try {
      if (isNative) {
        // 原生平台使用Camera API
        const image = await Camera.getPhoto({
          quality: 100, // 提高质量
          allowEditing: false, // 不允许编辑，保持原图
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera
          // 注意：preserveAspectRatio 不是支持的选项
        })
        
        // 获取照片 URL
        if (image.webPath) {
          setPhoto(image.webPath)
        }
      } else {
        // Web平台使用文件输入
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.capture = 'environment'
        
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = () => {
              setPhoto(reader.result as string)
            }
            reader.readAsDataURL(file)
          }
        }
        
        input.click()
      }
    } catch (error) {
      console.error('拍照时出错:', error)
      showToast({
        type: 'error',
        title: '拍照失败，请重试',
        duration: 2000
      })
    }
  }

  // 生成最终图片
  const generateFinalImage = async () => {
    if (!photo || !photoContainerRef.current) return
    
    setIsProcessing(true)
    
    try {
      // 创建一个 HTML2Canvas 类型的引用
      const html2canvas = (await import('html2canvas')).default
      
      // 生成图片，保留原始分辨率和比例
      const canvas = await html2canvas(photoContainerRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: window.devicePixelRatio || 2, // 使用设备像素比例
        backgroundColor: null, // 透明背景
        logging: false, // 禁用日志
        imageTimeout: 0, // 不超时，等待图片完全加载
        onclone: (clonedDoc) => {
          // 确保克隆的文档中的图片加载完成
          const clonedContainer = clonedDoc.querySelector('[data-photo-container]');
          if (clonedContainer) {
            const img = clonedContainer.querySelector('img');
            if (img) {
              img.crossOrigin = 'anonymous';
            }
          }
        }
      })
      
      // 转换为 dataURL，保持高质量
      const dataUrl = canvas.toDataURL('image/jpeg', 1.0)
      setFinalImage(dataUrl)
      
      // 保存引用，用于分享
      if (canvasRef.current) {
        canvasRef.current.width = canvas.width
        canvasRef.current.height = canvas.height
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          ctx.drawImage(canvas, 0, 0)
        }
      }
    } catch (error) {
      console.error('生成图片时出错:', error)
      showToast({
        type: 'error',
        title: '生成图片失败，请重试',
        duration: 2000
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // 保存或分享最终图片
  const handleShareImage = async () => {
    if (!finalImage) return
    
    setIsProcessing(true)
    
    try {
      if (isNative) {
        // 原生平台：保存到文件并分享
        const fileName = `brew-guide-note-${Date.now()}.jpg`
        const base64Data = finalImage.split(',')[1]
        
        // 写入文件，保持高质量
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        })
        
        // 获取文件 URI
        const uriResult = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache
        })
        
        // 分享
        await Share.share({
          title: '我的咖啡笔记',
          text: '分享我的咖啡冲煮笔记',
          url: uriResult.uri,
          dialogTitle: '分享咖啡笔记'
        })
        
        // 清理临时文件
        await Filesystem.deleteFile({
          path: fileName,
          directory: Directory.Cache
        })
      } else {
        // Web平台：下载图片
        const link = document.createElement('a')
        link.href = finalImage
        link.download = `brew-guide-note-${Date.now()}.jpg`
        link.click()
      }
      
      showToast({
        type: 'success',
        title: '图片已保存',
        duration: 2000
      })
      
      // 完成后关闭模态框
      setTimeout(handleClose, 1000)
    } catch (error) {
      console.error('分享图片时出错:', error)
      showToast({
        type: 'error',
        title: '保存图片失败，请重试',
        duration: 2000
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.265 }}
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose()
            }
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'tween',
              ease: [0.33, 1, 0.68, 1], // easeOutCubic
              duration: 0.265
            }}
            style={{
              willChange: 'transform'
            }}
            className="absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[85vh] overflow-auto rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl pb-safe-bottom"
          >
            {/* 拖动条 */}
            <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
              <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>

            {/* 内容区域 */}
            <div className="px-6">
              {/* 标题栏 */}
              <div className="flex items-center justify-between py-4 mb-2">
                <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                  分享笔记
                </h3>
                <button
                  onClick={handleClose}
                  className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* 显示照片或引导用户拍照 */}
              {!photo && !finalImage && (
                <div className="space-y-6 pb-4">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    拍一张照片，为你的咖啡笔记添加个性化背景
                  </div>
                  
                  <button
                    onClick={handleTakePhoto}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-4 rounded-lg transition-colors bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 hover:opacity-80"
                  >
                    拍照
                  </button>
                </div>
              )}

              {/* 显示照片和笔记卡片，允许拖动调整 */}
              {photo && !finalImage && (
                <div className="space-y-6 pb-4">
                  <div 
                    ref={photoContainerRef} 
                    className="relative w-full overflow-hidden rounded-lg bg-black"
                    data-photo-container
                  >
                    {/* 背景照片 - 保持原始宽高比 */}
                    <img
                      src={photo}
                      alt="背景照片"
                      className="w-full h-auto object-contain"
                      crossOrigin="anonymous"
                    />
                    
                    {/* 可拖动的笔记卡片 */}
                    <Draggable boundaryRef={photoContainerRef} initialPosition={{ x: 20, y: 20 }}>
                      <NoteCard note={note} equipmentName={equipmentName} />
                    </Draggable>
                  </div>
                  
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                    提示：拖动卡片调整位置
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setPhoto(null)}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 px-4 rounded-lg transition-colors bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 hover:opacity-80"
                    >
                      重新拍照
                    </button>
                    <button
                      onClick={generateFinalImage}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 px-4 rounded-lg transition-colors bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 hover:opacity-80"
                    >
                      {isProcessing ? '生成中...' : '生成图片'}
                    </button>
                  </div>
                </div>
              )}

              {/* 显示最终生成的图片 */}
              {finalImage && (
                <div className="space-y-6 pb-4">
                  <div className="w-full overflow-hidden rounded-lg">
                    <img
                      src={finalImage}
                      alt="最终图片"
                      className="w-full h-auto"
                    />
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={resetState}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 px-4 rounded-lg transition-colors bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 hover:opacity-80"
                    >
                      重新编辑
                    </button>
                    <button
                      onClick={handleShareImage}
                      disabled={isProcessing}
                      className="flex-1 py-2.5 px-4 rounded-lg transition-colors bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 hover:opacity-80"
                    >
                      {isProcessing ? '保存中...' : '保存图片'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* 隐藏的 canvas 用于导出图片 */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default NoteShareModal 