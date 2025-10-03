'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { availableGrinders } from '@/lib/core/config'
import { getCategorizedGrindSizes } from '@/lib/utils/grindUtils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from '@/components/coffee-bean/ui/select'
import { SettingsOptions, CustomGrinder } from './Settings'
import hapticsUtils from '@/lib/ui/haptics'
import { ChevronLeft } from 'lucide-react'


interface GrinderSettingsProps {
    settings: SettingsOptions;
    onClose: () => void;
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void;
}

const GrinderSettings: React.FC<GrinderSettingsProps> = ({
    settings,
    onClose,
    handleChange
}) => {
    // 历史栈管理
    const onCloseRef = React.useRef(onClose)
    onCloseRef.current = onClose
    
    useEffect(() => {
        window.history.pushState({ modal: 'grinder-settings' }, '')
        
        const handlePopState = () => onCloseRef.current()
        window.addEventListener('popstate', handlePopState)
        
        return () => window.removeEventListener('popstate', handlePopState)
    }, []) // 空依赖数组，确保只在挂载时执行一次

    // 关闭处理
    const handleClose = () => {
        if (window.history.state?.modal === 'grinder-settings') {
            window.history.back()
        } else {
            onClose()
        }
    }

    // 控制动画状态
    const [shouldRender, setShouldRender] = useState(false)
    const [isVisible, setIsVisible] = useState(false)

    // 处理显示/隐藏动画
    useEffect(() => {
        setShouldRender(true)
        // 短暂延迟确保 DOM 渲染，然后触发滑入动画
        const timer = setTimeout(() => setIsVisible(true), 10)
        return () => clearTimeout(timer)
    }, [])

    // 状态管理
    const [isCreatingCustom, setIsCreatingCustom] = useState(false)
    const [editingCustomId, setEditingCustomId] = useState<string | null>(null)
    const [previousGrinderType, setPreviousGrinderType] = useState<string>('generic')
    const [pendingGrinderId, setPendingGrinderId] = useState<string | null>(null)
    const [customGrinderForm, setCustomGrinderForm] = useState({
        name: '',
        unit: '', // 添加研磨度单位字段
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

    // 常见研磨度单位预设
    const commonUnits = ['格', '圈', '档', '刻度', 'mm', '级']

    // 从研磨度数据中提取单位的辅助函数
    const extractUnitFromGrindSizes = (grindSizes: Record<string, string>): string => {
        // 查找第一个非空的研磨度值
        for (const value of Object.values(grindSizes)) {
            if (value && value.trim()) {
                // 使用正则表达式提取单位（非数字、非连字符、非空格的字符）
                const match = value.match(/[^\d\s-]+/);
                if (match) {
                    return match[0];
                }
            }
        }
        return '';
    }

    // 从研磨度值中提取数值部分的辅助函数
    const extractNumberFromGrindSize = (value: string): string => {
        if (!value || !value.trim()) return '';
        // 提取数字、连字符、小数点和空格
        const match = value.match(/[\d\s.-]+/);
        return match ? match[0].trim() : '';
    }

    // 更新单位（不自动应用到输入值，只更新单位状态）
    const updateUnit = (unit: string) => {
        setCustomGrinderForm(prev => ({
            ...prev,
            unit
        }));
    }

    // 监听自定义磨豆机列表变化，当有待处理的磨豆机ID时自动选择
    useEffect(() => {
        if (pendingGrinderId && settings.customGrinders) {
            const grinder = settings.customGrinders.find(g => g.id === pendingGrinderId)
            if (grinder) {
                handleChange('grindType', pendingGrinderId)
                setPendingGrinderId(null)
            }
        }
    }, [settings.customGrinders, pendingGrinderId, handleChange])

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
        // 保存当前选中的磨豆机型号
        setPreviousGrinderType(settings.grindType)
        setIsCreatingCustom(true)
        setEditingCustomId(null)
        setCustomGrinderForm({
            name: '',
            unit: '',
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
        // 保存当前选中的磨豆机型号
        setPreviousGrinderType(settings.grindType)
        setIsCreatingCustom(true)
        setEditingCustomId(grinder.id)

        const extractedUnit = extractUnitFromGrindSizes(grinder.grindSizes);

        setCustomGrinderForm({
            name: grinder.name,
            unit: extractedUnit, // 从现有数据中提取单位
            grindSizes: {
                // 提取数值部分，去掉单位，便于编辑
                极细: extractNumberFromGrindSize(grinder.grindSizes.极细 || ''),
                特细: extractNumberFromGrindSize(grinder.grindSizes.特细 || ''),
                细: extractNumberFromGrindSize(grinder.grindSizes.细 || ''),
                中细: extractNumberFromGrindSize(grinder.grindSizes.中细 || ''),
                中细偏粗: extractNumberFromGrindSize(grinder.grindSizes.中细偏粗 || ''),
                中粗: extractNumberFromGrindSize(grinder.grindSizes.中粗 || ''),
                粗: extractNumberFromGrindSize(grinder.grindSizes.粗 || ''),
                特粗: extractNumberFromGrindSize(grinder.grindSizes.特粗 || ''),
                意式: extractNumberFromGrindSize(grinder.grindSizes.意式 || ''),
                摩卡壶: extractNumberFromGrindSize(grinder.grindSizes.摩卡壶 || ''),
                手冲: extractNumberFromGrindSize(grinder.grindSizes.手冲 || ''),
                法压壶: extractNumberFromGrindSize(grinder.grindSizes.法压壶 || ''),
                冷萃: extractNumberFromGrindSize(grinder.grindSizes.冷萃 || '')
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

        // 组合数值和单位生成最终的研磨度数据
        const finalGrindSizes: Record<string, string> = {};
        Object.keys(customGrinderForm.grindSizes).forEach(key => {
            const value = customGrinderForm.grindSizes[key as keyof typeof customGrinderForm.grindSizes];
            if (value && value.trim()) {
                // 如果有单位，则组合数值和单位；否则保持原值
                finalGrindSizes[key] = customGrinderForm.unit.trim()
                    ? `${value.trim()}${customGrinderForm.unit}`
                    : value.trim();
            } else {
                finalGrindSizes[key] = '';
            }
        });

        const customGrinders = settings.customGrinders || []

        if (editingCustomId) {
            // 编辑现有磨豆机
            const updatedGrinders = customGrinders.map(grinder =>
                grinder.id === editingCustomId
                    ? {
                        ...grinder,
                        name: customGrinderForm.name,
                        grindSizes: finalGrindSizes
                      }
                    : grinder
            )

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
                grindSizes: finalGrindSizes,
                isCustom: true
            }

            const updatedGrinders = [...customGrinders, newGrinder]

            // 设置待处理的磨豆机ID
            setPendingGrinderId(newGrinderId)
            // 更新磨豆机列表
            handleChange('customGrinders', updatedGrinders)
        }

        // 重置表单
        setIsCreatingCustom(false)
        setEditingCustomId(null)
    }

    // 删除自定义磨豆机
    const deleteCustomGrinder = (grinderId: string) => {
        if (confirm('确定要删除这个自定义磨豆机吗？')) {
            const customGrinders = settings.customGrinders || []
            const updatedGrinders = customGrinders.filter(grinder => grinder.id !== grinderId)

            // 如果当前选中的是被删除的磨豆机，先切换到通用
            if (settings.grindType === grinderId) {
                handleChange('grindType', 'generic')
            }

            // 然后删除磨豆机
            handleChange('customGrinders', updatedGrinders)
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
            const newGrinderId = generateCustomGrinderId()
            const newGrinder: CustomGrinder = {
                id: newGrinderId,
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

            // 设置待处理的磨豆机ID，导入成功后自动选择
            setPendingGrinderId(newGrinderId)

            // 更新磨豆机列表
            handleChange('customGrinders', [...customGrinders, newGrinder])

            alert('磨豆机配置导入成功！')
        } catch (_error) {
            alert('导入失败：JSON 格式不正确或数据不完整')
        }
    }

    // 移除未使用的彩带特效函数

    // 获取当前选中磨豆机的显示名称（使用 useMemo 缓存结果）
    const currentGrinderDisplayName = useMemo(() => {
        if (settings.grindType === 'add_custom') {
            return editingCustomId ? '编辑自定义磨豆机' : '添加自定义磨豆机';
        }

        const selectedGrinder = allGrinders.find(g => g.id === settings.grindType);
        return selectedGrinder ? selectedGrinder.name : '选择磨豆机';
    }, [settings.grindType, allGrinders, editingCustomId]);

    // 处理磨豆机型号变更
    const handleGrinderChange = (value: string) => {
        // 如果选择的是"添加自定义磨豆机"，则开始创建流程
        if (value === 'add_custom') {
            startCreatingCustomGrinder();
            handleChange('grindType', 'add_custom');
            return;
        }

        // 如果切换到其他磨豆机，取消创建/编辑状态
        if (isCreatingCustom) {
            setIsCreatingCustom(false);
            setEditingCustomId(null);
        }

        handleChange('grindType', value);

        // 当选择非通用磨豆机时可以提供反馈（可选）
        if (value !== 'generic' && value !== 'add_custom') {
            // 选择特定磨豆机时提供触感反馈
            if (settings.hapticFeedback) {
                hapticsUtils.medium();
            }
        }
    };

    // 渲染磨豆机参考信息
    const renderGrinderReference = () => {
        if (settings.grindType === 'add_custom') {
            return null;
        }

        const selectedGrinder = allGrinders.find(g => g.id === settings.grindType);

        if (!selectedGrinder || !selectedGrinder.grindSizes || Object.keys(selectedGrinder.grindSizes).length === 0) {
            return null;
        }

        const { basicGrindSizes, applicationGrindSizes } = getCategorizedGrindSizes(settings.grindType, settings.customGrinders as Record<string, unknown>[] | undefined);

        const elements = [];

        // 基础研磨度部分
        elements.push(
            <div key="basic-grind-sizes" className="mb-3">
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
        );

        // 特定应用研磨度部分
        if (Object.keys(applicationGrindSizes).length > 0) {
            elements.push(
                <div key="application-grind-sizes" className="mb-3">
                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                        特定应用研磨度:
                    </p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        {Object.entries(applicationGrindSizes).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-sm text-neutral-700 dark:text-neutral-300">
                                <span className="font-medium">{key}</span>
                                <span>{value as string}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // 自定义磨豆机操作按钮
        if ('isCustom' in selectedGrinder && selectedGrinder.isCustom) {
            elements.push(
                <div key="custom-grinder-actions" className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
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
            );
        }

        // 数据来源和用户调研信息 - 对所有磨豆机显示
        elements.push(
            <div key="data-source" className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
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
        );

        return (
            <div className="mt-3 border-l-2 border-neutral-300 dark:border-neutral-700 pl-4 py-2">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                    {selectedGrinder.name} 研磨度参考
                </p>
                {elements}
            </div>
        );
    };

    if (!shouldRender) return null

    return (
        <div
            className={`
                fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 mx-auto
                transition-transform duration-[350ms] ease-[cubic-bezier(0.36,0.66,0.04,1)]
                ${isVisible ? 'translate-x-0' : 'translate-x-full'}
            `}
        >
            {/* 头部导航栏 */}
            <div className="relative flex items-center justify-center py-4 pt-safe-top">
                <button
                    onClick={handleClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 dark:text-neutral-300"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
                    研磨度设置
                </h2>
            </div>

            {/* 滚动内容区域 */}
            <div className="relative flex-1 overflow-y-auto pb-safe-bottom divide-y divide-neutral-200 dark:divide-neutral-800">
                {/* 顶部渐变阴影 */}
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none first:border-b-0"></div>

                {/* 设置内容 */}
                <div className="px-6 py-4 -mt-4">
                    <div className="flex items-center justify-between py-2">
                        <label
                            htmlFor={`grinder-select-${settings.grindType}`}
                            className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
                        >
                            磨豆机型号
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
                    {settings.grindType === 'add_custom' && (
                        <div className="mt-3 border-l-2 border-neutral-300 dark:border-neutral-700 pl-4 py-2">
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

                            {/* 研磨度单位选择 */}
                            <div className="mb-4">
                                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2 block">
                                    研磨度单位:
                                </label>
                                <div className="flex gap-2 mb-2">
                                    {/* 常用单位快速选择 */}
                                    {commonUnits.map((unit) => (
                                        <button
                                            key={unit}
                                            onClick={() => updateUnit(unit)}
                                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${customGrinderForm.unit === unit
                                                    ? 'bg-neutral-700 dark:bg-neutral-600 text-white'
                                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
                                        >
                                            {unit}
                                        </button>
                                    ))}
                                </div>
                                {/* 自定义单位输入 */}
                                <input
                                    type="text"
                                    value={customGrinderForm.unit}
                                    onChange={(e) => updateUnit(e.target.value)}
                                    placeholder="或输入自定义单位"
                                    className="w-full px-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                />
                                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                    选择单位后，在下方输入框中只需输入数值，单位会显示在输入框后方
                                </p>
                            </div>

                            {/* 基础研磨度部分 */}
                            <div className="mb-3">
                                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                    基础研磨度:
                                </p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                    {['极细', '特细', '细', '中细', '中细偏粗', '中粗', '粗', '特粗'].map((key) => (
                                        <div key={key} className="flex justify-between items-center text-sm text-neutral-700 dark:text-neutral-300">
                                            <span className="font-medium">{key}</span>
                                            <div className="flex items-center gap-1">
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
                                                    placeholder="如: 1-2"
                                                    className="w-16 px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                                />
                                                {customGrinderForm.unit && (
                                                    <span className="text-xs text-neutral-500 dark:text-neutral-400 min-w-0">
                                                        {customGrinderForm.unit}
                                                    </span>
                                                )}
                                            </div>
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
                                        <div key={key} className="flex justify-between items-center text-sm text-neutral-700 dark:text-neutral-300">
                                            <span className="font-medium">{key}</span>
                                            <div className="flex items-center gap-1">
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
                                                    placeholder="如: 2-4"
                                                    className="w-16 px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                                />
                                                {customGrinderForm.unit && (
                                                    <span className="text-xs text-neutral-500 dark:text-neutral-400 min-w-0">
                                                        {customGrinderForm.unit}
                                                    </span>
                                                )}
                                            </div>
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
                    )}

                    {/* 显示选中磨豆机的参考研磨度 */}
                    {renderGrinderReference()}
                </div>
            </div>
        </div>
    );
};

export default GrinderSettings;
