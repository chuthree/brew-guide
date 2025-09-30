"use client"

import React, { useRef, useEffect, useState, ReactNode, useCallback } from "react"
import { cn } from "@/lib/utils/classNameUtils"
import { AnimatePresence, motion } from "framer-motion"
import { MoreHorizontal } from "lucide-react"

export interface ActionMenuItem {
  id: string
  label: string
  onClick: () => void
  color?: "default" | "success" | "danger" | "warning" | "info"
  renderContent?: ReactNode
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  onClose?: () => void
  className?: string
  triggerClassName?: string
  triggerChildren?: ReactNode
  menuClassName?: string
  showAnimation?: boolean
  useMorphingAnimation?: boolean
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onStop?: (e: React.MouseEvent) => void
}

const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  onClose,
  className,
  triggerClassName,
  triggerChildren,
  menuClassName,
  showAnimation = false,
  useMorphingAnimation = false,
  isOpen,
  onOpenChange,
  onStop,
}) => {
  // 状态管理
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isOpen !== undefined ? isOpen : internalOpen
  
  // 引用管理
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const isMounted = useRef(true)

  // 组件挂载状态管理
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  // 安全的状态更新
  const setOpen = useCallback((value: boolean) => {
    if (!isMounted.current) return

    setInternalOpen(value)
    onOpenChange?.(value)

    if (!value) {
      onClose?.()
    }
  }, [onOpenChange, onClose])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!isMounted.current) return
      
      const target = event.target as Node
      const isInMenu = menuRef.current && menuRef.current.contains(target)
      const isOnTrigger = triggerRef.current && triggerRef.current.contains(target)
      
      // 检查是否点击了其他 ActionMenu 的触发按钮
      const isOtherActionMenuTrigger = (target as Element).closest?.('.action-menu-container') && 
                                        !menuRef.current?.contains(target)
      
      if (!isInMenu && !isOnTrigger) {
        // 如果点击了其他 ActionMenu，延迟关闭以允许新菜单打开
        if (isOtherActionMenuTrigger) {
          setTimeout(() => {
            if (isMounted.current) {
              setOpen(false)
            }
          }, 0)
        } else {
          setOpen(false)
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside, true)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true)
    }
  }, [open, setOpen])

  // 事件处理
  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation()
    onStop?.(e)
  }

  const handleTriggerClick = (e: React.MouseEvent) => {
    handleStop(e)
    setOpen(!open)
  }
  
  const handleItemClick = (e: React.MouseEvent, onClick: () => void) => {
    handleStop(e)
    onClick()
    setOpen(false)
  }

  // 样式生成函数
  const getColorClassName = (color: ActionMenuItem["color"]) => {
    const colorMap = {
      success: "text-emerald-600 dark:text-emerald-500",
      danger: "text-red-500 dark:text-red-400",
      warning: "text-amber-500 dark:text-amber-400",
      info: "text-blue-400 dark:text-blue-500",
      default: "text-neutral-600 dark:text-neutral-300"
    }
    return colorMap[color || "default"]
  }

  // 渲染触发器内容
  const renderTriggerContent = () => {
    return triggerChildren || <MoreHorizontal className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
  }

  // 渲染菜单内容
  const menuContent = (
    <div className="py-1">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={(e) => handleItemClick(e, item.onClick)}
          className={cn(
            "w-full px-3 py-1.5 text-left text-xs font-medium relative",
            getColorClassName(item.color)
          )}
        >
          {item.renderContent || item.label}
        </button>
      ))}
    </div>
  )

  // 变形动画渲染
  if (useMorphingAnimation) {
    return (
      <div className={cn("relative action-menu-container", className)} ref={menuRef}>
        <motion.div
          onClick={handleStop}
          className={cn(
            "flex items-center justify-center overflow-hidden relative h-8",
            triggerClassName
          )}
          initial={false}
          animate={{
            width: open ? "auto" : "2rem",
            borderRadius: "1rem",
          }}
          transition={{
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          {/* 圆形按钮 - 展开时淡出 */}
          <motion.button
            ref={triggerRef}
            onClick={handleTriggerClick}
            className="absolute inset-0 flex items-center justify-center w-8"
            initial={false}
            animate={{
              opacity: open ? 0 : 1,
            }}
            transition={{
              duration: 0.15,
              ease: "easeOut",
            }}
            style={{
              pointerEvents: open ? 'none' : 'auto',
            }}
          >
            {renderTriggerContent()}
          </motion.button>

          {/* 展开的菜单 - 收起时淡出 */}
          <motion.div
            className="flex items-center gap-0.5 px-1 h-full"
            initial={false}
            animate={{
              opacity: open ? 1 : 0,
            }}
            transition={{
              duration: 0.2,
              delay: open ? 0.1 : 0,
              ease: "easeOut",
            }}
            style={{
              pointerEvents: open ? 'auto' : 'none',
            }}
          >
            {items.map((item, index) => (
              <motion.button
                key={item.id}
                onClick={(e) => handleItemClick(e, item.onClick)}
                className={cn(
                  "px-3 h-full text-xs font-medium whitespace-nowrap rounded-lg",
                  "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors",
                  getColorClassName(item.color)
                )}
                initial={false}
                animate={{
                  opacity: open ? 1 : 0,
                }}
                transition={{ 
                  duration: 0.2, 
                  delay: open ? 0.12 + index * 0.03 : 0,
                  ease: "easeOut",
                }}
              >
                {item.renderContent || item.label}
              </motion.button>
            ))}
          </motion.div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className={cn("relative action-menu-container", className)}>
      {showAnimation ? (
        <AnimatePresence mode="wait">
          {/* 触发按钮 */}
          <motion.button
            ref={triggerRef}
            key="more-button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            onClick={handleTriggerClick}
            className={cn(
              "w-7 h-7 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400",
              triggerClassName
            )}
          >
            {renderTriggerContent()}
          </motion.button>
          
          {/* 菜单 */}
          {open && (
            <motion.div
              key="action-buttons"
              initial={{ opacity: 0, scale: 0.9, x: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26, ease: "easeOut" }}
              className={cn(
                "absolute top-6 right-0 z-50 border border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-xs bg-white/95 dark:bg-neutral-900/95 rounded-lg overflow-hidden min-w-[100px]",
                menuClassName
              )}
              ref={menuRef}
              onClick={handleStop}
            >
              {menuContent}
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <>
          {/* 无动画触发按钮 */}
          <button
            ref={triggerRef}
            onClick={handleTriggerClick}
            className={cn(
              "h-[16.5] flex items-center justify-center text-xs text-neutral-600 dark:text-neutral-400",
              triggerClassName
            )}
          >
            {renderTriggerContent()}
          </button>
          
          {/* 无动画菜单 */}
          {open && (
            <div
              ref={menuRef}
              className={cn(
                "absolute top-6 right-0 z-50 border border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-xs bg-white/95 dark:bg-neutral-900/95 rounded-lg overflow-hidden min-w-[100px]",
                menuClassName
              )}
              onClick={handleStop}
            >
              {menuContent}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ActionMenu 