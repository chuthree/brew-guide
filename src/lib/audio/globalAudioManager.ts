// 全局音频管理器，确保音频播放不被页面切换打断

import { createInitialAudioState, initAudioSystem, playSound, type AudioState } from '@/components/brewing/Timer/Audio';

class GlobalAudioManager {
  private static instance: GlobalAudioManager;
  private audioState: AudioState;
  private initialized: boolean = false;

  private constructor() {
    this.audioState = createInitialAudioState();
  }

  public static getInstance(): GlobalAudioManager {
    if (!GlobalAudioManager.instance) {
      GlobalAudioManager.instance = new GlobalAudioManager();
    }
    return GlobalAudioManager.instance;
  }

  public async initialize(): Promise<void> {
    if (!this.initialized) {
      this.audioState = await initAudioSystem(this.audioState);
      this.initialized = true;
    }
  }

  public playSound(type: "start" | "ding" | "correct", enabled: boolean = true): void {
    if (this.initialized) {
      playSound(type, this.audioState, enabled);
    }
  }

  public getActiveSourcesCount(): number {
    return this.audioState.activeSources?.length || 0;
  }

  public isAudioPlaying(): boolean {
    return this.getActiveSourcesCount() > 0;
  }

  // 等待所有音频播放完毕
  public async waitForAudioCompletion(maxWaitTime: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkCompletion = () => {
        const elapsed = Date.now() - startTime;
        
        if (!this.isAudioPlaying() || elapsed >= maxWaitTime) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      
      checkCompletion();
    });
  }

  // 强制清理（仅在应用关闭时使用）
  public forceCleanup(): void {
    if (this.audioState.audioContext) {
      // 停止所有活跃的音频源
      this.audioState.activeSources?.forEach(source => {
        try {
          source.stop();
        } catch {
          // 静默处理错误
        }
      });
      
      // 清空活跃源列表
      if (this.audioState.activeSources) {
        this.audioState.activeSources = [];
      }
      
      // 关闭音频上下文
      this.audioState.audioContext.close().catch(() => {
        // 静默处理错误
      });
      
      this.initialized = false;
    }
  }
}

// 导出单例实例
export const globalAudioManager = GlobalAudioManager.getInstance();

// 在页面卸载时清理音频（仅作为最后的保障）
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // 不立即清理，让音频有机会播放完毕
    setTimeout(() => {
      globalAudioManager.forceCleanup();
    }, 5000);
  });
}
