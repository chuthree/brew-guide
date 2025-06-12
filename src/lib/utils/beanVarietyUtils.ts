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
 * @returns 按数量排序的唯一品种数组（数量多的在前）
 */
export const extractUniqueVarieties = (beans: ExtendedCoffeeBean[]): string[] => {
    const varietyCount = new Map<string, number>()

    // 统计每个品种的咖啡豆数量
    beans.forEach(bean => {
        const varieties = getBeanVarieties(bean)
        varieties.forEach(variety => {
            varietyCount.set(variety, (varietyCount.get(variety) || 0) + 1)
        })
    })

    // 按数量排序，数量多的在前
    const varieties = Array.from(varietyCount.entries())
        .sort((a, b) => {
            // 按数量降序排列
            if (a[1] !== b[1]) {
                return b[1] - a[1]
            }

            // 数量相同时按名称字母顺序排列
            return a[0].localeCompare(b[0], 'zh-CN')
        })
        .map(entry => entry[0])

    return varieties
}

/**
 * 从咖啡豆数组中提取所有唯一的产地
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一产地数组（数量多的在前）
 */
export const extractUniqueOrigins = (beans: ExtendedCoffeeBean[]): string[] => {
    const originCount = new Map<string, number>()

    // 统计每个产地的咖啡豆数量
    beans.forEach(bean => {
        const origins = getBeanOrigins(bean)
        origins.forEach(origin => {
            originCount.set(origin, (originCount.get(origin) || 0) + 1)
        })
    })

    // 按数量排序，数量多的在前
    const origins = Array.from(originCount.entries())
        .sort((a, b) => {
            // 按数量降序排列
            if (a[1] !== b[1]) {
                return b[1] - a[1]
            }

            // 数量相同时按名称字母顺序排列
            return a[0].localeCompare(b[0], 'zh-CN')
        })
        .map(entry => entry[0])

    return origins
}

/**
 * 从咖啡豆数组中提取所有唯一的处理法
 * @param beans 咖啡豆数组
 * @returns 排序后的唯一处理法数组
 */
export const extractUniqueProcesses = (beans: ExtendedCoffeeBean[]): string[] => {
    const processesSet = new Set<string>()

    beans.forEach(bean => {
        const processes = getBeanProcesses(bean)
        processes.forEach(process => processesSet.add(process))
    })

    return Array.from(processesSet).sort()
}

/**
 * 检查咖啡豆是否包含指定产地
 * @param bean 咖啡豆对象
 * @param origin 要检查的产地名称
 * @returns 是否包含该产地
 */
export const beanHasOrigin = (bean: ExtendedCoffeeBean, origin: string): boolean => {
    const origins = getBeanOrigins(bean)
    return origins.includes(origin)
}

/**
 * 检查咖啡豆是否包含指定处理法
 * @param bean 咖啡豆对象
 * @param process 要检查的处理法名称
 * @returns 是否包含该处理法
 */
export const beanHasProcess = (bean: ExtendedCoffeeBean, process: string): boolean => {
    const processes = getBeanProcesses(bean)
    return processes.includes(process)
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

/**
 * 赏味期状态枚举 - 与现有系统保持一致
 */
export enum FlavorPeriodStatus {
    AGING = 'aging',         // 养豆期
    OPTIMAL = 'optimal',     // 赏味期
    DECLINE = 'decline',     // 衰退期
    FROZEN = 'frozen',       // 冰冻
    IN_TRANSIT = 'in_transit', // 在途
    UNKNOWN = 'unknown'      // 未知（没有烘焙日期）
}

/**
 * 赏味期状态显示名称
 */
export const FLAVOR_PERIOD_LABELS: Record<FlavorPeriodStatus, string> = {
    [FlavorPeriodStatus.AGING]: '养豆期',
    [FlavorPeriodStatus.OPTIMAL]: '赏味期',
    [FlavorPeriodStatus.DECLINE]: '衰退期',
    [FlavorPeriodStatus.FROZEN]: '冰冻',
    [FlavorPeriodStatus.IN_TRANSIT]: '在途',
    [FlavorPeriodStatus.UNKNOWN]: '未知'
}

/**
 * 计算咖啡豆的赏味期状态 - 与现有系统保持一致
 * @param bean 咖啡豆对象
 * @returns 赏味期状态
 */
export const getBeanFlavorPeriodStatus = (bean: ExtendedCoffeeBean): FlavorPeriodStatus => {
    // 处理在途状态
    if (bean.isInTransit) {
        return FlavorPeriodStatus.IN_TRANSIT
    }

    // 处理冰冻状态
    if (bean.isFrozen) {
        return FlavorPeriodStatus.FROZEN
    }

    if (!bean.roastDate) {
        return FlavorPeriodStatus.UNKNOWN
    }

    try {
        const today = new Date()
        const roastDate = new Date(bean.roastDate)
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const roastDateOnly = new Date(roastDate.getFullYear(), roastDate.getMonth(), roastDate.getDate())
        const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24))

        // 优先使用自定义赏味期参数，如果没有则根据烘焙度计算
        let startDay = bean.startDay || 0
        let endDay = bean.endDay || 0

        // 如果没有自定义值，则根据烘焙度设置默认值
        if (startDay === 0 && endDay === 0) {
            if (bean.roastLevel?.includes('浅')) {
                startDay = 7
                endDay = 30
            } else if (bean.roastLevel?.includes('深')) {
                startDay = 14
                endDay = 60
            } else {
                // 默认为中烘焙
                startDay = 10
                endDay = 30
            }
        }

        if (daysSinceRoast < startDay) {
            return FlavorPeriodStatus.AGING  // 养豆期
        } else if (daysSinceRoast <= endDay) {
            return FlavorPeriodStatus.OPTIMAL  // 赏味期
        } else {
            return FlavorPeriodStatus.DECLINE  // 衰退期
        }
    } catch (_error) {
        return FlavorPeriodStatus.UNKNOWN
    }
}

