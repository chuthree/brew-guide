'use client'

import React from 'react'
import ActionMenu from '@/components/CoffeeBean/ui/action-menu'
import { NoteItemProps } from '../types'
import { formatDate, formatRating } from '../utils'

const NoteItem: React.FC<NoteItemProps> = ({ note, equipmentNames, onEdit, onDelete, unitPriceCache }) => {
    return (
        <div className="group space-y-3 px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 last:border-b-0">
            <div className="flex flex-col space-y-3">
                {/* 标题和操作菜单 */}
                <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-normal break-words text-neutral-800 dark:text-neutral-100 pr-2">
                            {note.coffeeBeanInfo?.name ? (
                                <>
                                    {note.coffeeBeanInfo.name}
                                    <span className="text-neutral-600 dark:text-neutral-400 mx-1">·</span>
                                    <span className="text-neutral-600 dark:text-neutral-400">{note.method}</span>
                                </>
                            ) : (
                                <>
                                    {equipmentNames[note.equipment] || note.equipment}
                                    <span className="text-neutral-600 dark:text-neutral-400 mx-1">·</span>
                                    <span className="text-neutral-600 dark:text-neutral-400">{note.method}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex-shrink-0 ml-1 relative">
                        <ActionMenu
                            items={[
                                {
                                    id: 'edit',
                                    label: '编辑',
                                    onClick: () => onEdit(note)
                                },
                                {
                                    id: 'delete',
                                    label: '删除',
                                    onClick: () => onDelete(note.id),
                                    color: 'danger'
                                }
                            ]}
                        />
                    </div>
                </div>

                {/* 方案信息 - 修改参数显示，添加单位克价 */}
                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400 space-x-1">
                    {note.coffeeBeanInfo?.name && (
                        <>
                            <span>{equipmentNames[note.equipment] || note.equipment}</span>
                            <span>·</span>
                        </>
                    )}
                    {note.params && (
                        <>
                            <span>
                                {note.params.coffee}
                                {note.coffeeBeanInfo?.name && unitPriceCache[note.coffeeBeanInfo.name] > 0 && (
                                    <span className="ml-1">
                                        ({unitPriceCache[note.coffeeBeanInfo.name].toFixed(2)}元/克)
                                    </span>
                                )}
                            </span>
                            <span>·</span>
                            <span>{note.params.ratio}</span>

                            {/* 合并显示研磨度和水温 */}
                            {(note.params.grindSize || note.params.temp) && (
                                <>
                                    <span>·</span>
                                    {note.params.grindSize && note.params.temp ? (
                                        <span>{note.params.grindSize} · {note.params.temp}</span>
                                    ) : (
                                        <span>{note.params.grindSize || note.params.temp}</span>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* 风味评分 - 只有当存在有效评分(大于0)时才显示 */}
                {Object.values(note.taste).some(value => value > 0) ? (
                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(note.taste)
                            .map(([key, value], _i) => (
                                <div key={key} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                            {(() => {
                                                switch (key) {
                                                    case 'acidity':
                                                        return '酸度';
                                                    case 'sweetness':
                                                        return '甜度';
                                                    case 'bitterness':
                                                        return '苦度';
                                                    case 'body':
                                                        return '醇度';
                                                    default:
                                                        return key;
                                                }
                                            })()}
                                        </div>
                                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                            {value}
                                        </div>
                                    </div>
                                    <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                                        <div
                                            style={{ width: `${value === 0 ? 0 : (value / 5) * 100}%` }}
                                            className="h-full bg-neutral-800 dark:bg-neutral-100"
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                ) : null}

                {/* 时间和评分 */}
                {Object.values(note.taste).some(value => value > 0) ? (
                    <div className="flex items-baseline justify-between">
                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                            {formatDate(note.timestamp)}
                        </div>
                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                            {formatRating(note.rating)}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                    总体评分
                                </div>
                                <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                    {note.rating}
                                </div>
                            </div>
                            <div className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                                <div
                                    style={{ width: `${note.rating === 0 ? 0 : (note.rating / 5) * 100}%` }}
                                    className="h-full bg-neutral-800 dark:bg-neutral-100"
                                />
                            </div>
                        </div>
                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                            {formatDate(note.timestamp)}
                        </div>
                    </div>
                )}

                {/* 备注信息 */}
                {note.notes && (
                    <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                        {note.notes}
                    </div>
                )}
            </div>
        </div>
    )
}

export default NoteItem 