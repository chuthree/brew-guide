import { getObjectState, saveObjectState, getBooleanState, saveBooleanState } from '@/lib/core/statePersistence'

// 模块名称
const MODULE_NAME = 'bean-print'

// PrintConfig 接口定义
export interface PrintConfig {
    width: number  // mm
    height: number // mm
    orientation: 'landscape' | 'portrait' // 布局方向
    fields: {
        name: boolean
        origin: boolean
        roastLevel: boolean
        roastDate: boolean
        flavor: boolean
        process: boolean
        variety: boolean
        notes: boolean
    }
    margin: number // mm
    fontSize: number // px
    titleFontSize: number // px
}

// 默认配置
export const defaultConfig: PrintConfig = {
    width: 80,
    height: 50,
    orientation: 'landscape',
    fields: {
        name: true,
        origin: true,
        roastLevel: true,
        roastDate: true,
        flavor: true,
        process: true,
        variety: true,
        notes: true
    },
    margin: 3,
    fontSize: 11,
    titleFontSize: 14
}

/**
 * 从 localStorage 读取打印配置
 */
export const getPrintConfigPreference = (): PrintConfig => {
    return getObjectState(MODULE_NAME, 'config', defaultConfig)
}

/**
 * 保存打印配置到 localStorage
 */
export const savePrintConfigPreference = (config: PrintConfig): void => {
    saveObjectState(MODULE_NAME, 'config', config)
}



/**
 * 从 localStorage 读取自定义尺寸显示状态
 */
export const getShowCustomSizePreference = (): boolean => {
    return getBooleanState(MODULE_NAME, 'showCustomSize', false)
}

/**
 * 保存自定义尺寸显示状态到 localStorage
 */
export const saveShowCustomSizePreference = (showCustomSize: boolean): void => {
    saveBooleanState(MODULE_NAME, 'showCustomSize', showCustomSize)
}

/**
 * 重置配置到默认值并保存
 */
export const resetConfigToDefault = (): PrintConfig => {
    const resetConfig = { ...defaultConfig }
    savePrintConfigPreference(resetConfig)
    return resetConfig
}

/**
 * 更新特定配置字段并保存
 */
export const updateConfigField = <K extends keyof PrintConfig>(
    currentConfig: PrintConfig,
    field: K,
    value: PrintConfig[K]
): PrintConfig => {
    const newConfig = { ...currentConfig, [field]: value }
    savePrintConfigPreference(newConfig)
    return newConfig
}

/**
 * 更新字段显示状态并保存
 */
export const toggleConfigField = (
    currentConfig: PrintConfig,
    field: keyof PrintConfig['fields']
): PrintConfig => {
    const newConfig = {
        ...currentConfig,
        fields: {
            ...currentConfig.fields,
            [field]: !currentConfig.fields[field]
        }
    }
    savePrintConfigPreference(newConfig)
    return newConfig
}

/**
 * 更新尺寸并保存
 */
export const updateConfigSize = (
    currentConfig: PrintConfig,
    dimension: 'width' | 'height',
    value: number
): PrintConfig => {
    const newConfig = { ...currentConfig, [dimension]: value }
    savePrintConfigPreference(newConfig)
    return newConfig
}

/**
 * 切换布局方向并保存
 */
export const toggleConfigOrientation = (currentConfig: PrintConfig): PrintConfig => {
    const newOrientation: 'landscape' | 'portrait' = currentConfig.orientation === 'landscape' ? 'portrait' : 'landscape'
    const newConfig: PrintConfig = {
        ...currentConfig,
        orientation: newOrientation
        // 保持 width 和 height 数值不变，只改变布局方向
    }
    savePrintConfigPreference(newConfig)
    return newConfig
}

/**
 * 更新边距并保存
 */
export const updateConfigMargin = (currentConfig: PrintConfig, margin: number): PrintConfig => {
    const newConfig = { ...currentConfig, margin }
    savePrintConfigPreference(newConfig)
    return newConfig
}

/**
 * 更新字体大小并保存
 */
export const updateConfigFontSize = (
    currentConfig: PrintConfig,
    fontSize: number
): PrintConfig => {
    const newConfig = { 
        ...currentConfig, 
        fontSize,
        titleFontSize: fontSize + 3
    }
    savePrintConfigPreference(newConfig)
    return newConfig
}

/**
 * 设置预设尺寸并保存
 */
export const setPresetSize = (
    currentConfig: PrintConfig,
    width: number,
    height: number
): PrintConfig => {
    const newConfig = { ...currentConfig, width, height }
    savePrintConfigPreference(newConfig)
    return newConfig
}