/**
 * 检查咖啡豆是否属于指定的赏味期状态
 * @param bean 咖啡豆对象
 * @param status 要检查的赏味期状态
 * @returns 是否属于该状态
 */
export const beanHasFlavorPeriodStatus = (bean: ExtendedCoffeeBean, status: FlavorPeriodStatus): boolean => {
    return getBeanFlavorPeriodStatus(bean) === status
}

/**
 * 从咖啡豆数组中提取所有存在的赏味期状态
 * @param beans 咖啡豆数组
 * @returns 存在的赏味期状态数组
 */
export const extractAvailableFlavorPeriodStatuses = (beans: ExtendedCoffeeBean[]): FlavorPeriodStatus[] => {
    const statusesSet = new Set<FlavorPeriodStatus>()

    beans.forEach(bean => {
        const status = getBeanFlavorPeriodStatus(bean)
        statusesSet.add(status)
    })

    // 按优先级排序：在途 > 冰冻 > 赏味期 > 养豆期 > 衰退期 > 未知
    const priorityOrder = [
        FlavorPeriodStatus.IN_TRANSIT,
        FlavorPeriodStatus.FROZEN,
        FlavorPeriodStatus.OPTIMAL,
        FlavorPeriodStatus.AGING,
        FlavorPeriodStatus.DECLINE,
        FlavorPeriodStatus.UNKNOWN
    ]

    return priorityOrder.filter(status => statusesSet.has(status))
}

/**
 * 从咖啡豆名称中提取烘焙商名称
 * 假设烘焙商名称在咖啡豆名称的最前面，用空格分隔
 * @param beanName 咖啡豆名称
 * @returns 烘焙商名称，如果无法识别则返回"未知烘焙商"
 */
export const extractRoasterFromName = (beanName: string): string => {
    if (!beanName || typeof beanName !== 'string') {
        return '未知烘焙商'
    }

    const trimmedName = beanName.trim()
    if (!trimmedName) {
        return '未知烘焙商'
    }

    // 按空格分割名称
    const parts = trimmedName.split(/\s+/)

    // 如果只有一个词，可能整个就是烘焙商名称，或者没有烘焙商信息
    if (parts.length === 1) {
        // 如果名称很短（可能是简称），直接作为烘焙商
        if (parts[0].length <= 6) {
            return parts[0]
        }
        // 如果名称较长，可能是完整的咖啡豆描述，没有单独的烘焙商
        return '未知烘焙商'
    }

    // 取第一个词作为烘焙商
    const firstPart = parts[0]

    // 过滤掉一些明显不是烘焙商的词（但保留包含"咖啡"的烘焙商名称）
    const excludeWords = ['豆', 'bean', 'beans', '手冲', '意式', '咖啡豆']
    // 只过滤完全匹配或者是纯粹的描述词，不过滤包含"咖啡"的烘焙商名称
    if (excludeWords.some(word => firstPart.toLowerCase() === word.toLowerCase()) ||
        firstPart.toLowerCase() === 'coffee') {
        return '未知烘焙商'
    }

    return firstPart
}

/**
 * 从咖啡豆数组中提取所有唯一的烘焙商
 * @param beans 咖啡豆数组
 * @returns 按数量排序的唯一烘焙商数组（数量多的在前）
 */
export const extractUniqueRoasters = (beans: ExtendedCoffeeBean[]): string[] => {
    const roasterCount = new Map<string, number>()

    // 统计每个烘焙商的咖啡豆数量
    beans.forEach(bean => {
        const roaster = extractRoasterFromName(bean.name)
        roasterCount.set(roaster, (roasterCount.get(roaster) || 0) + 1)
    })

    // 按数量排序，数量多的在前，"未知烘焙商"放在最后
    const roasters = Array.from(roasterCount.entries())
        .sort((a, b) => {
            // "未知烘焙商"始终排在最后
            if (a[0] === '未知烘焙商') return 1
            if (b[0] === '未知烘焙商') return -1

            // 按数量降序排列
            if (a[1] !== b[1]) {
                return b[1] - a[1]
            }

            // 数量相同时按名称字母顺序排列
            return a[0].localeCompare(b[0], 'zh-CN')
        })
        .map(entry => entry[0])

    return roasters
}

/**
 * 检查咖啡豆是否属于指定的烘焙商
 * @param bean 咖啡豆对象
 * @param roaster 要检查的烘焙商名称
 * @returns 是否属于该烘焙商
 */
export const beanHasRoaster = (bean: ExtendedCoffeeBean, roaster: string): boolean => {
    const beanRoaster = extractRoasterFromName(bean.name)
    return beanRoaster === roaster
}