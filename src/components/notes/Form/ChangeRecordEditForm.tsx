'use client'

import React, { useState, useRef } from 'react'
import type { BrewingNote } from '@/lib/core/config'
import type { ChangeRecordDetails } from '@/types/app'
import NoteFormHeader from '@/components/notes/ui/NoteFormHeader'

interface ChangeRecordFormData {
    coffeeBeanInfo: {
        name: string;
        roastLevel: string;
        roastDate?: string;
    };
    changeAmount: number; // 变化量，支持正负值
    notes: string; // 备注
}

interface ChangeRecordEditFormProps {
    id?: string;
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: BrewingNote) => void;
    initialData: BrewingNote;
    hideHeader?: boolean;
    onTimestampChange?: (timestamp: Date) => void;
}

const ChangeRecordEditForm: React.FC<ChangeRecordEditFormProps> = ({
    id,
    isOpen,
    onClose,
    onSave,
    initialData,
    hideHeader = false,
    onTimestampChange,
}) => {
    const formRef = useRef<HTMLFormElement>(null);
    const [timestamp, setTimestamp] = useState<Date>(
        initialData?.timestamp ? new Date(initialData.timestamp) : new Date()
    );

    // 计算初始变化量
    const getInitialChangeAmount = (): number => {
        if (initialData.source === 'quick-decrement') {
            return -(initialData.quickDecrementAmount || 0);
        } else if (initialData.source === 'capacity-adjustment') {
            const adjustment = initialData.changeRecord?.capacityAdjustment;
            if (adjustment) {
                return adjustment.changeAmount;
            }
        }
        return 0;
    };

    const [formData, setFormData] = useState<ChangeRecordFormData>({
        coffeeBeanInfo: {
            name: initialData.coffeeBeanInfo?.name || '',
            roastLevel: initialData.coffeeBeanInfo?.roastLevel || '',
            roastDate: initialData.coffeeBeanInfo?.roastDate,
        },
        changeAmount: getInitialChangeAmount(),
        notes: initialData.notes || '',
    });

    // 单独跟踪是否为增加状态
    const [isIncrease, setIsIncrease] = useState<boolean>(getInitialChangeAmount() >= 0);

    // 处理时间戳变化
    const handleTimestampChange = (newTimestamp: Date) => {
        setTimestamp(newTimestamp);
        if (onTimestampChange) {
            onTimestampChange(newTimestamp);
        }
    };

    // 处理表单提交
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // 构建更新后的变动记录数据
        const updatedRecord: BrewingNote = {
            ...initialData,
            timestamp: timestamp.getTime(),
            coffeeBeanInfo: formData.coffeeBeanInfo,
            notes: formData.notes,
        };

        // 根据记录类型更新相应字段
        if (initialData.source === 'quick-decrement') {
            updatedRecord.quickDecrementAmount = Math.abs(formData.changeAmount);
            // 更新params.coffee字段以保持一致性
            updatedRecord.params = {
                ...updatedRecord.params,
                coffee: `${Math.abs(formData.changeAmount)}g`,
            };
        } else if (initialData.source === 'capacity-adjustment') {
            const originalAdjustment = initialData.changeRecord?.capacityAdjustment;
            if (originalAdjustment) {
                const newChangeRecord: ChangeRecordDetails = {
                    capacityAdjustment: {
                        ...originalAdjustment,
                        changeAmount: formData.changeAmount,
                        changeType: formData.changeAmount > 0 ? 'increase' : 
                                   formData.changeAmount < 0 ? 'decrease' : 'set',
                        newAmount: originalAdjustment.originalAmount + formData.changeAmount,
                    }
                };
                updatedRecord.changeRecord = newChangeRecord;
                // 更新params.coffee字段
                updatedRecord.params = {
                    ...updatedRecord.params,
                    coffee: `${Math.abs(formData.changeAmount)}g`,
                };
            }
        }

        onSave(updatedRecord);
    };



    if (!isOpen) return null;

    const containerClassName = `relative flex flex-col p-6 pt-6 ${hideHeader ? 'pt-6' : ''} h-full overflow-y-auto overscroll-contain`;

    return (
        <form 
            id={id} 
            ref={formRef}
            onSubmit={handleSubmit}
            className={containerClassName}
        >
            {/* 根据hideHeader属性决定是否显示头部 */}
            {!hideHeader && (
                <div className="shrink-0 mb-4">
                    <NoteFormHeader
                        isEditMode={true}
                        onBack={onClose}
                        onSave={() => formRef.current?.requestSubmit()}
                        showSaveButton={true}
                        timestamp={timestamp}
                        onTimestampChange={handleTimestampChange}
                    />
                </div>
            )}

            <div className="flex-1 space-y-8">
                {/* 咖啡豆信息 */}
                <div className="space-y-4">
                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {formData.coffeeBeanInfo.name}
                    </div>
                </div>

                {/* 容量变化 */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                const currentAmount = Math.abs(formData.changeAmount);
                                setIsIncrease(!isIncrease);
                                setFormData({
                                    ...formData,
                                    changeAmount: !isIncrease ? currentAmount : -currentAmount
                                });
                            }}
                            className="flex items-center text-sm font-medium border-b border-neutral-200 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 bg-transparent outline-none py-2 text-neutral-800 dark:text-neutral-300 cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
                        >
                            {isIncrease ? '增加' : '减少'}
                            <svg
                                className="w-3 h-3 text-neutral-400 dark:text-neutral-500 ml-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                        </button>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={Math.abs(formData.changeAmount)}
                            onChange={(e) => {
                                const amount = parseFloat(e.target.value) || 0;
                                setFormData({
                                    ...formData,
                                    changeAmount: isIncrease ? amount : -amount
                                });
                            }}
                            className="flex-1 text-sm font-medium border-b border-neutral-200 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 bg-transparent outline-none py-2 text-neutral-800 dark:text-neutral-300"
                            placeholder="变化量"
                        />
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">g</span>
                    </div>
                </div>

                {/* 备注 */}
                <div className="space-y-4">
                    <input
                        type="text"
                        value={formData.notes}
                        onChange={(e) => setFormData({
                            ...formData,
                            notes: e.target.value,
                        })}
                        className="w-full text-sm font-medium border-b border-neutral-200 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 bg-transparent outline-none py-2 text-neutral-800 dark:text-neutral-300"
                        placeholder="备注（如：快捷扣除）"
                    />
                </div>
            </div>

            {/* 底部保存按钮 - 悬浮固定，仅在不隐藏头部时显示 */}
            {!hideHeader && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10 pb-safe-bottom">
                    <button
                        type="submit"
                        className="rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-6 py-3 flex items-center justify-center"
                    >
                        <span className="font-medium">保存笔记</span>
                    </button>
                </div>
            )}
        </form>
    );
};

export default ChangeRecordEditForm;
