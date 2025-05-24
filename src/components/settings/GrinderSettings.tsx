'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { availableGrinders } from '@/lib/core/config'
import { getCategorizedGrindSizes } from '@/lib/utils/grindUtils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from '@/components/coffee-bean/ui/select'
import { SettingsOptions, CustomGrinder } from './Settings'
import hapticsUtils from '@/lib/ui/haptics'
import confetti from 'canvas-confetti'

interface GrinderSettingsProps {
    settings: SettingsOptions;
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void;
}

const GrinderSettings: React.FC<GrinderSettingsProps> = ({
    settings,
    handleChange
}) => {
    // 状态管理
    const [isCreatingCustom, setIsCreatingCustom] = useState(false)
    const [editingCustomId, setEditingCustomId] = useState<string | null>(null)
    const [previousGrinderType, setPreviousGrinderType] = useState<string>('generic')
    const [pendingGrinderId, setPendingGrinderId] = useState<string | null>(null)
    const [customGrinderForm, setCustomGrinderForm] = useState({
        name: '',
        grindSizes: {
            极细: '',
            特细: '',
            细: '',
            中细: '',
            中细偏粗: '',
            中粗: '',
            粗: '',
            特粗: '',
            意式: '',
            摩卡壶: '',
            手冲: '',
            法压壶: '',
            冷萃: ''
        }
    })

    // 监听自定义磨豆机列表变化，当有待处理的磨豆机ID时自动选择
    useEffect(() => {
        if (pendingGrinderId && settings.customGrinders) {
            const grinder = settings.customGrinders.find(g => g.id === pendingGrinderId)
            if (grinder) {
                console.log('检测到新磨豆机已添加，自动选择:', pendingGrinderId, grinder.name)
                handleChange('grindType', pendingGrinderId)
                setPendingGrinderId(null)
            }
        }
    }, [settings.customGrinders, pendingGrinderId]) // 移除 handleChange 依赖

    // 获取所有磨豆机（包括自定义的和添加选项）- 使用 useMemo 缓存
    const allGrinders = useMemo(() => {
        const customGrinders = settings.customGrinders || []
        const addCustomOption = {
            id: 'add_custom',
            name: '添加自定义磨豆机',
            grindSizes: {}
        }
        return [...availableGrinders, ...customGrinders, addCustomOption]
    }, [settings.customGrinders])

    // 生成自定义磨豆机ID
    const generateCustomGrinderId = () => {
        const timestamp = Date.now()
        return `custom_grinder_${timestamp}`
    }

    // 开始创建自定义磨豆机
    const startCreatingCustomGrinder = () => {
        // 保存当前选中的磨豆机类型
        setPreviousGrinderType(settings.grindType)
        setIsCreatingCustom(true)
        setEditingCustomId(null)
        setCustomGrinderForm({
            name: '',
            grindSizes: {
                极细: '',
                特细: '',
                细: '',
                中细: '',
                中细偏粗: '',
                中粗: '',
                粗: '',
                特粗: '',
                意式: '',
                摩卡壶: '',
                手冲: '',
                法压壶: '',
                冷萃: ''
            }
        })
    }

    // 开始编辑自定义磨豆机
    const startEditingCustomGrinder = (grinder: CustomGrinder) => {
        // 保存当前选中的磨豆机类型
        setPreviousGrinderType(settings.grindType)
        setIsCreatingCustom(true)
        setEditingCustomId(grinder.id)
        setCustomGrinderForm({
            name: grinder.name,
            grindSizes: {
                极细: grinder.grindSizes.极细 || '',
                特细: grinder.grindSizes.特细 || '',
                细: grinder.grindSizes.细 || '',
                中细: grinder.grindSizes.中细 || '',
                中细偏粗: grinder.grindSizes.中细偏粗 || '',
                中粗: grinder.grindSizes.中粗 || '',
                粗: grinder.grindSizes.粗 || '',
                特粗: grinder.grindSizes.特粗 || '',
                意式: grinder.grindSizes.意式 || '',
                摩卡壶: grinder.grindSizes.摩卡壶 || '',
                手冲: grinder.grindSizes.手冲 || '',
                法压壶: grinder.grindSizes.法压壶 || '',
                冷萃: grinder.grindSizes.冷萃 || ''
            }
        })
        // 切换到编辑模式
        handleChange('grindType', 'add_custom')
    }

    // 保存自定义磨豆机
    const saveCustomGrinder = () => {
        if (!customGrinderForm.name.trim()) {
            alert('请输入磨豆机名称')
            return
        }

        const customGrinders = settings.customGrinders || []

        if (editingCustomId) {
            // 编辑现有磨豆机
            const updatedGrinders = customGrinders.map(grinder =>
                grinder.id === editingCustomId
                    ? {
                        ...grinder,
                        name: customGrinderForm.name,
                        grindSizes: customGrinderForm.grindSizes
                      }
                    : grinder
            )

            console.log('更新自定义磨豆机:', editingCustomId, updatedGrinders)

            // 设置待处理的磨豆机ID
            setPendingGrinderId(editingCustomId)
            // 更新磨豆机列表
            handleChange('customGrinders', updatedGrinders)
        } else {
            // 创建新磨豆机
            const newGrinderId = generateCustomGrinderId()
            const newGrinder: CustomGrinder = {
                id: newGrinderId,
                name: customGrinderForm.name,
                grindSizes: customGrinderForm.grindSizes,
                isCustom: true
            }

            const updatedGrinders = [...customGrinders, newGrinder]
            console.log('创建新自定义磨豆机:', newGrinderId, updatedGrinders)

            // 设置待处理的磨豆机ID
            setPendingGrinderId(newGrinderId)
            // 更新磨豆机列表
            handleChange('customGrinders', updatedGrinders)
        }

        // 重置表单
        setIsCreatingCustom(false)
        setEditingCustomId(null)

        console.log('保存完成，当前磨豆机类型:', settings.grindType)
    }

    // 删除自定义磨豆机
    const deleteCustomGrinder = async (grinderId: string) => {
        if (confirm('确定要删除这个自定义磨豆机吗？')) {
            const customGrinders = settings.customGrinders || []
            const updatedGrinders = customGrinders.filter(grinder => grinder.id !== grinderId)

            // 如果当前选中的是被删除的磨豆机，先切换到通用
            if (settings.grindType === grinderId) {
                handleChange('grindType', 'generic')
            }

            // 然后删除磨豆机
            handleChange('customGrinders', updatedGrinders)

            console.log('删除磨豆机:', grinderId, '剩余磨豆机:', updatedGrinders.length)
        }
    }

    // 取消编辑
    const cancelEditing = () => {
        setIsCreatingCustom(false)
        setEditingCustomId(null)
        // 回到之前选中的磨豆机
        handleChange('grindType', previousGrinderType)
    }

    // 导出自定义磨豆机
    const exportCustomGrinder = (grinder: CustomGrinder) => {
        const exportData = {
            name: grinder.name,
            grindSizes: grinder.grindSizes
        }
        const jsonString = JSON.stringify(exportData, null, 2)
        navigator.clipboard.writeText(jsonString).then(() => {
            alert('磨豆机配置已复制到剪贴板！')
        }).catch(() => {
            // 降级方案：显示文本供用户手动复制
            const textarea = document.createElement('textarea')
            textarea.value = jsonString
            textarea.style.position = 'fixed'
            textarea.style.left = '-999999px'
            textarea.style.top = '-999999px'
            document.body.appendChild(textarea)
            textarea.focus()
            textarea.select()
            try {
                document.execCommand('copy')
                alert('磨豆机配置已复制到剪贴板！')
            } catch (_err) {
                alert('复制失败，请手动复制以下内容：\n\n' + jsonString)
            }
            document.body.removeChild(textarea)
        })
    }

    // 导入自定义磨豆机
    const importCustomGrinder = () => {
        const jsonString = prompt('请粘贴磨豆机配置的 JSON 数据：')
        if (!jsonString) return

        try {
            const importData = JSON.parse(jsonString)

            // 验证数据格式
            if (!importData.name || !importData.grindSizes) {
                throw new Error('数据格式不正确')
            }

            // 创建新的自定义磨豆机
            const newGrinder: CustomGrinder = {
                id: generateCustomGrinderId(),
                name: importData.name,
                grindSizes: {
                    极细: importData.grindSizes.极细 || '',
                    特细: importData.grindSizes.特细 || '',
                    细: importData.grindSizes.细 || '',
                    中细: importData.grindSizes.中细 || '',
                    中细偏粗: importData.grindSizes.中细偏粗 || '',
                    中粗: importData.grindSizes.中粗 || '',
                    粗: importData.grindSizes.粗 || '',
                    特粗: importData.grindSizes.特粗 || '',
                    意式: importData.grindSizes.意式 || '',
                    摩卡壶: importData.grindSizes.摩卡壶 || '',
                    手冲: importData.grindSizes.手冲 || '',
                    法压壶: importData.grindSizes.法压壶 || '',
                    冷萃: importData.grindSizes.冷萃 || ''
                },
                isCustom: true
            }

            const customGrinders = settings.customGrinders || []
            handleChange('customGrinders', [...customGrinders, newGrinder])
            alert('磨豆机配置导入成功！')
        } catch (_error) {
            alert('导入失败：JSON 格式不正确或数据不完整')
        }
    }

    // 触发彩带特效
    const showConfetti = () => {
        // Find the selected grinder button element
        const selectedGrinderButton = document.getElementById(`grinder-button-${settings.grindType}`);
        if (!selectedGrinderButton) return;

        // 获取按钮元素的位置信息
        const rect = selectedGrinderButton.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;

        // 创建彩带效果
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { x, y },
            colors: ['#FFD700', '#FF6347', '#9370DB', '#3CB371', '#4682B4'],
            zIndex: 9999,
            shapes: ['square', 'circle'],
            scalar: 0.8,
        });

        // 烟花效果
        setTimeout(() => {
            confetti({
                particleCount: 50,
                spread: 90,
                origin: { x, y },
                colors: ['#FFD700', '#FF6347', '#9370DB'],
                zIndex: 9999,
                startVelocity: 30,
                gravity: 0.8,
                shapes: ['star'],
                scalar: 1,
            });
        }, 250);
    }

    // 获取当前选中磨豆机的显示名称（使用 useMemo 缓存结果）
    const currentGrinderDisplayName = useMemo(() => {
        if (settings.grindType === 'add_custom') {
            return editingCustomId ? '编辑自定义磨豆机' : '添加自定义磨豆机';
        }

        const selectedGrinder = allGrinders.find(g => g.id === settings.grindType);

        // 只在找不到磨豆机时输出调试信息
        if (!selectedGrinder && settings.grindType !== 'generic') {
            console.log('未找到磨豆机:', {
                grindType: settings.grindType,
                availableIds: allGrinders.map(g => g.id),
                customGrinders: settings.customGrinders?.map(g => ({ id: g.id, name: g.name })) || []
            });
        }

        return selectedGrinder ? selectedGrinder.name : '选择磨豆机';
    }, [settings.grindType, allGrinders, editingCustomId]);

    // 处理磨豆机类型变更
    const handleGrinderChange = (value: string) => {
        console.log('磨豆机类型变更:', value);

        // 如果选择的是"添加自定义磨豆机"，则开始创建流程
        if (value === 'add_custom') {
            startCreatingCustomGrinder();
            handleChange('grindType', 'add_custom'); // 设置为 add_custom 以显示正确的名称
            return;
        }

        // 如果切换到其他磨豆机，取消创建/编辑状态
        if (isCreatingCustom) {
            setIsCreatingCustom(false);
            setEditingCustomId(null);
        }

        handleChange('grindType', value);

        // 当选择幻刺时触发彩带特效
        if (value === 'phanci_pro') {
            showConfetti();
            // 选择幻刺时也提供触感反馈
            if (settings.hapticFeedback) {
                hapticsUtils.medium();
            }
        }
    };

    return (
        <div className="px-6 py-4">
            <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                研磨度设置
            </h3>

            <div className="flex items-center justify-between py-2">
                <label
                    htmlFor={`grinder-select-${settings.grindType}`}
                    className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
                >
                    磨豆机类型
                </label>
                <div className="relative">
                    <Select
                        value={settings.grindType}
                        onValueChange={handleGrinderChange}
                    >
                        <SelectTrigger
                            id={`grinder-button-${settings.grindType}`}
                            variant="minimal"
                            className="w-auto text-right text-sm text-neutral-600 dark:text-neutral-400"
                        >
                            <SelectValue placeholder="选择磨豆机">
                                {currentGrinderDisplayName}
                            </SelectValue>
                            <svg
                                className="h-4 w-4 ml-1 text-neutral-500"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                            </svg>
                        </SelectTrigger>
                        <SelectContent className="max-h-[40vh] overflow-y-auto">
                            {availableGrinders.map((grinder) => (
                                <SelectItem
                                    key={grinder.id}
                                    value={grinder.id}
                                >
                                    {grinder.name}
                                </SelectItem>
                            ))}

                            {/* 自定义磨豆机 */}
                            {settings.customGrinders && settings.customGrinders.length > 0 && (
                                <>
                                    <SelectSeparator />
                                    {settings.customGrinders.map((grinder) => (
                                        <SelectItem
                                            key={grinder.id}
                                            value={grinder.id}
                                        >
                                            {grinder.name}
                                        </SelectItem>
                                    ))}
                                </>
                            )}

                            <SelectSeparator />
                            <SelectItem value="add_custom">
                                <span className="text-neutral-600 dark:text-neutral-400">+ 添加自定义磨豆机</span>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Display grinder specific reference grind sizes if available */}
            {(() => {
                // 如果选择的是"添加自定义磨豆机"，显示编辑界面
                if (settings.grindType === 'add_custom') {
                    return (
                        <div className="mt-3 border-l-2 border-blue-300 dark:border-blue-700 pl-4 py-2">
                            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                                {editingCustomId ? '编辑自定义磨豆机' : '创建自定义磨豆机'}
                            </p>

                            {/* 磨豆机名称输入 */}
                            <div className="mb-4">
                                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2 block">
                                    磨豆机名称:
                                </label>
                                <input
                                    type="text"
                                    value={customGrinderForm.name}
                                    onChange={(e) => setCustomGrinderForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="请输入磨豆机名称"
                                    className="w-full px-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                />
                            </div>

                            {/* 基础研磨度部分 */}
                            <div className="mb-3">
                                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                    基础研磨度:
                                </p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                    {['极细', '特细', '细', '中细', '中细偏粗', '中粗', '粗', '特粗'].map((key) => (
                                        <div key={key} className="flex justify-between text-sm text-neutral-700 dark:text-neutral-300">
                                            <span className="font-medium">{key}</span>
                                            <input
                                                type="text"
                                                value={customGrinderForm.grindSizes[key as keyof typeof customGrinderForm.grindSizes]}
                                                onChange={(e) => setCustomGrinderForm(prev => ({
                                                    ...prev,
                                                    grindSizes: {
                                                        ...prev.grindSizes,
                                                        [key]: e.target.value
                                                    }
                                                }))}
                                                placeholder="如: 1-2格"
                                                className="w-20 px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 特定应用研磨度部分 */}
                            <div className="mb-3">
                                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                    特定应用研磨度:
                                </p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                    {['意式', '摩卡壶', '手冲', '法压壶', '冷萃'].map((key) => (
                                        <div key={key} className="flex justify-between text-sm text-neutral-700 dark:text-neutral-300">
                                            <span className="font-medium">{key}</span>
                                            <input
                                                type="text"
                                                value={customGrinderForm.grindSizes[key as keyof typeof customGrinderForm.grindSizes]}
                                                onChange={(e) => setCustomGrinderForm(prev => ({
                                                    ...prev,
                                                    grindSizes: {
                                                        ...prev.grindSizes,
                                                        [key]: e.target.value
                                                    }
                                                }))}
                                                placeholder="如: 2-4格"
                                                className="w-20 px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 操作按钮 */}
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={saveCustomGrinder}
                                    className="px-3 py-1.5 text-xs font-medium bg-neutral-700 dark:bg-neutral-600 text-white rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-500 transition-colors"
                                >
                                    保存
                                </button>
                                <button
                                    onClick={cancelEditing}
                                    className="px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={importCustomGrinder}
                                    className="px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                >
                                    导入配置
                                </button>
                            </div>
                        </div>
                    );
                }

                // 显示选中磨豆机的参考研磨度
                const selectedGrinder = allGrinders.find(g => g.id === settings.grindType);

                if (selectedGrinder && selectedGrinder.grindSizes && Object.keys(selectedGrinder.grindSizes).length > 0) {
                    const { basicGrindSizes, applicationGrindSizes } = getCategorizedGrindSizes(settings.grindType, settings.customGrinders);

                    return (
                        <div className="mt-3 border-l-2 border-neutral-300 dark:border-neutral-700 pl-4 py-2">
                            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                                {selectedGrinder.name} 研磨度参考
                            </p>

                            {/* 基础研磨度部分 */}
                            <div className="mb-3">
                                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                    基础研磨度:
                                </p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                    {Object.entries(basicGrindSizes).map(([key, value]) => (
                                        <div key={key} className="flex justify-between text-sm text-neutral-700 dark:text-neutral-300">
                                            <span className="font-medium">{key}</span>
                                            <span>{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 特定应用研磨度部分 */}
                            {(() => {
                                if (Object.keys(applicationGrindSizes).length > 0) {
                                    return (
                                        <div className="mb-3">
                                            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                                特定应用研磨度:
                                            </p>
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                                {Object.entries(applicationGrindSizes).map(([key, value]) => (
                                                    <div key={key} className="flex justify-between text-sm text-neutral-700 dark:text-neutral-300">
                                                        <span className="font-medium">{key}</span>
                                                        <span>{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* 自定义磨豆机操作按钮 */}
                            {'isCustom' in selectedGrinder && selectedGrinder.isCustom && (
                                <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                                        自定义磨豆机操作
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => startEditingCustomGrinder(selectedGrinder as CustomGrinder)}
                                            className="px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={() => deleteCustomGrinder(selectedGrinder.id)}
                                            className="px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                        >
                                            删除
                                        </button>
                                        <button
                                            onClick={() => exportCustomGrinder(selectedGrinder as CustomGrinder)}
                                            className="px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                        >
                                            导出
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 数据来源和用户调研信息 - 仅对非自定义磨豆机显示 */}
                            {!('isCustom' in selectedGrinder) && (
                                <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                        数据来源：网络收集和用户调研，仅供参考
                                    </p>
                                    <div className="mt-2">
                                        <a
                                            href="https://wj.qq.com/s2/19815833/44ae/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 dark:text-blue-400 flex items-center"
                                        >
                                            <span>→ 参与研磨度调研问卷</span>
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                }
                return null;
            })()}
        </div>
    );
};

export default GrinderSettings;