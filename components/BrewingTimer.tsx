/**
 * Sound Design for Brewing Timer
 * 
 * Sound Files:
 * - start.mp3: 提示音，用于倒计时和阶段预告
 *   - 倒计时3秒时每秒播放一次
 *   - 每个阶段开始前2秒和1秒各播放一次
 * 
 * - ding.mp3: 开始音，用于标记正式开始
 *   - 倒计时结束时播放一次
 *   - 每个新阶段开始时播放一次（除最后阶段）
 * 
 * - correct.mp3: 完成音
 *   - 整个冲煮过程完成时播放一次
 * 
 * Sound Behaviors:
 * 1. 首次开始或重置后开始：
 *    start(3) -> start(2) -> start(1) -> ding(开始)
 * 
 * 2. 阶段变化（除最后阶段）：
 *    start(前2秒) -> start(前1秒) -> ding(开始)
 * 
 * 3. 暂停后继续：
 *    无音效，直接继续
 * 
 * 4. 最后阶段结束：
 *    correct(完成)
 */

'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BrewingNoteForm from '@/components/BrewingNoteForm'

interface Stage {
    time: number
    label: string
    water: string
    detail: string
    pourTime?: number
}

interface Method {
    name: string
    params: {
        coffee: string
        water: string
        ratio: string
        grindSize: string
        temp: string
        videoUrl: string
        stages: Stage[]
    }
}

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
    onComplete?: (isComplete: boolean) => void
}

