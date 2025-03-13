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

    useEffect(() => {
        const initAudioSystem = () => {
            try {
                if (typeof AudioContext !== 'undefined') {
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
                            console.log('音频文件加载完成')
                        } catch (error) {
                            console.error('加载音频文件失败:', error)
                        }
                    }

                    loadAudio()
                } else {
                    console.warn('浏览器不支持 Web Audio API，将使用备用方案')
                }
            } catch (error) {
                console.error('初始化音频系统失败:', error)
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
        if (!audioContext.current || !audioBuffers.current[type]) {
            console.warn(`无法播放音效 ${type}: 音频系统未初始化或音频文件未加载`)
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
        } catch (error) {
            console.error(`播放音效 ${type} 失败:`, error)
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
            } else {
                startMainTimer()
            }
        }
    }, [isRunning, currentBrewingMethod, hasStartedOnce, startMainTimer, currentTime])

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
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="sticky bottom-0 mb-9 border-t border-neutral-200 bg-neutral-50 pt-6 dark:border-neutral-800 dark:bg-neutral-900"
                style={{
                    willChange: "transform, opacity"
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
                                    key={`water-${getCurrentStage()}`}
                                    initial={{ opacity: 0.8 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.2 }}
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

                <div className="relative mb-4">
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

                    <div className="h-1 w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
                        {currentBrewingMethod.params.stages.map((stage, index) => {
                            const totalTime = currentBrewingMethod.params.stages[currentBrewingMethod.params.stages.length - 1].time
                            const prevStageTime = index > 0 ? currentBrewingMethod.params.stages[index - 1].time : 0
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
                        <motion.div
                            className="h-full bg-neutral-800 dark:bg-neutral-100"
                            initial={{ width: 0 }}
                            animate={{
                                width: `${(currentTime / currentBrewingMethod.params.stages[currentBrewingMethod.params.stages.length - 1].time) * 100}%`,
                            }}
                            transition={{ duration: 0.3 }}
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
                                            transition={{ duration: 0.2 }}
                                            className="min-w-[5ch] text-left"
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
                                    <span className="text-sm text-neutral-400 dark:text-neutral-500 ml-1">ml</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4 sm:space-x-6">
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