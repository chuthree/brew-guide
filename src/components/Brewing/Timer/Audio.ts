// 音频相关功能模块

/**
 * 音频状态接口
 */
export interface AudioState {
  audioContext: AudioContext | null;
  buffers: {
    start: AudioBuffer | null;
    ding: AudioBuffer | null;
    correct: AudioBuffer | null;
  };
  lastPlayedTime: {
    start: number;
    ding: number;
    correct: number;
  };
  loaded: boolean;
}

/**
 * 创建初始音频状态
 */
export const createInitialAudioState = (): AudioState => ({
  audioContext: null,
  buffers: {
    start: null,
    ding: null,
    correct: null,
  },
  lastPlayedTime: {
    start: 0,
    ding: 0,
    correct: 0,
  },
  loaded: false,
});

/**
 * 初始化音频系统
 */
export const initAudioSystem = async (
  audioState: AudioState
): Promise<AudioState> => {
  try {
    if (typeof window === "undefined" || !("AudioContext" in window)) {
      return audioState;
    }

    // 如果已经初始化，则直接返回
    if (audioState.audioContext) {
      return audioState;
    }

    const newState = { ...audioState };
    newState.audioContext = new AudioContext();
    
    // 加载音频文件
    try {
      const [startBuffer, dingBuffer, correctBuffer] = await Promise.all([
        fetchAudio("/sounds/start.mp3", newState.audioContext),
        fetchAudio("/sounds/ding.mp3", newState.audioContext),
        fetchAudio("/sounds/correct.mp3", newState.audioContext),
      ]);

      newState.buffers = {
        start: startBuffer,
        ding: dingBuffer,
        correct: correctBuffer,
      };
      newState.loaded = true;
    } catch {
      console.warn("加载音频文件失败");
    }

    return newState;
  } catch {
    console.warn("初始化音频系统失败");
    return audioState;
  }
};

/**
 * 获取音频文件并解码
 */
const fetchAudio = async (
  url: string,
  audioContext: AudioContext
): Promise<AudioBuffer> => {
  const response = await fetch(url, { cache: "force-cache" });
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
};

/**
 * 恢复AudioContext播放
 */
export const resumeAudioContext = (audioState: AudioState): void => {
  if (audioState.audioContext?.state === "suspended") {
    audioState.audioContext.resume().catch(() => {
      // 静默处理错误
    });
  }
};

/**
 * 清理音频系统
 */
export const cleanupAudioSystem = (audioState: AudioState): void => {
  if (audioState.audioContext) {
    audioState.audioContext.close().catch(() => {
      // 静默处理错误
    });
  }
};

/**
 * 播放音效
 */
export const playSound = (
  type: "start" | "ding" | "correct",
  audioState: AudioState,
  enabled: boolean = true
): void => {
  if (!enabled || !audioState.audioContext || !audioState.buffers[type]) {
    return;
  }

  resumeAudioContext(audioState);

  const now = Date.now();
  if (now - audioState.lastPlayedTime[type] < 300) {
    return;
  }

  try {
    const source = audioState.audioContext.createBufferSource();
    source.buffer = audioState.buffers[type];

    const gainNode = audioState.audioContext.createGain();
    gainNode.gain.value = 0.5;

    source.connect(gainNode);
    gainNode.connect(audioState.audioContext.destination);

    source.start(0);

    // 更新最后播放时间
    audioState.lastPlayedTime[type] = now;
  } catch {
    // 静默处理播放失败
  }
}; 