const BrewingTimer: React.FC<BrewingTimerProps> = ({
    currentBrewingMethod,
    onTimerComplete,
    onStatusChange,
    onStageChange,
    onComplete,
}) => {
    const [currentTime, setCurrentTime] = useState(0)
    const [isRunning, setIsRunning] = useState(false)
    const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null)
    const [showComplete, setShowComplete] = useState(false)
    const [currentWaterAmount, setCurrentWaterAmount] = useState(0)
    const [countdownTime, setCountdownTime] = useState<number | null>(null)
    const [hasStartedOnce, setHasStartedOnce] = useState(false)
    const audioRefs = useRef<{
        start: HTMLAudioElement | null
        ding: HTMLAudioElement | null
        correct: HTMLAudioElement | null
        isPlaying: {
            start: boolean
            ding: boolean
            correct: boolean
        }
    }>({
        start: null,
        ding: null,
        correct: null,
        isPlaying: {
            start: false,
            ding: false,
            correct: false
        }
    })
    const methodStagesRef = useRef(currentBrewingMethod?.params.stages || [])
    const [showNoteForm, setShowNoteForm] = useState(false)

    useEffect(() => {
        // Initialize all audio elements
        const startAudio = new Audio('/sounds/start.mp3')
        const dingAudio = new Audio('/sounds/ding.mp3')
        const correctAudio = new Audio('/sounds/correct.mp3')

        // Set volume for all audio elements
        startAudio.volume = 0.5
        dingAudio.volume = 0.5
        correctAudio.volume = 0.5

        // Set preload for all audio elements
        startAudio.preload = 'auto'
        dingAudio.preload = 'auto'
        correctAudio.preload = 'auto'

        // Add ended event listeners to reset playing state
        startAudio.addEventListener('ended', () => {
            audioRefs.current.isPlaying.start = false
        })
        dingAudio.addEventListener('ended', () => {
            audioRefs.current.isPlaying.ding = false
        })
        correctAudio.addEventListener('ended', () => {
            audioRefs.current.isPlaying.correct = false
        })

        audioRefs.current = {
            start: startAudio,
            ding: dingAudio,
            correct: correctAudio,
            isPlaying: {
                start: false,
                ding: false,
                correct: false
            }
        }

        // Add event listeners for audio initialization on user interaction
        const initAudio = () => {
            audioRefs.current = {
                start: startAudio,
                ding: dingAudio,
                correct: correctAudio,
                isPlaying: {
                    start: false,
                    ding: false,
                    correct: false
                }
            }
            document.removeEventListener('touchstart', initAudio)
            document.removeEventListener('click', initAudio)
        }
        document.addEventListener('touchstart', initAudio)
        document.addEventListener('click', initAudio)

        return () => {
            document.removeEventListener('touchstart', initAudio)
            document.removeEventListener('click', initAudio)
        }
    }, [])

    const playSound = useCallback((type: 'start' | 'ding' | 'correct') => {
        const audio = audioRefs.current[type]
        if (!audio || audioRefs.current.isPlaying[type]) return

        audioRefs.current.isPlaying[type] = true
        const playPromise = audio.play()
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    if (audio) {
                        audio.currentTime = 0
                        // Add a small delay before allowing the same sound to play again
                        setTimeout(() => {
                            audioRefs.current.isPlaying[type] = false
                        }, 100)
                    }
                })
                .catch((e) => {
                    console.log('Sound play failed:', e)
                    if (audio) {
                        audio.currentTime = 0
                        audioRefs.current.isPlaying[type] = false
                    }
                })
        }
    }, [])

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
        const pourTime = currentStage.pourTime || Math.floor((currentStage.time - prevStageTime) / 3)

        const timeInCurrentStage = currentTime - prevStageTime
        const currentTargetWater = parseInt(currentStage.water)

        if (timeInCurrentStage <= pourTime) {
            const pourProgress = timeInCurrentStage / pourTime
            return prevStageWater + (currentTargetWater - prevStageWater) * pourProgress
        }

        return currentTargetWater
    }, [currentTime, currentBrewingMethod, getCurrentStage])

    // Update methodStagesRef when currentBrewingMethod changes
    useEffect(() => {
        methodStagesRef.current = currentBrewingMethod?.params.stages || []
    }, [currentBrewingMethod])

    const clearTimerAndStates = useCallback(() => {
        if (timerId) {
            clearInterval(timerId)
            setTimerId(null)
        }
    }, [timerId])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerId) {
                clearInterval(timerId)
            }
        }
    }, [timerId])

    const handleComplete = useCallback(() => {
        clearTimerAndStates()
        setIsRunning(false)
        setShowComplete(true)
        onComplete?.(true)
        onTimerComplete?.()
        playSound('correct')
    }, [clearTimerAndStates, onComplete, onTimerComplete, playSound])

    const startMainTimer = useCallback(() => {
        if (currentBrewingMethod) {
            const id = setInterval(() => {
                setCurrentTime((time) => {
                    const stages = methodStagesRef.current
                    const newTime = time + 1
                    const lastStageIndex = stages.length - 1

                    stages.forEach((stage, index) => {
                        const prevStageTime = index > 0 ? stages[index - 1].time : 0
                        // Play ding sound at stage change (except for the last stage)
                        if (newTime === prevStageTime) {
                            playSound('ding')
                        }
                        // Play start sound at both 2 seconds and 1 second before next stage
                        // For all stages including the last one
                        const nextStageTime = stages[index].time
                        if (newTime === nextStageTime - 2 || newTime === nextStageTime - 1) {
                            playSound('start')
                        }
                    })

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

    // Update countdown timer logic
    useEffect(() => {
        if (countdownTime !== null && isRunning) {
            if (countdownTime > 0) {
                // Play start sound for each countdown second
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
                // Play ding sound when countdown ends and main timer starts
                playSound('ding')
                startMainTimer()
            }
        }
    }, [countdownTime, isRunning, playSound, startMainTimer])

    const handleSaveNote = useCallback((note: any) => {
        const notes = JSON.parse(localStorage.getItem('brewingNotes') || '[]')
        const newNote = {
            ...note,
            id: Date.now().toString(),
            timestamp: Date.now(),
        }
        localStorage.setItem('brewingNotes', JSON.stringify([newNote, ...notes]))
    }, [])

    useEffect(() => {
        if (currentTime > 0 && currentTime >= methodStagesRef.current[methodStagesRef.current.length - 1]?.time) {
            handleComplete()
        }
    }, [currentTime, handleComplete])

    const startTimer = useCallback(() => {
        if (!isRunning && currentBrewingMethod) {
            setIsRunning(true)
            if (!hasStartedOnce || currentTime === 0) {
                setCountdownTime(3)
                setHasStartedOnce(true)
                // Play start sound immediately when countdown starts
                playSound('start')
            } else {
                // Just resume the timer without any sound
                startMainTimer()
            }
        }
    }, [isRunning, currentBrewingMethod, hasStartedOnce, startMainTimer, playSound, currentTime])

    const pauseTimer = useCallback(() => {
        clearTimerAndStates()
        setIsRunning(false)
    }, [clearTimerAndStates])

    const resetTimer = useCallback(() => {
        clearTimerAndStates()
        setIsRunning(false)
        setCurrentTime(0)
        setShowComplete(false)
        setCurrentWaterAmount(0)
        setCountdownTime(null)
        setHasStartedOnce(false)
    }, [clearTimerAndStates])

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

    if (!currentBrewingMethod) return null

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="sticky bottom-0 mb-8 mx-6 border-t border-neutral-200 bg-neutral-50 pt-6 dark:border-neutral-800 dark:bg-neutral-900"
                style={{
                    willChange: "transform, opacity"
                }}
            >
                {/* Current Stage Info */}
                <div className="mb-4 space-y-3">
                    {/* Current Stage */}
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
                                transition={{ duration: 0.3 }}
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
                                    transition={{ duration: 0.2 }}
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
                                    key={`water-${currentWaterAmount}`}
                                    initial={{ opacity: 0.8 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.2 }}
                                    className="mt-1 flex flex-col text-sm font-medium tracking-wide"
                                >
                                    {currentBrewingMethod.params.stages[getCurrentStage()]?.water ? (
                                        <div className="flex items-baseline justify-end">
                                            <motion.span
                                                key={currentWaterAmount}
                                                initial={{ scale: 1.1 }}
                                                animate={{ scale: 1 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                {currentWaterAmount}
                                            </motion.span>
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

                    {/* Next Stage */}
                    <AnimatePresence mode="wait">
                        {getCurrentStage() < currentBrewingMethod.params.stages.length - 1 && (
                            <motion.div
                                key={`next-${getCurrentStage() + 1}`}
                                initial={{ opacity: 0, height: 0, y: -20 }}
                                animate={{ opacity: 1, height: 'auto', y: 0 }}
                                exit={{ opacity: 0, height: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="flex items-baseline justify-between border-l border-neutral-300 pl-3 dark:border-neutral-700"
                            >
                                <div>
                                    <div className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
                                        <span>下一步</span>
                                    </div>
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.3, delay: 0.1 }}
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
                                    transition={{ duration: 0.3, delay: 0.2 }}
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

                {/* Progress bar */}
                <div className="relative mb-4">
                    {/* Stage separators */}
                    {currentBrewingMethod.params.stages.map((stage) => {
                        const totalTime = currentBrewingMethod.params.stages[currentBrewingMethod.params.stages.length - 1].time
                        const percentage = (stage.time / totalTime) * 100
                        return (
                            <div
                                key={stage.time}
                                className="absolute top-0 h-1 w-[2px] bg-white dark:bg-neutral-900"
                                style={{ left: `${percentage}%` }}
                            />
                        )
                    })}

                    {/* Progress bar background with waiting pattern */}
                    <div className="h-1 w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                        {/* Waiting time pattern */}
                        {currentBrewingMethod.params.stages.map((stage, index) => {
                            const totalTime = currentBrewingMethod.params.stages[currentBrewingMethod.params.stages.length - 1].time
                            const prevStageTime = index > 0 ? currentBrewingMethod.params.stages[index - 1].time : 0
                            const stageStartPercentage = (prevStageTime / totalTime) * 100
                            const stageWidth = ((stage.time - prevStageTime) / totalTime) * 100
                            const pourTime = stage.pourTime || Math.floor((stage.time - prevStageTime) / 3)
                            const waitingStartPercentage = ((prevStageTime + pourTime) / totalTime) * 100
                            const waitingWidth = ((stage.time - (prevStageTime + pourTime)) / totalTime) * 100

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
                        {/* Progress overlay */}
                        <motion.div
                            className="h-full bg-neutral-800 dark:bg-neutral-100"
                            initial={{ width: 0 }}
                            animate={{
                                width: `${(currentTime / currentBrewingMethod.params.stages[currentBrewingMethod.params.stages.length - 1].time) * 100}%`,
                            }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>

                    {/* Stage time indicators */}
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

                {/* Timer controls */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 sm:space-x-6">
                        <div className="relative text-2xl font-light tracking-widest text-neutral-800 sm:text-3xl dark:text-neutral-100">
                            <AnimatePresence mode="wait">
                                {countdownTime !== null ? (
                                    <motion.div
                                        key="countdown"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="absolute left-0 min-w-[5ch] text-left"
                                    >
                                        {countdownTime}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="timer"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="absolute left-0 min-w-[5ch] text-left"
                                    >
                                        {formatTime(currentTime)}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div className="invisible min-w-[5ch] text-left">
                                {formatTime(currentTime)}
                            </div>
                        </div>
                        <div className="flex items-center space-x-3 text-[10px] tracking-widest text-neutral-400 sm:space-x-4 sm:text-xs dark:text-neutral-500">
                            <button
                                onClick={isRunning ? pauseTimer : startTimer}
                                className={`transition-colors ${showComplete
                                    ? 'cursor-not-allowed text-neutral-300 dark:text-neutral-700'
                                    : 'hover:text-neutral-800 dark:hover:text-neutral-300'
                                    }`}
                                disabled={showComplete}
                            >
                                [ {isRunning ? '暂停' : '开始'} ]
                            </button>
                            <button
                                onClick={resetTimer}
                                className="transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
                            >
                                [ 重置 ]
                            </button>
                        </div>
                    </div>
                    <div className="text-[10px] tracking-widest text-neutral-400 sm:text-xs dark:text-neutral-500">
                        {showComplete && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                COMPLETE
                            </motion.div>
                        )}
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
                        transition={{ duration: 0.3 }}
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
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

export default BrewingTimer 