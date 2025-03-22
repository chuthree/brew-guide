import React from 'react';
import { motion } from 'framer-motion';
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
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.28, ease: "easeOut", exit: { duration: 0.2 } }}
            className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pt-3 pb-safe px-6 px-safe"
            style={{
                paddingBottom: 'max(env(safe-area-inset-bottom), 28px)',
                willChange: "transform, opacity"
            }}
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
};

export default MethodTypeSelector; 