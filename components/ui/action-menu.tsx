"use client"

import React, { useRef, useEffect, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"

export interface ActionMenuItem {
  id: string
  label: string
  onClick: () => void
  color?: "default" | "success" | "danger" | "warning" | "info"
  renderContent?: ReactNode // 允许自定义渲染内容
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  onClose?: () => void
  className?: string
  triggerClassName?: string
  menuClassName?: string
  showAnimation?: boolean // 是否显示动画效果
  isOpen?: boolean // 外部控制菜单开关状态
  onOpenChange?: (open: boolean) => void // 菜单开关状态变化回调
  onStop?: (e: React.MouseEvent) => void // 阻止冒泡事件
}

const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  onClose,
  className,
  triggerClassName,
  menuClassName,
  showAnimation = false,
  isOpen,
  onOpenChange,
  onStop,
}) => {
  // 支持内部状态管理或外部控制
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isOpen !== undefined ? isOpen : internalOpen
  const menuRef = useRef<HTMLDivElement>(null)

  // 更新开关状态
  const setOpen = (value: boolean) => {
    setInternalOpen(value)
    onOpenChange?.(value)
  }

  // 点击外部关闭
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
        onClose?.()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open, onClose])

  // 阻止事件冒泡
  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation()
    onStop?.(e)
  }

  // 根据color获取对应的类名
  const getColorClassName = (color: ActionMenuItem["color"]) => {
    switch (color) {
      case "success":
        return "text-emerald-600 dark:text-emerald-500"
      case "danger":
        return "text-red-500 dark:text-red-400"
      case "warning":
        return "text-amber-500 dark:text-amber-400"
      case "info":
        return "text-blue-400 dark:text-blue-500"
      default:
        return "text-neutral-600 dark:text-neutral-300"
    }
  }

  // 渲染触发按钮
  const renderTrigger = () => {
    if (showAnimation) {
      return (
        <motion.button
          key="more-button"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26, ease: "easeOut" }}
          onClick={(e) => {
            handleStop(e)
            setOpen(!open)
          }}
          className={cn(
            "w-7 h-7 flex items-center justify-center text-xs text-neutral-500 dark:text-neutral-400",
            triggerClassName
          )}
        >
          ···
        </motion.button>
      )
    }

    return (
      <button
        onClick={(e) => {
          handleStop(e)
          setOpen(!open)
        }}
        className={cn(
          "h-[16.5] flex items-center justify-center text-xs text-neutral-600 dark:text-neutral-400",
          triggerClassName
        )}
      >
        ···
      </button>
    )
  }

  // 渲染菜单内容
  const renderMenuContent = () => {
    const content = (
      <div className="py-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={(e) => {
              handleStop(e)
              item.onClick()
              setOpen(false)
            }}
            className={cn(
              "w-full px-3 py-1.5 text-left text-xs relative",
              getColorClassName(item.color)
            )}
          >
            {item.renderContent ? item.renderContent : item.label}
          </button>
        ))}
      </div>
    )

    if (showAnimation) {
      return (
        <motion.div
          key="action-buttons"
          initial={{ opacity: 0, scale: 0.9, x: 10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26, ease: "easeOut" }}
          className={cn(
            "absolute top-6 right-0 z-50 border border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-sm bg-white/95 dark:bg-neutral-900/95 rounded-lg overflow-hidden min-w-[100px]",
            menuClassName
          )}
          ref={menuRef}
          onClick={handleStop}
        >
          {content}
        </motion.div>
      )
    }

    return (
      <div
        ref={menuRef}
        className={cn(
          "absolute top-6 right-0 z-50 border border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-sm bg-white/95 dark:bg-neutral-900/95 rounded-lg overflow-hidden min-w-[100px]",
          menuClassName
        )}
        onClick={handleStop}
      >
        {content}
      </div>
    )
  }

  return (
    <div className={cn("relative", className)} onClick={handleStop}>
      {showAnimation ? (
        <AnimatePresence mode="wait">
          {open ? renderMenuContent() : null}
          {renderTrigger()}
        </AnimatePresence>
      ) : (
        <>
          {renderTrigger()}
          {open && renderMenuContent()}
        </>
      )}
    </div>
  )
}

export default ActionMenu 