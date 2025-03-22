'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BrewingNoteForm from '@/components/BrewingNoteForm'
import type { BrewingNoteData } from '@/app/types'
import type { Method } from '@/lib/config'
import type { SettingsOptions } from '@/components/Settings'
import { KeepAwake } from '@capacitor-community/keep-awake'
import hapticsUtils from '@/lib/haptics'
import { Storage } from '@/lib/storage'

// 添加是否支持KeepAwake的检查
const isKeepAwakeSupported = () => {
    try {
        return typeof KeepAwake !== 'undefined';
    } catch {
        return false;
    }
};

// Helper function to format time
const formatTime = (seconds: number, compact: boolean = false) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60

    if (compact) {
        return mins > 0
            ? `${mins}'${secs.toString().padStart(2, '0')}"`
            : `${secs}"`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface BrewingTimerProps {
    currentBrewingMethod: Method | null
    onTimerComplete?: () => void
    onStatusChange?: (status: { isRunning: boolean }) => void
    onStageChange?: (status: { currentStage: number, progress: number }) => void
    onComplete?: (isComplete: boolean, totalTime?: number) => void
    onCountdownChange?: (time: number | null) => void
    settings: SettingsOptions
    onJumpToImport?: () => void
}

const BrewingTimer: React.FC<BrewingTimerProps> = ({
    currentBrewingMethod,
    onTimerComplete,
    onStatusChange,
    onStageChange,
    onComplete,
    onCountdownChange,
    settings,
    onJumpToImport,
}) => {
    const [currentTime, setCurrentTime] = useState(0)
    const [isRunning, setIsRunning] = useState(false)
    const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null)
    const [showComplete, setShowComplete] = useState(false)
    const [currentWaterAmount, setCurrentWaterAmount] = useState(0)
    const [countdownTime, setCountdownTime] = useState<number | null>(null)
    const [hasStartedOnce, setHasStartedOnce] = useState(false)
    const [isCompleted, setIsCompleted] = useState(false)
    const [isHapticsSupported, setIsHapticsSupported] = useState(false)
    const lastStageRef = useRef<number>(-1)

    const audioContext = useRef<AudioContext | null>(null)
    const audioBuffers = useRef<{
        start: AudioBuffer | null;
        ding: AudioBuffer | null;
        correct: AudioBuffer | null;
    }>({
        start: null,
        ding: null,
        correct: null
    })
    const lastPlayedTime = useRef<{
        start: number;
        ding: number;
        correct: number;
    }>({
        start: 0,
        ding: 0,
        correct: 0
    })
    const audioLoaded = useRef<boolean>(false)
    const methodStagesRef = useRef(currentBrewingMethod?.params.stages || [])
    const [showNoteForm, setShowNoteForm] = useState(false)

    // 检查设备是否支持触感反馈
    useEffect(() => {
        const checkHapticsSupport = async () => {
            const supported = await hapticsUtils.isSupported();
            setIsHapticsSupported(supported);
        };

        checkHapticsSupport();
    }, []);

    // 封装触感调用函数
    const triggerHaptic = useCallback(async (type: keyof typeof hapticsUtils) => {
        if (isHapticsSupported && settings.hapticFeedback && typeof hapticsUtils[type] === 'function') {
            await hapticsUtils[type]();
        }
    }, [isHapticsSupported, settings.hapticFeedback]);

    // 音频系统初始化
    useEffect(() => {
        const initAudioSystem = () => {
            try {
                if (typeof window !== 'undefined' && 'AudioContext' in window) {
                    audioContext.current = new AudioContext()

                    const loadAudio = async () => {
                        try {
                            const fetchAudio = async (url: string): Promise<AudioBuffer> => {
                                const response = await fetch(url, { cache: 'force-cache' })
                                const arrayBuffer = await response.arrayBuffer()
                                if (audioContext.current) {
                                    return await audioContext.current.decodeAudioData(arrayBuffer)
                                }
                                throw new Error('AudioContext not initialized')
                            }

                            const [startBuffer, dingBuffer, correctBuffer] = await Promise.all([
                                fetchAudio('/sounds/start.mp3'),
                                fetchAudio('/sounds/ding.mp3'),
                                fetchAudio('/sounds/correct.mp3')
                            ])

                            audioBuffers.current = {
                                start: startBuffer,
                                ding: dingBuffer,
                                correct: correctBuffer
                            }

                            audioLoaded.current = true
                        } catch {
                            // 加载音频文件失败，静默处理
                        }
                    }

                    loadAudio()
                } else {
                    // 浏览器不支持Web Audio API，静默处理
                }
            } catch {
                // 初始化音频系统失败，静默处理
            }
        }

        const handleUserInteraction = () => {
            if (audioContext.current?.state === 'suspended') {
                audioContext.current.resume()
            }
            document.removeEventListener('click', handleUserInteraction)
            document.removeEventListener('touchstart', handleUserInteraction)
        }

        document.addEventListener('click', handleUserInteraction)
        document.addEventListener('touchstart', handleUserInteraction)

        initAudioSystem()

        return () => {
            document.removeEventListener('click', handleUserInteraction)
            document.removeEventListener('touchstart', handleUserInteraction)
            audioContext.current?.close()
        }
    }, [])

    const playSound = useCallback((type: 'start' | 'ding' | 'correct') => {
        if (!settings.notificationSound) {
            return;
        }

        if (!audioContext.current || !audioBuffers.current[type]) {
            // 音频系统未初始化或音频文件未加载，静默处理
            return
        }

        if (audioContext.current.state === 'suspended') {
            audioContext.current.resume()
        }

        const now = Date.now()

        if (now - lastPlayedTime.current[type] < 300) {
            return
        }

        try {
            const source = audioContext.current.createBufferSource()
            source.buffer = audioBuffers.current[type]

            const gainNode = audioContext.current.createGain()
            gainNode.gain.value = 0.5

            source.connect(gainNode)
            gainNode.connect(audioContext.current.destination)

            source.start(0)

            lastPlayedTime.current[type] = now
        } catch {
            // 播放音效失败，静默处理
        }
    }, [settings.notificationSound])

    const getCurrentStage = useCallback(() => {
        if (!currentBrewingMethod?.params?.stages?.length) return -1

        const stageIndex = currentBrewingMethod.params.stages.findIndex(
            (stage) => currentTime <= stage.time
        )

        return stageIndex === -1
            ? currentBrewingMethod.params.stages.length - 1
            : stageIndex
    }, [currentTime, currentBrewingMethod])

    const calculateCurrentWater = useCallback(() => {
        if (!currentBrewingMethod || currentTime === 0) return 0

        const stages = currentBrewingMethod.params.stages
        const currentStageIndex = getCurrentStage()

        if (currentStageIndex === -1) {
            return parseInt(stages[stages.length - 1].water)
        }

        const currentStage = stages[currentStageIndex]
        const prevStage = currentStageIndex > 0 ? stages[currentStageIndex - 1] : null

        const prevStageTime = prevStage ? prevStage.time : 0
        const prevStageWater = prevStage ? parseInt(prevStage.water) : 0

        if (currentStage.pourTime === 0) {
            return parseInt(currentStage.water)
        }

        const pourTime = currentStage.pourTime || Math.floor((currentStage.time - prevStageTime) / 3)

        const timeInCurrentStage = currentTime - prevStageTime
        const currentTargetWater = parseInt(currentStage.water)

        if (timeInCurrentStage <= pourTime) {
            const pourProgress = timeInCurrentStage / pourTime
            return prevStageWater + (currentTargetWater - prevStageWater) * pourProgress
        }

        return currentTargetWater
    }, [currentTime, currentBrewingMethod, getCurrentStage])

    useEffect(() => {
        methodStagesRef.current = currentBrewingMethod?.params.stages || []
    }, [currentBrewingMethod])

    const clearTimerAndStates = useCallback(() => {
        if (timerId) {
            clearInterval(timerId)
            setTimerId(null)
        }
    }, [timerId])

    useEffect(() => {
        return () => {
            if (timerId) {
                clearInterval(timerId)
            }
        }
    }, [timerId])

    useEffect(() => {
        const handleKeepAwake = async () => {
            // 检查是否支持KeepAwake
            if (!isKeepAwakeSupported()) {
                // 静默处理，不显示错误
                return;
            }

            try {
                if (isRunning) {
                    await KeepAwake.keepAwake();
                } else if (!isRunning && hasStartedOnce) {
                    await KeepAwake.allowSleep();
                }
            } catch {
                // 静默处理错误
            }
        };

        handleKeepAwake();

        return () => {
            const cleanup = async () => {
                if (!isKeepAwakeSupported()) {
                    return;
                }

                try {
                    await KeepAwake.allowSleep();
                } catch {
                    // 静默处理错误
                }
            };
            cleanup();
        };
    }, [isRunning, hasStartedOnce]);

    // 完成冲煮，显示笔记表单
    const handleComplete = useCallback(() => {
        if (isCompleted) return;

        triggerHaptic('success');
        clearTimerAndStates();
        setIsRunning(false);
        setShowComplete(true);
        setIsCompleted(true);
        onComplete?.(true, currentTime);
        onTimerComplete?.();
        playSound('correct');

        // 添加延迟，在计时器结束后自动显示笔记表单
        setTimeout(() => {
            setShowNoteForm(true);

            // 设置笔记状态标记，表示笔记表单已显示但尚未保存
            localStorage.setItem('brewingNoteInProgress', 'true');
        }, 1500); // 延迟1.5秒后显示表单，给用户时间感知冲煮完成

        const allowSleep = async () => {
            if (!isKeepAwakeSupported()) {
                return;
            }

            try {
                await KeepAwake.allowSleep();
            } catch {
                // 静默处理错误
            }
        };
        allowSleep();
    }, [clearTimerAndStates, onComplete, onTimerComplete, playSound, currentTime, isCompleted, triggerHaptic]);

    const startMainTimer = useCallback(() => {
        if (currentBrewingMethod) {
            const id = setInterval(() => {
                setCurrentTime((time) => {
                    const stages = methodStagesRef.current
                    const newTime = time + 1
                    const lastStageIndex = stages.length - 1

                    let shouldPlayDing = false
                    let shouldPlayStart = false

                    for (let index = 0; index < stages.length; index++) {
                        const prevStageTime = index > 0 ? stages[index - 1].time : 0
                        const nextStageTime = stages[index].time

                        if (newTime === prevStageTime) {
                            shouldPlayDing = true
                        }

                        if (newTime === nextStageTime - 2 || newTime === nextStageTime - 1) {
                            shouldPlayStart = true
                        }
                    }

                    if (shouldPlayDing) {
                        playSound('ding')
                    }
                    if (shouldPlayStart) {
                        playSound('start')
                    }

                    if (newTime > stages[lastStageIndex].time) {
                        clearInterval(id)
                        setTimerId(null)
                        setIsRunning(false)
                        handleComplete()
                        return stages[lastStageIndex].time
                    }
                    return newTime
                })
            }, 1000)
            setTimerId(id)
        }
    }, [currentBrewingMethod, playSound, handleComplete])

    useEffect(() => {
        if (countdownTime !== null && isRunning) {
            if (countdownTime > 0) {
                playSound('start')

                const countdownId = setInterval(() => {
                    setCountdownTime(prev => {
                        if (prev === null) return null
                        return prev - 1
                    })
                }, 1000)
                return () => clearInterval(countdownId)
            } else {
                setCountdownTime(null)
                playSound('ding')
                startMainTimer()
            }
        }
    }, [countdownTime, isRunning, playSound, startMainTimer])

    // 修改保存笔记函数，添加保存成功反馈
    const handleSaveNote = useCallback(async (note: BrewingNoteData) => {
        try {
            // 从Storage获取现有笔记
            const existingNotesStr = await Storage.get('brewingNotes');
            const existingNotes = existingNotesStr ? JSON.parse(existingNotesStr) : [];

            // 创建新笔记
            const newNote = {
                ...note,
                id: Date.now().toString(),
                timestamp: Date.now(),
            };

            // 将新笔记添加到列表开头
            const updatedNotes = [newNote, ...existingNotes];

            // 存储更新后的笔记列表
            await Storage.set('brewingNotes', JSON.stringify(updatedNotes));

            // 设置笔记已保存标记
            localStorage.setItem('brewingNoteInProgress', 'false');

            // 关闭笔记表单
            setShowNoteForm(false);
        } catch {
            alert('保存失败，请重试');
        }
    }, []);

    useEffect(() => {
        if (currentTime > 0 && currentTime >= methodStagesRef.current[methodStagesRef.current.length - 1]?.time) {
            handleComplete()
        }
    }, [currentTime, handleComplete])

    const startTimer = useCallback(() => {
        if (!isRunning && currentBrewingMethod) {
            triggerHaptic('medium');
            setIsRunning(true)
            if (!hasStartedOnce || currentTime === 0) {
                setCountdownTime(3)
                setHasStartedOnce(true)
            } else {
                startMainTimer()
            }
        }
    }, [isRunning, currentBrewingMethod, hasStartedOnce, startMainTimer, currentTime, triggerHaptic])

    const pauseTimer = useCallback(() => {
        triggerHaptic('light');
        clearTimerAndStates()
        setIsRunning(false)
    }, [clearTimerAndStates, triggerHaptic])

    const resetTimer = useCallback(() => {
        triggerHaptic('warning');
        clearTimerAndStates()
        setIsRunning(false)
        setCurrentTime(0)
        setShowComplete(false)
        setCurrentWaterAmount(0)
        setCountdownTime(null)
        setHasStartedOnce(false)
        setIsCompleted(false)

        const allowSleep = async () => {
            if (!isKeepAwakeSupported()) {
                return;
            }

            try {
                await KeepAwake.allowSleep();
            } catch {
                // 静默处理错误
            }
        };
        allowSleep();
    }, [clearTimerAndStates, triggerHaptic])

    useEffect(() => {
        if (isRunning) {
            const waterAmount = calculateCurrentWater()
            setCurrentWaterAmount(Math.round(waterAmount))
        }
    }, [currentTime, isRunning, calculateCurrentWater])

    useEffect(() => {
        onStatusChange?.({ isRunning })
    }, [isRunning, onStatusChange])

    const getStageProgress = useCallback(
        (stageIndex: number) => {
            if (!currentBrewingMethod?.params?.stages) return 0
            const methodStages = currentBrewingMethod.params.stages

            if (stageIndex < 0 || stageIndex >= methodStages.length) return 0

            const stage = methodStages[stageIndex]
            if (!stage) return 0

            const prevStageTime =
                stageIndex > 0 && methodStages[stageIndex - 1]
                    ? methodStages[stageIndex - 1].time
                    : 0

            if (currentTime < prevStageTime) return 0
            if (currentTime > stage.time) return 100

            return ((currentTime - prevStageTime) / (stage.time - prevStageTime)) * 100
        },
        [currentTime, currentBrewingMethod]
    )

    useEffect(() => {
        const currentStage = getCurrentStage()
        const progress = getStageProgress(currentStage)
        onStageChange?.({ currentStage, progress })
    }, [currentTime, getCurrentStage, getStageProgress, onStageChange])

    useEffect(() => {
        onCountdownChange?.(countdownTime)
    }, [countdownTime, onCountdownChange])

    // 在倒计时结束时添加触感反馈
    useEffect(() => {
        if (countdownTime === 0 && isRunning) {
            triggerHaptic('vibrateMultiple');
        }
    }, [countdownTime, isRunning, triggerHaptic]);

    // 在冲泡阶段变化时添加触感反馈
    useEffect(() => {
        const currentStage = getCurrentStage();
        if (currentStage !== lastStageRef.current && isRunning && lastStageRef.current !== -1) {
            triggerHaptic('medium');
        }
        lastStageRef.current = currentStage;
    }, [currentTime, getCurrentStage, isRunning, triggerHaptic]);

    // 添加监听自定义事件，用于外部控制关闭笔记表单
    useEffect(() => {
        const handleForceCloseNoteForm = (e: CustomEvent<{ force?: boolean }>) => {
            if (e.detail?.force) {
                // 只关闭笔记表单，不改变任何状态
                setShowNoteForm(false);
                // 不重置完成状态
                // 不清空参数
                // 不做任何其他操作
            }
        };

        // 添加事件监听器
        window.addEventListener('closeBrewingNoteForm', handleForceCloseNoteForm as EventListener);

        // 清理函数
        return () => {
            window.removeEventListener('closeBrewingNoteForm', handleForceCloseNoteForm as EventListener);
        };
    }, []);

    if (!currentBrewingMethod) return null

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="px-6 sticky bottom-0 border-t border-neutral-200 bg-neutral-50 pt-6 dark:border-neutral-800 dark:bg-neutral-900 pb-safe"
                style={{
                    willChange: "transform, opacity",
                    paddingBottom: 'max(env(safe-area-inset-bottom), 28px)'
                }}
            >
                <div className="mb-4 space-y-3">
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-baseline justify-between border-l-2 border-neutral-800 pl-3 dark:border-neutral-100"
                    >
                        <div>
                            <div className="text-xs text-neutral-400 dark:text-neutral-500">
                                当前阶段
                            </div>
                            <motion.div
                                key={getCurrentStage()}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.26 }}
                                className="mt-1 text-sm font-medium tracking-wide"
                            >
                                {currentBrewingMethod.params.stages[getCurrentStage()]?.label || '完成冲煮'}
                            </motion.div>
                        </div>
                        <div className="flex items-baseline text-right">

                            <div>
                                <div className="text-xs text-neutral-400 dark:text-neutral-500">
                                    预计时间
                                </div>
                                <motion.div
                                    key={`time-${getCurrentStage()}`}
                                    initial={{ opacity: 0.8 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.26 }}
                                    className="mt-1 text-sm font-medium tracking-wide"
                                >
                                    {currentBrewingMethod.params.stages[getCurrentStage()]
                                        ? formatTime(currentBrewingMethod.params.stages[getCurrentStage()].time, true)
                                        : '-'}
                                </motion.div>
                            </div>
                            <div className='min-w-24'>
                                <div className="text-xs text-neutral-400 dark:text-neutral-500">
                                    目标水量
                                </div>
                                <motion.div
                                    key={`water-${getCurrentStage()}`}
                                    initial={{ opacity: 0.8 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.26 }}
                                    className="mt-1 flex flex-col text-sm font-medium tracking-wide"
                                >
                                    {currentBrewingMethod.params.stages[getCurrentStage()]?.water ? (
                                        <div className="flex items-baseline justify-end">
                                            <span>{currentWaterAmount}</span>
                                            <span className="mx-0.5 text-neutral-300 dark:text-neutral-600">/</span>
                                            <span>{currentBrewingMethod.params.stages[getCurrentStage()].water}</span>
                                        </div>
                                    ) : (
                                        '-'
                                    )}
                                </motion.div>
                            </div>

                        </div>
                    </motion.div>

                    <AnimatePresence mode="wait">
                        {getCurrentStage() < currentBrewingMethod.params.stages.length - 1 && (
                            <motion.div
                                key={`next-${getCurrentStage() + 1}`}
                                initial={{ opacity: 0, height: 0, y: -20 }}
                                animate={{ opacity: 1, height: 'auto', y: 0 }}
                                exit={{ opacity: 0, height: 0, y: -20 }}
                                transition={{ duration: 0.26 }}
                                className="flex items-baseline justify-between border-l border-neutral-300 pl-3 dark:border-neutral-700"
                            >
                                <div>
                                    <div className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
                                        <span>下一步</span>
                                    </div>
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.26, delay: 0.1 }}
                                        className="mt-1"
                                    >
                                        <span className="text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                            {currentBrewingMethod.params.stages[getCurrentStage() + 1].label}
                                        </span>
                                    </motion.div>
                                </div>
                                <motion.div
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.26, delay: 0.2 }}
                                    className="flex items-baseline text-right"
                                >
                                    <div>
                                        <div className="text-xs text-neutral-400 dark:text-neutral-500">
                                            预计时间
                                        </div>
                                        <div className="mt-1 text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                            {formatTime(currentBrewingMethod.params.stages[getCurrentStage() + 1].time, true)}
                                        </div>
                                    </div>
                                    <div className='min-w-24'>
                                        <div className="text-xs text-neutral-400 dark:text-neutral-500">
                                            目标水量
                                        </div>
                                        <div className="mt-1 text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                                            {currentBrewingMethod.params.stages[getCurrentStage() + 1].water}
                                        </div>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="relative mb-4">
                    {currentBrewingMethod.params.stages.map((stage) => {
                        const totalTime = currentBrewingMethod.params.stages[currentBrewingMethod.params.stages.length - 1].time
                        const percentage = (stage.time / totalTime) * 100
                        return (
                            <div
                                key={stage.time}
                                className="absolute top-0 h-1 w-[2px] bg-neutral-50 dark:bg-neutral-900"
                                style={{ left: `${percentage}%` }}
                            />
                        )
                    })}

                    <div className="h-1 w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                        {currentBrewingMethod.params.stages.map((stage, index) => {
                            const totalTime = currentBrewingMethod.params.stages[currentBrewingMethod.params.stages.length - 1].time
                            const prevStageTime = index > 0 ? currentBrewingMethod.params.stages[index - 1].time : 0

                            const stagePourTime = stage.pourTime === 0 ? 0 : (stage.pourTime || Math.floor((stage.time - prevStageTime) / 3))
                            const waitingStartPercentage = ((prevStageTime + stagePourTime) / totalTime) * 100
                            const waitingWidth = ((stage.time - (prevStageTime + stagePourTime)) / totalTime) * 100

                            return waitingWidth > 0 ? (
                                <div
                                    key={`waiting-${stage.time}`}
                                    className="absolute h-1"
                                    style={{
                                        left: `${waitingStartPercentage}%`,
                                        width: `${waitingWidth}%`,
                                        background: `repeating-linear-gradient(
                                            45deg,
                                            transparent,
                                            transparent 4px,
                                            rgba(0, 0, 0, 0.1) 4px,
                                            rgba(0, 0, 0, 0.1) 8px
                                        )`,
                                    }}
                                />
                            ) : null
                        })}
                        <motion.div
                            className="h-full bg-neutral-800 dark:bg-neutral-100"
                            initial={{ width: 0 }}
                            animate={{
                                width: `${(currentTime / currentBrewingMethod.params.stages[currentBrewingMethod.params.stages.length - 1].time) * 100}%`,
                            }}
                            transition={{ duration: 0.26 }}
                        />
                    </div>

                    <div className="relative mt-1 h-4 w-full">
                        {currentBrewingMethod.params.stages.map((stage) => {
                            const totalTime = currentBrewingMethod.params.stages[currentBrewingMethod.params.stages.length - 1].time
                            const percentage = (stage.time / totalTime) * 100
                            return (
                                <div
                                    key={stage.time}
                                    className="absolute top-0 text-[8px] text-neutral-400 dark:text-neutral-500"
                                    style={{
                                        left: `${percentage}%`,
                                        transform: 'translateX(-100%)',
                                    }}
                                >
                                    {formatTime(stage.time, true)}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                    <div className="flex items-start space-x-8 sm:space-x-12">
                        <div className="flex flex-col items-start">
                            <span className="text-xs text-neutral-400 dark:text-neutral-500 mb-1">时间</span>
                            <div className="relative text-2xl font-light tracking-widest text-neutral-800 sm:text-3xl dark:text-neutral-100">
                                <AnimatePresence mode="wait">
                                    {countdownTime !== null ? (
                                        <motion.div
                                            key="countdown"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ duration: 0.26 }}
                                            className="min-w-[5ch] text-left"
                                        >
                                            {`0:${countdownTime.toString().padStart(2, '0')}`}
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="timer"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ duration: 0.26 }}
                                            className="min-w-[5ch] text-left"
                                        >
                                            {formatTime(currentTime)}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="flex flex-col items-start">
                            <span className="text-xs text-neutral-400 dark:text-neutral-500 mb-1">水量</span>
                            <div className="text-2xl font-light tracking-widest text-neutral-800 sm:text-3xl dark:text-neutral-100">
                                <div className="min-w-[5ch] text-left">
                                    <span>{currentWaterAmount}</span>
                                    <span className="text-sm text-neutral-400 dark:text-neutral-500 ml-1">g</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4 sm:space-x-6 mb-safe">
                        <button
                            onClick={isRunning ? pauseTimer : startTimer}
                            className="w-14 h-14 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                            disabled={showComplete}
                        >
                            {isRunning ?
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                                </svg>
                                :
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                                </svg>
                            }
                        </button>
                        <button
                            onClick={resetTimer}
                            className="w-14 h-14 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                        </button>
                    </div>
                </div>
            </motion.div>
            <AnimatePresence mode="wait">
                {showNoteForm && currentBrewingMethod && (
                    <motion.div
                        key="note-form"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.26 }}
                        className="absolute inset-0 bg-neutral-50 dark:bg-neutral-900"
                    >
                        <BrewingNoteForm
                            id="brewingNoteForm"
                            isOpen={showNoteForm}
                            onClose={() => setShowNoteForm(false)}
                            onSave={handleSaveNote}
                            initialData={{
                                equipment: currentBrewingMethod.name.split(' ')[0],
                                method: currentBrewingMethod.name,
                                params: currentBrewingMethod.params,
                                totalTime: currentTime,
                            }}
                            onJumpToImport={onJumpToImport}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

export default BrewingTimer 