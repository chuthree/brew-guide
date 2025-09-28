import React from 'react'
import BeanListItem from './BeanListItem'
import { ExtendedCoffeeBean } from '../types'

interface ExportListViewProps {
    filteredBeans: ExtendedCoffeeBean[]
    isDarkMode: boolean
    expandedNotes?: Record<string, boolean>
    settings?: {
        dateDisplayMode?: 'date' | 'flavorPeriod' | 'agingDays'
        showOnlyBeanName?: boolean
        showFlavorInfo?: boolean
        limitNotesLines?: boolean
        notesMaxLines?: number
        showTotalPrice?: boolean
        showStatusDots?: boolean
    }
}

/**
 * 专门用于导出截图的静态列表组件
 * 使用真实的BeanListItem组件，确保样式完全一致
 */
const ExportListView: React.FC<ExportListViewProps> = ({ 
    filteredBeans, 
    isDarkMode,
    expandedNotes = {},
    settings 
}) => {
    // 空的处理函数
    const handleRemainingClick = () => {}
    const handleDetailClick = () => {}

    // 为导出优化设置 - 确保备注按用户界面的状态显示
    const exportSettings = {
        ...settings,
        // 强制启用行数限制，这样只有用户明确展开的备注才会全部显示
        limitNotesLines: true,
        // 使用用户设置的行数，如果没有设置则默认为1行
        notesMaxLines: settings?.notesMaxLines ?? 1
    };

    return (
        <div 
            className={`export-list-container ${isDarkMode ? 'dark' : ''}`}
            style={{
                width: '375px',
                padding: '24px',
                backgroundColor: isDarkMode ? '#171717' : '#fafafa',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                boxSizing: 'border-box'
            }}
        >
            <div 
                className="flex flex-col"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}
            >
                {filteredBeans.map((bean, index) => (
                    <BeanListItem
                        key={bean.id}
                        bean={bean}
                        isLast={index === filteredBeans.length - 1}
                        onRemainingClick={handleRemainingClick}
                        onDetailClick={handleDetailClick}
                        searchQuery=""
                        isNotesExpanded={expandedNotes[bean.id] ?? false}
                        settings={exportSettings}
                    />
                ))}
            </div>
        </div>
    )
}

export default ExportListView