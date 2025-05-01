import { ExtendedCoffeeBean } from '../../types'
import { RefObject } from 'react'

export interface StatsViewProps {
    beans: ExtendedCoffeeBean[]
    showEmptyBeans: boolean
}

export interface StatsData {
    totalBeans: number
    emptyBeans: number
    activeBeans: number
    totalWeight: number
    remainingWeight: number
    consumedWeight: number
    totalCost: number
    averageBeanPrice: number
    averageGramPrice: number
    roastLevelCount: Record<string, number>
    typeCount: {
        '单品': number
        '拼配': number
    }
    beanTypeCount: {
        'espresso': number
        'filter': number
        'other': number
    }
    originCount: Record<string, number>
    processCount: Record<string, number>
    varietyCount: Record<string, number>
    topFlavors: [string, number][]
    totalFlavorTags: number
    flavorPeriodStatus: {
        inPeriod: number
        beforePeriod: number
        afterPeriod: number
        unknown: number
    }
}

export interface StatItemProps {
    label: string
    value: string
    unit?: string
}

export interface StatSectionProps {
    title: string
    children: React.ReactNode
}

export interface AnimationStyles {
    titleAnimStyle: React.CSSProperties
    usernameAnimStyle: React.CSSProperties
    infoAnimStyle: React.CSSProperties
    statsAnimStyle: (index: number) => React.CSSProperties
}

export interface BeanImageGalleryProps {
    beansWithImages: ExtendedCoffeeBean[]
    imagesLoaded: boolean
}

export interface TodayConsumptionData {
    consumption: number
    cost: number
}

export interface StatsSummaryProps {
    stats: StatsData
    todayConsumption: number
}

export interface StatCategoryProps {
    number: number
    title: string
    children: React.ReactNode
    animStyle: React.CSSProperties
} 