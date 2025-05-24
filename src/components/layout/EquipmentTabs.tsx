'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { equipmentList, CustomEquipment } from '@/lib/core/config';
import { MoreHorizontal, Plus } from 'lucide-react';
import hapticsUtils from '@/lib/ui/haptics';

interface EquipmentTabsProps {
    selectedEquipment: string | null;
    customEquipments: CustomEquipment[];
    onEquipmentSelect: (equipmentId: string) => void;
    onAddEquipment: () => void;
    onEditEquipment: (equipment: CustomEquipment) => void;
    onDeleteEquipment: (equipment: CustomEquipment) => void;
    onShareEquipment: (equipment: CustomEquipment) => void;
    settings: { hapticFeedback?: boolean };
}

const EquipmentTabs: React.FC<EquipmentTabsProps> = ({
    selectedEquipment,
    customEquipments,
    onEquipmentSelect,
    onAddEquipment,
    onEditEquipment,
    onDeleteEquipment,
    onShareEquipment,
    settings
}) => {
    const [showCustomMenu, setShowCustomMenu] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

    // 点击外部关闭菜单
    useEffect(() => {
        if (!showCustomMenu) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;

            // 检查是否点击在任何菜单内部
            const isInMenu = target.closest('.custom-equipment-menu');

            // 检查是否点击在操作符号上
            const isOnTrigger = target.closest('[data-menu-trigger]');

            if (!isInMenu && !isOnTrigger) {
                setShowCustomMenu(null);
                setMenuPosition(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showCustomMenu]);

    // 触感反馈
    const triggerHapticFeedback = async () => {
        if (settings?.hapticFeedback) {
            hapticsUtils.light();
        }
    };

    // 处理器具选择
    const handleEquipmentSelect = async (equipmentId: string) => {
        await triggerHapticFeedback();
        onEquipmentSelect(equipmentId);
        setShowCustomMenu(null);
        setMenuPosition(null);
    };

    // 处理自定义器具菜单
    const handleCustomMenuToggle = async (equipmentId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await triggerHapticFeedback();

        if (showCustomMenu === equipmentId) {
            setShowCustomMenu(null);
            setMenuPosition(null);
        } else {
            // 计算菜单位置
            const target = e.currentTarget as HTMLElement;

            if (target) {
                const rect = target.getBoundingClientRect();
                const containerRect = target.closest('.relative')?.getBoundingClientRect();

                if (containerRect) {
                    setMenuPosition({
                        top: rect.bottom - containerRect.top + 8, // 8px margin
                        right: containerRect.right - rect.right
                    });
                } else {
                    // 如果找不到容器，使用默认位置
                    setMenuPosition({
                        top: 50,
                        right: 16
                    });
                }
            } else {
                // 如果找不到目标元素，使用默认位置
                setMenuPosition({
                    top: 50,
                    right: 16
                });
            }

            setShowCustomMenu(equipmentId);
        }
    };

    // 处理菜单项点击
    const handleMenuAction = async (action: () => void, e: React.MouseEvent) => {
        e.stopPropagation();
        await triggerHapticFeedback();
        action();
        setShowCustomMenu(null);
        setMenuPosition(null);
    };

    // 处理添加器具
    const handleAddEquipment = async () => {
        await triggerHapticFeedback();
        onAddEquipment();
    };

    // 获取所有器具（标准 + 自定义）
    const allEquipments = [
        ...equipmentList.map(eq => ({ ...eq, isCustom: false })),
        ...customEquipments // customEquipments 已经有 isCustom: true 属性
    ];

    return (
        <div className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
            {/* 器具分类标签 */}
            <style jsx>{`
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
            <div className="relative">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {allEquipments.map((equipment) => {
                    const isSelected = selectedEquipment === equipment.id;
                    const isCustom = equipment.isCustom;

                    return (
                        <div key={equipment.id} className="relative flex-shrink-0">
                            <motion.button
                                onClick={() => handleEquipmentSelect(equipment.id)}
                                className={`
                                    relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium
                                    transition-all duration-200 whitespace-nowrap
                                    ${isSelected
                                        ? 'bg-neutral-800 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-800'
                                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                    }
                                `}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <span>{equipment.name}</span>

                                {/* 自定义器具操作符号 */}
                                {isCustom && isSelected && (
                                    <div
                                        onClick={(e) => handleCustomMenuToggle(equipment.id, e)}
                                        className="ml-1 p-0.5 rounded-full hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors cursor-pointer"
                                        role="button"
                                        tabIndex={0}
                                        data-menu-trigger
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleCustomMenuToggle(equipment.id, e as any);
                                            }
                                        }}
                                    >
                                        <MoreHorizontal className="w-3 h-3" />
                                    </div>
                                )}
                            </motion.button>

                        </div>
                    );
                })}

                {/* 添加器具按钮 */}
                <motion.button
                    onClick={handleAddEquipment}
                    className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <Plus className="w-4 h-4" />
                </motion.button>
                </div>

                {/* 自定义器具操作菜单 - 移到外层容器 */}
                <AnimatePresence>
                    {showCustomMenu && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="custom-equipment-menu absolute bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 z-50 min-w-[120px]"
                            style={{
                                top: menuPosition?.top || 0,
                                right: menuPosition?.right || 0
                            }}

                        >
                            <button
                                onClick={(e) => {
                                    const equipment = customEquipments.find(eq => eq.id === showCustomMenu);
                                    if (equipment) handleMenuAction(() => onEditEquipment(equipment), e);
                                }}
                                className="w-full px-4 py-2 text-left text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                            >
                                编辑
                            </button>
                            <button
                                onClick={(e) => {
                                    const equipment = customEquipments.find(eq => eq.id === showCustomMenu);
                                    if (equipment) handleMenuAction(() => onShareEquipment(equipment), e);
                                }}
                                className="w-full px-4 py-2 text-left text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                            >
                                分享
                            </button>
                            <button
                                onClick={(e) => {
                                    const equipment = customEquipments.find(eq => eq.id === showCustomMenu);
                                    if (equipment) handleMenuAction(() => onDeleteEquipment(equipment), e);
                                }}
                                className="w-full px-4 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                删除
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default EquipmentTabs;
