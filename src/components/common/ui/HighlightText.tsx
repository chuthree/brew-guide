'use client'

import React from 'react'

interface HighlightTextProps {
  text: string
  highlight: string
  className?: string
  highlightClassName?: string
}

/**
 * 高亮显示文本中的搜索关键词
 * @param text - 原始文本
 * @param highlight - 需要高亮的关键词
 * @param className - 文本的样式类
 * @param highlightClassName - 高亮文本的样式类，默认使用反向高亮效果（类似选中文本）
 */
const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  highlight,
  className = '',
  // highlightClassName = 'text-neutral-50 bg-neutral-800 dark:text-neutral-900 dark:bg-neutral-100',
  highlightClassName = 'underline underline-offset-2 decoration-black/50 dark:decoration-white/50'
}) => {
  // 如果没有高亮词或高亮词为空，直接返回原文本
  if (!highlight || highlight.trim() === '') {
    return <span className={className}>{text}</span>
  }

  // 转换为小写进行不区分大小写的匹配
  const lowerText = text.toLowerCase()
  const lowerHighlight = highlight.toLowerCase().trim()
  
  // 如果文本中不包含高亮词，直接返回原文本
  if (!lowerText.includes(lowerHighlight)) {
    return <span className={className}>{text}</span>
  }

  // 分割文本并添加高亮效果
  const parts = []
  let lastIndex = 0
  let index = lowerText.indexOf(lowerHighlight)

  while (index >= 0) {
    // 添加前面的非匹配文本
    if (index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`} className={className}>
          {text.substring(lastIndex, index)}
        </span>
      )
    }

    // 添加匹配部分，使用反向高亮效果，文字颜色与背景对调
    const highlightedText = text.substring(index, index + lowerHighlight.length)
    parts.push(
      <span key={`highlight-${index}`} className={highlightClassName}>
        {highlightedText}
      </span>
    )

    // 更新索引
    lastIndex = index + lowerHighlight.length
    index = lowerText.indexOf(lowerHighlight, lastIndex)
  }

  // 添加剩余的文本
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`} className={className}>
        {text.substring(lastIndex)}
      </span>
    )
  }

  return <>{parts}</>
}

export default HighlightText 