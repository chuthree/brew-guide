import React from 'react';
import { SettingsOptions } from '../../settings/Settings';
import hapticsUtils from '@/lib/haptics';
import BottomActionBar from '../../layout/BottomActionBar';

interface MethodTypeSelectorProps {
    methodType: 'common' | 'custom';
    settings: SettingsOptions;
    onSelectMethodType: (type: 'common' | 'custom') => void;
    hideSelector?: boolean;
    showInTabContent?: boolean;
}

const MethodTypeSelector: React.FC<MethodTypeSelectorProps> = ({
    methodType,
    settings,
    onSelectMethodType,
    hideSelector = false,
    showInTabContent = true
}) => {
    const handleMethodTypeChange = (type: 'common' | 'custom') => {
        if (settings.hapticFeedback) {
            hapticsUtils.light(); // 添加轻触感反馈
        }
        onSelectMethodType(type);
    };

    if (hideSelector || showInTabContent) {
        return null;
    }

    // 注意：由于方案类型选择现在已经集成到了TabContent组件中，
    // 这个组件可能不再需要。保留它是为了向后兼容。
    return (
        <BottomActionBar
            buttons={[
                [{
                    text: '通用方案',
                    onClick: () => handleMethodTypeChange('common'),
                    active: methodType === 'common'
                }],
                [{
                    text: '自定义方案',
                    onClick: () => handleMethodTypeChange('custom'),
                    active: methodType === 'custom'
                }]
            ]}
            className="px-6 "
            fixed={false} // 让它的定位由父组件控制
        />
    );
};

export default MethodTypeSelector; 