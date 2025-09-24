/**
 * 主题色动画工具
 * 使用 requestAnimationFrame 和线性插值来实现主题色的平滑过渡
 */

interface ColorRGB {
  r: number
  g: number
  b: number
}



// 将十六进制颜色转换为 RGB
function hexToRgb(hex: string): ColorRGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 }
}

// 在两个 RGB 颜色之间插值
function interpolateColor(from: ColorRGB, to: ColorRGB, progress: number): string {
  const r = Math.round(from.r + (to.r - from.r) * progress)
  const g = Math.round(from.g + (to.g - from.g) * progress)
  const b = Math.round(from.b + (to.b - from.b) * progress)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// 存储当前所有的 theme-color 标签信息
interface SavedThemeColorMeta {
  content: string
  media?: string
}

const savedThemeColorMetas: SavedThemeColorMeta[] = []

// 更新 meta theme-color 标签
function updateThemeColor(color: string) {
  // 先保存原始主题色配置（仅在第一次调用时）
  if (savedThemeColorMetas.length === 0) {
    saveAllThemeColorMetas()
  }

  // 移除所有现有的 theme-color 标签
  const existingMetas = document.querySelectorAll('meta[name="theme-color"]')
  existingMetas.forEach(meta => meta.remove())

  // 创建新的单一 theme-color 标签（无 media 属性，用于动画期间）
  const themeColorMeta = document.createElement('meta')
  themeColorMeta.name = 'theme-color'
  themeColorMeta.content = color
  document.head.appendChild(themeColorMeta)
}

// 保存所有当前的 theme-color 标签配置
function saveAllThemeColorMetas() {
  // 清空之前保存的配置，重新获取最新的
  savedThemeColorMetas.length = 0
  
  const allMetas = document.querySelectorAll('meta[name="theme-color"]') as NodeListOf<HTMLMetaElement>
  
  allMetas.forEach(meta => {
    savedThemeColorMetas.push({
      content: meta.content,
      media: meta.media || undefined
    })
  })
}

// 恢复原始主题色设置
function restoreAllThemeColorMetas() {
  // 移除所有当前的 theme-color 标签
  const currentMetas = document.querySelectorAll('meta[name="theme-color"]')
  currentMetas.forEach(meta => meta.remove())

  // 重新创建原始的标签配置
  savedThemeColorMetas.forEach(metaInfo => {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = metaInfo.content
    if (metaInfo.media) {
      meta.media = metaInfo.media
    }
    document.head.appendChild(meta)
  })
}

// 获取当前实际生效的主题色
function getCurrentThemeColor(): string {
  // 检查当前是否为深色模式
  const isDark = document.documentElement.classList.contains('dark') || 
                 (document.documentElement.classList.contains('system') && 
                  window.matchMedia('(prefers-color-scheme: dark)').matches)
  
  // 首先尝试获取无 media 属性的 meta 标签（明确的主题选择）
  const singleMeta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement
  if (singleMeta && singleMeta.content) {
    return singleMeta.content
  }
  
  // 然后尝试获取对应模式的 meta 标签（系统模式）
  const targetMedia = isDark ? '(prefers-color-scheme: dark)' : '(prefers-color-scheme: light)'
  const mediaMeta = document.querySelector(`meta[name="theme-color"][media="${targetMedia}"]`) as HTMLMetaElement
  if (mediaMeta && mediaMeta.content) {
    return mediaMeta.content
  }
  
  // 回退到应用的默认值
  return isDark ? '#171717' : '#fafafa'
}

// 获取当前主题的默认主题色（用于动画起点）
function getDefaultThemeColor(): string {
  // 直接使用当前实际生效的主题色，确保与当前状态一致
  return getCurrentThemeColor()
}

// 获取抽屉展开后的遮罩颜色（背景+遮罩的最终效果色）
function getDrawerOverlayColor(): string {
  const isDark = document.documentElement.classList.contains('dark') || 
                 (document.documentElement.classList.contains('system') && 
                  window.matchMedia('(prefers-color-scheme: dark)').matches)
  return isDark ? '#101010' : '#AFAFAF'
}

export interface ThemeColorAnimationOptions {
  duration?: number // 动画持续时间（毫秒）
  fromColor?: string // 起始颜色
  toColor?: string // 目标颜色
  onComplete?: () => void // 动画完成回调
}

export class ThemeColorAnimator {
  private animationId: number | null = null
  private startTime: number = 0

  // 开始动画
  animate(options: ThemeColorAnimationOptions = {}) {
    const {
      duration = 265, // 匹配抽屉动画时长
      fromColor = getDefaultThemeColor(),
      toColor = getDrawerOverlayColor(), // 默认过渡到遮罩颜色
      onComplete
    } = options

    // 取消之前的动画
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }

    const fromRgb = hexToRgb(fromColor)
    const toRgb = hexToRgb(toColor)

    const animate = (currentTime: number) => {
      if (this.startTime === 0) {
        this.startTime = currentTime
      }

      const elapsed = currentTime - this.startTime
      const rawProgress = Math.min(elapsed / duration, 1)
      
      // 使用线性进度（与背景遮罩动画保持一致）
      const progress = rawProgress
      
      // 插值计算当前颜色
      const currentColor = interpolateColor(fromRgb, toRgb, progress)
      
      // 更新主题色
      updateThemeColor(currentColor)

      if (rawProgress < 1) {
        this.animationId = requestAnimationFrame(animate)
      } else {
        this.animationId = null
        this.startTime = 0
        onComplete?.()
      }
    }

    this.animationId = requestAnimationFrame(animate)
  }

  // 停止当前动画
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
      this.startTime = 0
    }
  }

  // 立即设置主题色（无动画）
  setColor(color: string) {
    this.stop()
    updateThemeColor(color)
  }

  // 重置为默认主题色
  reset() {
    this.stop()
    restoreAllThemeColorMetas()
  }
}

// 清除保存的主题色配置（用于主题切换后重新同步）
export function clearSavedThemeColorMetas() {
  savedThemeColorMetas.length = 0
}

// 导出单例实例
export const themeColorAnimator = new ThemeColorAnimator()

// 便捷函数：抽屉打开动画
export function animateThemeColorForDrawerOpen(onComplete?: () => void) {
  themeColorAnimator.animate({
    duration: 265, // 同步遮罩动画时长
    fromColor: getDefaultThemeColor(),
    toColor: getDrawerOverlayColor(), // 过渡到遮罩色
    onComplete
  })
}

// 便捷函数：抽屉关闭动画
export function animateThemeColorForDrawerClose(onComplete?: () => void) {
  themeColorAnimator.animate({
    duration: 265, // 同步遮罩动画时长
    fromColor: getDrawerOverlayColor(), // 从遮罩色开始
    toColor: getCurrentThemeColor(), // 使用当前实际生效的主题色
    onComplete: () => {
      // 动画完成后，恢复原始的主题色设置
      restoreAllThemeColorMetas()
      onComplete?.()
    }
  })
}