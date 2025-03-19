import React from 'react';
import { motion } from 'framer-motion';
import { SettingsOptions } from './Settings';
import hapticsUtils from '@/lib/haptics';
import { Brand } from '@/lib/hooks/useBrewingState';

interface MethodTypeSelectorProps {
    methodType: 'common' | 'brand' | 'custom';
    selectedEquipment: string | null;
    selectedBrand: Brand | null;
    settings: SettingsOptions;
    onSelectMethodType: (type: 'common' | 'brand' | 'custom') => void;
    onResetBrand: () => void;
}

const MethodTypeSelector: React.FC<MethodTypeSelectorProps> = ({
    methodType,
    selectedEquipment,
    selectedBrand,
    settings,
    onSelectMethodType,
    onResetBrand
}) => {
    // 检查是否是聪明杯（CleverDripper）
    const isCleverDripper = selectedEquipment === 'CleverDripper';

    const handleMethodTypeChange = (type: 'common' | 'brand' | 'custom') => {
        if (settings.hapticFeedback) {
            hapticsUtils.light(); // 添加轻触感反馈
        }

        if (type === 'brand') {
            if (methodType === 'brand' && selectedBrand) {
                // 如果当前已经是品牌方案且已选择品牌，则重置品牌选择
                onResetBrand();
            } else {
                // 切换到品牌方案
                onSelectMethodType('brand');
            }
        } else {
            // 切换到其他类型方案
            onSelectMethodType(type);
        }
    };

    // 聪明杯UI - 只显示通用方案和自定义方案
    if (isCleverDripper) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26, ease: "easeOut" }}
                className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pt-3 pb-safe px-6 px-safe"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 28px)' }}
            >
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => handleMethodTypeChange('common')}
                        className={`text-[12px] tracking-wider transition-colors ${methodType === 'common'
                            ? 'text-neutral-800 dark:text-neutral-100'
                            : 'text-neutral-400 dark:text-neutral-500'
                            }`}
                    >
                        通用方案
                    </button>
                    <button
                        onClick={() => handleMethodTypeChange('custom')}
                        className={`text-[12px] tracking-wider transition-colors ${methodType === 'custom'
                            ? 'text-neutral-800 dark:text-neutral-100'
                            : 'text-neutral-400 dark:text-neutral-500'
                            }`}
                    >
                        自定义方案
                    </button>
                </div>
            </motion.div>
        );
    }

    // 标准UI - 显示所有方案类型
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pt-3 pb-safe px-6 px-safe"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 28px)' }}
        >
            <div className="flex justify-between items-center">
                <div className="flex space-x-4">
                    <button
                        onClick={() => handleMethodTypeChange('common')}
                        className={`text-[12px] tracking-wider transition-colors ${methodType === 'common'
                            ? 'text-neutral-800 dark:text-neutral-100'
                            : 'text-neutral-400 dark:text-neutral-500'
                            }`}
                    >
                        通用方案
                    </button>

                    <span
                        className="text-neutral-300 dark:text-neutral-600"
                    >
                        |
                    </span>
                    <button
                        onClick={() => handleMethodTypeChange('brand')}
                        className={`text-[12px] tracking-wider transition-colors ${methodType === 'brand'
                            ? 'text-neutral-800 dark:text-neutral-100'
                            : 'text-neutral-400 dark:text-neutral-500'
                            }`}
                    >
                        品牌方案
                        {methodType === 'brand' && selectedBrand && (
                            <span className="ml-1 text-[10px]">· {selectedBrand.name}</span>
                        )}
                    </button>
                </div>
                <button
                    onClick={() => handleMethodTypeChange('custom')}
                    className={`text-[12px] tracking-wider transition-colors ${methodType === 'custom'
                        ? 'text-neutral-800 dark:text-neutral-100'
                        : 'text-neutral-400 dark:text-neutral-500'
                        }`}
                >
                    自定义方案
                </button>
            </div>
        </motion.div>
    );
};

export default MethodTypeSelector; 