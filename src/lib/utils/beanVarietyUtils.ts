/**
 * 咖啡豆品种相关的工具函数
 * 统一处理新旧数据格式的品种信息获取
 */

import type { CoffeeBean } from '@/types/app'

// 占位符文本列表 - 这些不应该被当作真实数据
const PLACEHOLDER_TEXTS = [
    '产地', 'origin', 'Origin',
    '处理法', 'process', 'Process', '水洗', '日晒', '蜜处理',
    '品种', 'variety', 'Variety',
    '烘焙度', 'roast', 'Roast',
    '', ' ', '  ', '   ' // 空字符串和空格
]

/**
 * 检查文本是否为占位符或无效值
 * @param text 要检查的文本
 * @returns 是否为有效的真实数据
 */
const isValidText = (text: string | undefined | null): boolean => {
    if (!text || typeof text !== 'string') return false

    const trimmed = text.trim()
    if (trimmed === '') return false

    // 检查是否为占位符文本
    return !PLACEHOLDER_TEXTS.includes(trimmed)
}

// 扩展咖啡豆类型，包含blendComponents
export interface ExtendedCoffeeBean extends CoffeeBean {
    blendComponents?: {
        percentage?: number;
        origin?: string;
        process?: string;
        variety?: string;
    }[];
}

/**
 * 获取咖啡豆的所有品种信息
 * 优先从blendComponents获取，兼容旧格式的variety字段
 * @param bean 咖啡豆对象
 * @returns 品种数组，如果没有品种信息则返回空数组
 */
export const getBeanVarieties = (bean: ExtendedCoffeeBean): string[] => {
    const varieties: string[] = []

    // 优先从blendComponents获取品种信息
    if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
        bean.blendComponents.forEach(component => {
            if (isValidText(component.variety)) {
                varieties.push(component.variety!.trim())
            }
        })
    }
    // 如果没有blendComponents，检查旧格式的variety字段（兼容性）
    else if (isValidText(bean.variety)) {
        varieties.push(bean.variety!.trim())
    }

    // 去重并返回
    return Array.from(new Set(varieties))
}

/**
 * 获取咖啡豆的主要品种（第一个品种）
 * @param bean 咖啡豆对象
 * @returns 主要品种名称，如果没有则返回null
 */
export const getBeanPrimaryVariety = (bean: ExtendedCoffeeBean): string | null => {
    const varieties = getBeanVarieties(bean)
    return varieties.length > 0 ? varieties[0] : null
}

/**
 * 检查咖啡豆是否包含指定品种
 * @param bean 咖啡豆对象
 * @param variety 要检查的品种名称
 * @returns 是否包含该品种
 */
export const beanHasVariety = (bean: ExtendedCoffeeBean, variety: string): boolean => {
    const varieties = getBeanVarieties(bean)
    return varieties.includes(variety)
}

/**
 * 获取咖啡豆的品种显示文本
 * 如果有多个品种，用"、"连接；如果没有品种，返回null
 * @param bean 咖啡豆对象
 * @returns 品种显示文本或null
 */
export const getBeanVarietyDisplay = (bean: ExtendedCoffeeBean): string | null => {
    const varieties = getBeanVarieties(bean)
    return varieties.length > 0 ? varieties.join('、') : null
}

/**
 * 从咖啡豆数组中提取所有唯一的品种
 * @param beans 咖啡豆数组
 * @returns 排序后的唯一品种数组
 */
export const extractUniqueVarieties = (beans: ExtendedCoffeeBean[]): string[] => {
    const varietiesSet = new Set<string>()

    beans.forEach(bean => {
        const varieties = getBeanVarieties(bean)
        varieties.forEach(variety => varietiesSet.add(variety))
    })

    return Array.from(varietiesSet).sort()
}

/**
 * 检查咖啡豆是否有品种信息
 * @param bean 咖啡豆对象
 * @returns 是否有品种信息
 */
export const beanHasVarietyInfo = (bean: ExtendedCoffeeBean): boolean => {
    return getBeanVarieties(bean).length > 0
}

/**
 * 获取咖啡豆的产地信息
 * 优先从blendComponents获取，兼容旧格式
 * @param bean 咖啡豆对象
 * @returns 产地数组
 */
export const getBeanOrigins = (bean: ExtendedCoffeeBean): string[] => {
    const origins: string[] = []

    // 优先从blendComponents获取产地信息
    if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
        bean.blendComponents.forEach(component => {
            if (isValidText(component.origin)) {
                origins.push(component.origin!.trim())
            }
        })
    }
    // 如果没有blendComponents，检查旧格式的origin字段（兼容性）
    else if (isValidText(bean.origin)) {
        origins.push(bean.origin!.trim())
    }

    // 去重并返回
    return Array.from(new Set(origins))
}

/**
 * 获取咖啡豆的处理法信息
 * 优先从blendComponents获取，兼容旧格式
 * @param bean 咖啡豆对象
 * @returns 处理法数组
 */
export const getBeanProcesses = (bean: ExtendedCoffeeBean): string[] => {
    const processes: string[] = []

    // 优先从blendComponents获取处理法信息
    if (bean.blendComponents && Array.isArray(bean.blendComponents)) {
        bean.blendComponents.forEach(component => {
            if (isValidText(component.process)) {
                processes.push(component.process!.trim())
            }
        })
    }
    // 如果没有blendComponents，检查旧格式的process字段（兼容性）
    else if (isValidText(bean.process)) {
        processes.push(bean.process!.trim())
    }

    // 去重并返回
    return Array.from(new Set(processes))
}

/**
 * 检查咖啡豆数据是否为旧格式
 * @param bean 咖啡豆对象
 * @returns 是否为旧格式
 */
export const isLegacyBeanFormat = (bean: ExtendedCoffeeBean): boolean => {
    // 检查是否存在旧格式字段（无论是否有blendComponents）
    const hasLegacyFields = bean.origin || bean.process || bean.variety

    return !!hasLegacyFields
}

/**
 * 将旧格式咖啡豆转换为新格式
 * @param bean 旧格式咖啡豆对象
 * @returns 新格式咖啡豆对象
 */
export const convertLegacyBeanToNewFormat = (bean: ExtendedCoffeeBean): ExtendedCoffeeBean => {
    if (!isLegacyBeanFormat(bean)) {
        return bean // 已经是新格式，直接返回
    }

    const newBean = { ...bean }

    // 创建blendComponents
    newBean.blendComponents = [{
        origin: bean.origin || '',
        process: bean.process || '',
        variety: bean.variety || ''
    }]

    // 删除旧字段
    delete newBean.origin
    delete newBean.process
    delete newBean.variety

    return newBean
}
