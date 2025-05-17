'use client'

import React from 'react'
import { availableGrinders } from '@/lib/core/config'
import { getReferenceGrindSizes, getCategorizedGrindSizes } from '@/lib/utils/grindUtils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/coffee-bean/ui/select'
import { SettingsOptions } from './Settings'
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

    // 处理磨豆机类型变更
    const handleGrinderChange = (value: string) => {
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
                            <SelectValue placeholder="选择磨豆机" />
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
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Display grinder specific reference grind sizes if available */}
            {(() => {
                const referenceGrindSizes = getReferenceGrindSizes(settings.grindType);
                
                if (Object.keys(referenceGrindSizes).length > 0) {
                    const selectedGrinder = availableGrinders.find(g => g.id === settings.grindType);
                    const { basicGrindSizes, applicationGrindSizes } = getCategorizedGrindSizes(settings.grindType);
                    
                    return (
                        <div className="mt-3 border-l-2 border-neutral-300 dark:border-neutral-700 pl-4 py-2">
                            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                                {selectedGrinder?.name || "磨豆机"} 研磨度参考
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
                            {Object.keys(applicationGrindSizes).length > 0 && (
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
                            )}
                            
                            {/* 数据来源和用户调研信息 */}
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
                        </div>
                    );
                }
                return null;
            })()}
        </div>
    );
};

export default GrinderSettings; 