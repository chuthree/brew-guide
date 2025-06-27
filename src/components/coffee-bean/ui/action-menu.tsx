"use client"

import React, { useRef, useEffect, useState, ReactNode } from "react"
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
  const setOpen = (value: boolean) => {
    if (!isMounted.current) return
    
    setInternalOpen(value)
    onOpenChange?.(value)
    
    if (!value) {
      onClose?.()
    }
  }

  // 点击外部关闭
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!isMounted.current) return
      
      const isInMenu = menuRef.current && menuRef.current.contains(event.target as Node)
      const isOnTrigger = triggerRef.current && triggerRef.current.contains(event.target as Node)
      
      if (!isInMenu && !isOnTrigger) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside, true)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true)
    }
  }, [open, onClose])

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
            "w-full px-3 py-1.5 text-left text-xs relative",
            getColorClassName(item.color)
          )}
        >
          {item.renderContent || item.label}
        </button>
      ))}
    </div>
  )

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