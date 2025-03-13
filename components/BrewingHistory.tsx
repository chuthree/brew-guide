'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BrewingNote } from '@/lib/config'
import BrewingNoteForm from './BrewingNoteForm'

interface BrewingHistoryProps {
    isOpen: boolean
    onClose: () => void
}

const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    })
}

const formatRating = (rating: number) => {
    return `[ ${rating}/5 ]`
}

const BrewingHistory: React.FC<BrewingHistoryProps> = ({ isOpen }) => {
    const [notes, setNotes] = useState<BrewingNote[]>([])
    const [editingNote, setEditingNote] = useState<BrewingNote | null>(null)

    // 添加本地存储变化监听
    useEffect(() => {
        const loadNotes = () => {
            try {
                const savedNotes = JSON.parse(localStorage.getItem('brewingNotes') || '[]')
                setNotes(savedNotes.sort((a: BrewingNote, b: BrewingNote) => b.timestamp - a.timestamp))
            } catch (error) {
                console.error('Error loading notes:', error)
                setNotes([])
            }
        }

        // 初始加载
        if (isOpen) {
            loadNotes()
        }

        // 监听其他标签页的存储变化
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'brewingNotes') {
                loadNotes()
            }
        }

        window.addEventListener('storage', handleStorageChange)
        return () => window.removeEventListener('storage', handleStorageChange)
    }, [isOpen])

    const handleDelete = (noteId: string) => {
        if (window.confirm('确定要删除这条笔记吗？')) {
            try {
                const updatedNotes = notes.filter(note => note.id !== noteId)
                localStorage.setItem('brewingNotes', JSON.stringify(updatedNotes))
                setNotes(updatedNotes)
            } catch (error) {
                console.error('Error deleting note:', error)
                alert('删除笔记时出错，请重试')
            }
        }
    }

    const handleEdit = (note: BrewingNote) => {
        const formattedNote = {
            ...note,
            coffeeBeanInfo: {
                name: note.coffeeBeanInfo?.name || '',
                roastLevel: note.coffeeBeanInfo?.roastLevel || '中度烘焙',
                roastDate: note.coffeeBeanInfo?.roastDate || '',
            },
            rating: note.rating || 3,
            taste: {
                acidity: note.taste?.acidity || 3,
                sweetness: note.taste?.sweetness || 3,
                bitterness: note.taste?.bitterness || 3,
                body: note.taste?.body || 3,
            },
            notes: note.notes || '',
            equipment: note.equipment,
            method: note.method,
            params: note.params,
            totalTime: note.totalTime,
        }
        setEditingNote(formattedNote)
    }

    const handleSaveEdit = (updatedData: any) => {
        if (!editingNote) return

        const updatedNotes = notes.map(note =>
            note.id === editingNote.id
                ? {
                    ...note,
                    coffeeBeanInfo: updatedData.coffeeBeanInfo,
                    rating: updatedData.rating,
                    taste: updatedData.taste,
                    notes: updatedData.notes,
                }
                : note
        )
        localStorage.setItem('brewingNotes', JSON.stringify(updatedNotes))
        setNotes(updatedNotes)
        setEditingNote(null)
    }

    if (!isOpen) return null

    if (editingNote) {
        return (
            <BrewingNoteForm
                id={editingNote.id}
                isOpen={true}
                onClose={() => setEditingNote(null)}
                onSave={handleSaveEdit}
                initialData={editingNote}
            />
        )
    }

    return (
        <div className=" space-y-6 pr-2">
            {notes.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                    className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500"
                >
                    [ 暂无冲煮记录 ]
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                    className="grid grid-cols-1 gap-6 md:grid-cols-2"
                >
                    <AnimatePresence mode="popLayout">
                        {notes.map((note, index) => (
                            <motion.div
                                key={note.id}
                                layoutId={note.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{
                                    duration: 0.4,
                                    delay: index * 0.1,
                                    layout: { duration: 0.3 }
                                }}
                                className="group space-y-4 border-l border-neutral-200/50 pl-6 dark:border-neutral-800"
                            >
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.2 + index * 0.1 }}
                                    className="flex flex-col space-y-4"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-baseline justify-between">
                                            <div className="flex items-baseline space-x-2">
                                                <div className="text-[10px] ">
                                                    {note.equipment}
                                                </div>
                                                {note.method && (
                                                    <>
                                                        <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                                            ·
                                                        </div>
                                                        <div className="text-[10px] font-light tracking-wide">
                                                            {note.method}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <button
                                                    onClick={() => handleEdit(note)}
                                                    className="text-[10px] tracking-widest text-neutral-400 transition-colors hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-300"
                                                >
                                                    [ 编辑 ]
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(note.id)}
                                                    className="text-[10px] tracking-widest text-neutral-400 transition-colors hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400"
                                                >
                                                    [ 删除 ]
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                            {note.coffeeBeanInfo?.name && (
                                                <>
                                                    <span>{note.coffeeBeanInfo.name}</span>
                                                    <span>·</span>
                                                </>
                                            )}
                                            <span>{note.coffeeBeanInfo?.roastLevel}</span>
                                            {note.coffeeBeanInfo?.roastDate && (
                                                <>
                                                    <span>·</span>
                                                    <span>{note.coffeeBeanInfo.roastDate}</span>
                                                </>
                                            )}
                                            {note.params && (
                                                <>
                                                    <span>·</span>
                                                    <span>{note.params.coffee}</span>
                                                    <span>·</span>
                                                    <span>{note.params.water}</span>
                                                    <span>·</span>
                                                    <span>{note.params.ratio}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {Object.entries(note.taste).map(([key, value], i) => (
                                            <motion.div
                                                key={key}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.5 + i * 0.1 + index * 0.1 }}
                                                className="space-y-1"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                                        {
                                                            {
                                                                acidity: '酸度',
                                                                sweetness: '甜度',
                                                                bitterness: '苦度',
                                                                body: '醇度',
                                                            }[key]
                                                        }
                                                    </div>
                                                    <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                                        [ {value} ]
                                                    </div>
                                                </div>
                                                <motion.div
                                                    className="h-px w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800"
                                                >
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${(value / 5) * 100}%` }}
                                                        transition={{
                                                            delay: 0.6 + i * 0.1 + index * 0.1,
                                                            duration: 0.5,
                                                            ease: "easeOut"
                                                        }}
                                                        className="h-full bg-neutral-800 dark:bg-neutral-100"
                                                    />
                                                </motion.div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    <div className="flex items-baseline justify-between">
                                        <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                            {formatDate(note.timestamp)}
                                        </div>
                                        <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                            {formatRating(note.rating)}
                                        </div>
                                    </div>

                                    {note.notes && (
                                        <div className="text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500">
                                            {note.notes}
                                        </div>
                                    )}
                                </motion.div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    )
}

export default BrewingHistory