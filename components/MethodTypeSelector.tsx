import React from 'react';
import { SettingsOptions } from './Settings';
import hapticsUtils from '@/lib/haptics';

interface MethodTypeSelectorProps {
    methodType: 'common' | 'custom';
    settings: SettingsOptions;
    onSelectMethodType: (type: 'common' | 'custom') => void;
}

const MethodTypeSelector: React.FC<MethodTypeSelectorProps> = ({
    methodType,
    settings,
    onSelectMethodType
}) => {
    const handleMethodTypeChange = (type: 'common' | 'custom') => {
        if (settings.hapticFeedback) {
            hapticsUtils.light(); // 添加轻触感反馈
        }
        onSelectMethodType(type);
    };

    return (
        <div
            className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pt-3 pb-safe px-6 px-safe"
            style={{
                paddingBottom: 'max(env(safe-area-inset-bottom), 28px)',
                willChange: "transform, opacity"
            }}
        >
            <div className="flex justify-start items-center">
                <button
                    onClick={() => handleMethodTypeChange('common')}
                    className={`text-[12px] tracking-wider transition-colors ${methodType === 'common'
                        ? 'text-neutral-800 dark:text-neutral-100'
                        : 'text-neutral-500 dark:text-neutral-400'
                        }`}
                >
                    通用方案
                </button>
                <span className="mx-3 text-neutral-300 dark:text-neutral-600 text-xs">|</span>
                <button
                    onClick={() => handleMethodTypeChange('custom')}
                    className={`text-[12px] tracking-wider transition-colors ${methodType === 'custom'
                        ? 'text-neutral-800 dark:text-neutral-100'
                        : 'text-neutral-500 dark:text-neutral-400'
                        }`}
                >
                    自定义方案
                </button>
            </div>
        </div>
    );
};

export default MethodTypeSelector; 