'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard, type KeyboardInfo } from '@capacitor/keyboard'

export function KeyboardManager() {
  useEffect(() => {
    // 仅在原生应用环境中运行
    if (!Capacitor.isNativePlatform()) return

    // 获取平台信息
    const platform = Capacitor.getPlatform()
    
    // 存储监听器引用
    const subscriptions: Array<{ remove: () => void }> = []

    // 添加键盘事件监听器
    const setupListeners = async () => {
      // 键盘将要显示时
      const keyboardWillShowListener = await Keyboard.addListener('keyboardWillShow', (info: KeyboardInfo) => {
        if (platform === 'ios') {
          // 设置键盘高度变量供 CSS 使用
          document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`)
          
          // 添加类名到 body
          document.body.classList.add('keyboard-is-open')
          
          // 查找所有可能被键盘遮挡的输入元素
          const activeElement = document.activeElement
          if (activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.getAttribute('contenteditable') === 'true'
          )) {
            // 计算元素相对于视口底部的位置
            const rect = activeElement.getBoundingClientRect()
            const elementBottomPosition = window.innerHeight - rect.bottom
            
            // 如果元素会被键盘遮挡，添加额外的 padding 以确保元素可见
            if (elementBottomPosition < info.keyboardHeight) {
              const scrollContainer = findScrollableParent(activeElement as HTMLElement)
              if (scrollContainer) {
                // 计算需要滚动的距离以确保元素可见
                const scrollAmount = info.keyboardHeight - elementBottomPosition + 20 // 额外20px的空间
                setTimeout(() => {
                  scrollContainer.scrollTop += scrollAmount
                }, 100) // 短暂延迟以确保DOM更新
              }
            }
          }
          
          // 设置页面底部 padding 以避免内容被遮挡
          document.documentElement.style.setProperty('padding-bottom', `${info.keyboardHeight}px`)
        }
      })

      // 键盘显示后
      const keyboardDidShowListener = await Keyboard.addListener('keyboardDidShow', (_info: KeyboardInfo) => {
        if (platform === 'ios') {
          // 二次确认元素可见性
          const activeElement = document.activeElement
          if (activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.getAttribute('contenteditable') === 'true'
          )) {
            setTimeout(() => {
              (activeElement as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 150)
          }
        }
      })

      // 键盘将要隐藏时
      const keyboardWillHideListener = await Keyboard.addListener('keyboardWillHide', () => {
        if (platform === 'ios') {
          document.body.classList.remove('keyboard-is-open')
          document.documentElement.style.setProperty('--keyboard-height', '0px')
          document.documentElement.style.setProperty('padding-bottom', '0px')
        }
      })

      subscriptions.push(keyboardWillShowListener)
      subscriptions.push(keyboardDidShowListener)
      subscriptions.push(keyboardWillHideListener)
    }

    // 找到可滚动的父元素
    const findScrollableParent = (element: HTMLElement): HTMLElement | null => {
      let currentElement = element.parentElement
      
      while (currentElement) {
        const overflowY = window.getComputedStyle(currentElement).overflowY
        if (overflowY === 'auto' || overflowY === 'scroll') {
          return currentElement
        }
        currentElement = currentElement.parentElement
      }
      
      // 如果没有找到可滚动的父元素，则返回 body
      return document.body
    }

    setupListeners()

    // 添加点击事件监听器，用于处理点击空白区域隐藏键盘
    const handleDocumentClick = (event: MouseEvent) => {
      if (platform === 'ios') {
        const target = event.target as HTMLElement
        if (
          target.tagName !== 'INPUT' && 
          target.tagName !== 'TEXTAREA' && 
          target.getAttribute('contenteditable') !== 'true'
        ) {
          // 检查点击的元素是否是输入元素的后代
          let parent = target.parentElement
          let isInputDescendant = false
          
          while (parent) {
            if (
              parent.tagName === 'INPUT' || 
              parent.tagName === 'TEXTAREA' || 
              parent.getAttribute('contenteditable') === 'true'
            ) {
              isInputDescendant = true
              break
            }
            parent = parent.parentElement
          }
          
          if (!isInputDescendant) {
            Keyboard.hide()
          }
        }
      }
    }
    
    document.addEventListener('click', handleDocumentClick)

    // 清理函数
    return () => {
      // 移除所有事件监听器
      subscriptions.forEach(subscription => {
        subscription.remove()
      })
      
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [])

  // 此组件不渲染任何UI元素
  return null
} 