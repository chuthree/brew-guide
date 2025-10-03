'use client'

import React, { useState, useEffect } from 'react'
import { ChevronLeft, Plus, Trash2, Edit3, GripVertical } from 'lucide-react'

import { SettingsOptions } from './Settings'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { 
    CustomFlavorDimensionsManager, 
    FlavorDimension
} from '@/lib/managers/customFlavorDimensions'
import hapticsUtils from '@/lib/ui/haptics'

interface FlavorDimensionSettingsProps {
    settings: SettingsOptions
    onClose: () => void
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void | Promise<void>
}

const FlavorDimensionSettings: React.FC<FlavorDimensionSettingsProps> = ({
    settings,
    onClose,
    handleChange: _handleChange
}) => {
    // 历史栈管理
    const onCloseRef = React.useRef(onClose)
    onCloseRef.current = onClose
    
    useEffect(() => {
        window.history.pushState({ modal: 'flavor-dimension-settings' }, '')
        
        const handlePopState = () => onCloseRef.current()
        window.addEventListener('popstate', handlePopState)
        
        return () => window.removeEventListener('popstate', handlePopState)
    }, []) // 空依赖数组，确保只在挂载时执行一次

    // 关闭处理
    const handleClose = () => {
        if (window.history.state?.modal === 'flavor-dimension-settings') {
            window.history.back()
        } else {
            onClose()
        }
    }

    const [dimensions, setDimensions] = useState<FlavorDimension[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingLabel, setEditingLabel] = useState('')
    const [newDimensionLabel, setNewDimensionLabel] = useState('')
    const [showAddForm, setShowAddForm] = useState(false)

    // 加载风味维度数据
    useEffect(() => {
        loadDimensions()
    }, [])

    const loadDimensions = async () => {
        try {
            const loadedDimensions = await CustomFlavorDimensionsManager.getFlavorDimensions()
            setDimensions(loadedDimensions)
        } catch (error) {
            console.error('加载风味维度失败:', error)
        }
    }

    // 添加新维度
    const handleAddDimension = async () => {
        if (!newDimensionLabel.trim()) return

        try {
            await CustomFlavorDimensionsManager.addFlavorDimension(newDimensionLabel.trim())
            await loadDimensions()
            setNewDimensionLabel('')
            setShowAddForm(false)
            
            if (settings.hapticFeedback) {
                hapticsUtils.light()
            }
        } catch (error) {
            console.error('添加风味维度失败:', error)
            alert('添加风味维度失败，请重试')
        }
    }

    // 开始编辑
    const startEditing = (dimension: FlavorDimension) => {
        setEditingId(dimension.id)
        setEditingLabel(dimension.label)
    }

    // 保存编辑
    const saveEdit = async () => {
        if (!editingId || !editingLabel.trim()) return

        try {
            await CustomFlavorDimensionsManager.updateFlavorDimension(editingId, {
                label: editingLabel.trim()
            })
            await loadDimensions()
            setEditingId(null)
            setEditingLabel('')
            
            if (settings.hapticFeedback) {
                hapticsUtils.light()
            }
        } catch (error) {
            console.error('更新风味维度失败:', error)
            alert('更新风味维度失败，请重试')
        }
    }

    // 取消编辑
    const cancelEdit = () => {
        setEditingId(null)
        setEditingLabel('')
    }

    // 删除维度
    const handleDeleteDimension = async (id: string) => {
        const dimension = dimensions.find(d => d.id === id)
        if (!dimension) return

        if (dimension.isDefault) {
            alert('不能删除默认风味维度')
            return
        }

        if (!confirm(`确定要删除"${dimension.label}"吗？`)) return

        try {
            await CustomFlavorDimensionsManager.deleteFlavorDimension(id)
            await loadDimensions()
            
            if (settings.hapticFeedback) {
                hapticsUtils.light()
            }
        } catch (error) {
            console.error('删除风味维度失败:', error)
            alert('删除风味维度失败，请重试')
        }
    }

    // 重置为默认
    const handleResetToDefault = async () => {
        if (!confirm('确定要重置为默认风味维度吗？这将删除所有自定义维度。')) return

        try {
            await CustomFlavorDimensionsManager.resetToDefault()
            await loadDimensions()
            
            if (settings.hapticFeedback) {
                hapticsUtils.medium()
            }
        } catch (error) {
            console.error('重置风味维度失败:', error)
            alert('重置风味维度失败，请重试')
        }
    }

    // 处理重新排序
    const handleReorder = async (newOrder: FlavorDimension[]) => {
        try {
            setDimensions(newOrder)
            const newOrderIds = newOrder.map(d => d.id)
            await CustomFlavorDimensionsManager.reorderFlavorDimensions(newOrderIds)
            
            if (settings.hapticFeedback) {
                hapticsUtils.light()
            }
        } catch (error) {
            console.error('重新排序失败:', error)
            alert('重新排序失败，请重试')
            // 出错时恢复原有顺序
            await loadDimensions()
        }
    }

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{
                duration: 0.35,
                ease: [0.36, 0.66, 0.04, 1]
            }}
            className="fixed inset-0 z-50 bg-neutral-50 dark:bg-neutral-900 pt-safe-top pb-safe-bottom max-w-[640px] sm:max-w-full mx-auto flex flex-col"
        >
            {/* 头部导航栏 */}
            <div className="relative flex items-center justify-center pb-4 sm:max-w-sm w-full mx-auto">
                <button
                    onClick={handleClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 dark:text-neutral-300"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">风味维度设置</h2>
            </div>

            {/* 滚动内容区域 */}
            <div className="flex-1 overflow-y-auto sm:max-w-sm w-full mx-auto">
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none first:border-b-0"></div>
                <div className="px-6 space-y-6 -mt-4">
                    {/* 说明文字 */}
                    <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 space-y-3">
                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                            <p className="mb-3">自定义笔记中的风味评分维度。可以添加、编辑、删除和重新排序维度。</p>
                            <ul className="space-y-1 ml-3">
                                <li>• 默认维度可以重命名但不能删除</li>
                                <li>• 拖拽图标可以重新排序</li>
                                <li>• 删除维度不会影响已有笔记中的评分数据</li>
                            </ul>
                        </div>
                    </div>

                    {/* 维度列表 */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                当前维度 ({dimensions.length})
                            </h3>
                            <button
                                onClick={handleResetToDefault}
                                className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 underline"
                            >
                                重置为默认
                            </button>
                        </div>

                        <Reorder.Group
                            axis="y"
                            values={dimensions}
                            onReorder={handleReorder}
                            className="space-y-2"
                        >
                            {dimensions.map((dimension) => (
                                <Reorder.Item
                                    key={dimension.id}
                                    value={dimension}
                                    whileDrag={{ 
                                        scale: 1.01,
                                        transition: { duration: 0.1 }
                                    }}
                                    style={{ 
                                        listStyle: 'none'
                                    }}
                                >
                                    <motion.div 
                                        className="flex items-center py-3"
                                        whileDrag={{
                                            backgroundColor: 'rgba(0,0,0,0.05)',
                                            transition: { duration: 0.1 }
                                        }}
                                        onPointerDown={(e) => {
                                            const target = e.target as HTMLElement;
                                            const isDragHandle = target.closest('.drag-handle');
                                            if (!isDragHandle) {
                                                e.preventDefault();
                                            }
                                        }}
                                    >
                                        {/* 拖拽手柄 */}
                                        <div className="drag-handle p-1 pl-0 mr-3 cursor-grab active:cursor-grabbing">
                                            <motion.div
                                                whileDrag={{
                                                    color: 'rgb(107 114 128)',
                                                    transition: { duration: 0.1 }
                                                }}
                                            >
                                                <GripVertical className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                                            </motion.div>
                                        </div>

                                        {/* 维度内容 */}
                                        <div className="flex-1">
                                            {editingId === dimension.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={editingLabel}
                                                        onChange={(e) => setEditingLabel(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveEdit()
                                                            if (e.key === 'Escape') cancelEdit()
                                                        }}
                                                        className="flex-1 px-2 py-1 text-sm bg-neutral-100 dark:bg-neutral-700 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={saveEdit}
                                                        className="text-xs px-2 py-1 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 rounded hover:opacity-80"
                                                    >
                                                        保存
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        className="text-xs px-2 py-1 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                                                    >
                                                        取消
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <motion.div
                                                        whileDrag={{
                                                            color: 'rgb(107 114 128)',
                                                            transition: { duration: 0.1 }
                                                        }}
                                                    >
                                                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                                            {dimension.label}
                                                        </span>
                                                        {dimension.isDefault && (
                                                            <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                                                                (默认)
                                                            </span>
                                                        )}
                                                    </motion.div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => startEditing(dimension)}
                                                            className="p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                                                        >
                                                            <Edit3 className="h-3 w-3" />
                                                        </button>
                                                        {!dimension.isDefault && (
                                                            <button
                                                                onClick={() => handleDeleteDimension(dimension.id)}
                                                                className="p-1 text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                </Reorder.Item>
                            ))}
                        </Reorder.Group>
                    </div>

                    {/* 添加新维度 */}
                    <div className="space-y-3">
                        {/* <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                            添加新维度
                        </h3>
                         */}
                        <AnimatePresence>
                            {showAddForm ? (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={newDimensionLabel}
                                            onChange={(e) => setNewDimensionLabel(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleAddDimension()
                                                if (e.key === 'Escape') {
                                                    setShowAddForm(false)
                                                    setNewDimensionLabel('')
                                                }
                                            }}
                                            placeholder="醇厚度、香气、余韵..."
                                            className="flex-1 px-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleAddDimension}
                                            disabled={!newDimensionLabel.trim()}
                                            className="px-4 py-2 text-sm bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 rounded hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            添加
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowAddForm(false)
                                                setNewDimensionLabel('')
                                            }}
                                            className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                                        >
                                            取消
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <button
                                    onClick={() => setShowAddForm(true)}
                                    className="w-full py-3 px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded border border-dashed border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    添加新的风味维度
                                </button>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* 底部空间 */}
                    <div className="h-20" />
                </div>
            </div>
        </motion.div>
    )
}

export default FlavorDimensionSettings