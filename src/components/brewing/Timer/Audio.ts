type TimerSound = 'start' | 'ding' | 'correct';

const SOUND_URLS: Record<TimerSound, string> = {
  start: '/sounds/start.mp3',
  ding: '/sounds/ding.mp3',
  correct: '/sounds/correct.mp3',
};

const SOUND_VOLUME = 0.5;
const MIN_REPLAY_INTERVAL = 180;

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

class TimerAudio {
  private context: AudioContext | null = null;
  private buffers = new Map<TimerSound, AudioBuffer>();
  private readyPromise: Promise<void> | null = null;
  private lastPlayedAt = new Map<TimerSound, number>();
  private listenersAttached = false;

  initialize(): Promise<void> {
    if (!this.canUseAudio()) {
      return Promise.resolve();
    }

    this.attachLifecycleListeners();
    return this.load().catch(() => {
      this.readyPromise = null;
    });
  }

  async play(sound: TimerSound, enabled = true): Promise<void> {
    if (!enabled || !this.canUseAudio() || this.isThrottled(sound)) {
      return;
    }

    try {
      this.attachLifecycleListeners();
      await this.load();
      const context = this.context;
      const buffer = this.buffers.get(sound);

      if (!context || !buffer) {
        return;
      }

      await this.resume();

      if (context.state !== 'running') {
        return;
      }

      const source = context.createBufferSource();
      const gain = context.createGain();

      source.buffer = buffer;
      gain.gain.setValueAtTime(SOUND_VOLUME, context.currentTime);

      source.connect(gain);
      gain.connect(context.destination);
      source.addEventListener(
        'ended',
        () => {
          source.disconnect();
          gain.disconnect();
        },
        { once: true }
      );

      source.start();
      this.lastPlayedAt.set(sound, performance.now());
    } catch {
      this.readyPromise = null;
    }
  }

  async resume(): Promise<void> {
    const context = this.context;

    if (!context || context.state === 'closed' || context.state === 'running') {
      return;
    }

    try {
      await context.resume();
    } catch {
      // Browsers may reject resume() until the next user activation.
    }
  }

  private load(): Promise<void> {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = this.loadBuffers().catch(error => {
      this.readyPromise = null;
      throw error;
    });

    return this.readyPromise;
  }

  private async loadBuffers(): Promise<void> {
    const context = this.getContext();

    if (!context) {
      return;
    }

    const entries = await Promise.all(
      (Object.entries(SOUND_URLS) as [TimerSound, string][]).map(
        async ([sound, url]) => {
          const response = await fetch(url, { cache: 'force-cache' });

          if (!response.ok) {
            throw new Error(`Failed to load sound: ${url}`);
          }

          const data = await response.arrayBuffer();
          const buffer = await context.decodeAudioData(data);

          return [sound, buffer] as const;
        }
      )
    );

    this.buffers = new Map(entries);
  }

  private getContext(): AudioContext | null {
    if (this.context?.state === 'closed') {
      this.context = null;
      this.buffers.clear();
      this.readyPromise = null;
    }

    if (!this.context) {
      const AudioContextConstructor =
        window.AudioContext || (window as AudioWindow).webkitAudioContext;

      if (!AudioContextConstructor) {
        return null;
      }

      this.context = new AudioContextConstructor();
    }

    return this.context;
  }

  private attachLifecycleListeners(): void {
    if (this.listenersAttached || typeof document === 'undefined') {
      return;
    }

    this.listenersAttached = true;

    const resume = () => {
      void this.resume();
    };

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        resume();
      }
    });
    document.addEventListener('pointerdown', resume, {
      capture: true,
      passive: true,
    });
    document.addEventListener('keydown', resume, {
      capture: true,
      passive: true,
    });
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
  }

  private canUseAudio(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof document !== 'undefined' &&
      Boolean(window.AudioContext || (window as AudioWindow).webkitAudioContext)
    );
  }

  private isThrottled(sound: TimerSound): boolean {
    const lastPlayedAt = this.lastPlayedAt.get(sound) ?? 0;
    return performance.now() - lastPlayedAt < MIN_REPLAY_INTERVAL;
  }
}

const timerAudio = new TimerAudio();

export type { TimerSound };

export const initializeTimerAudio = (): Promise<void> => timerAudio.initialize();

export const unlockTimerAudio = (): Promise<void> => timerAudio.resume();

export const playTimerSound = (
  sound: TimerSound,
  enabled = true
): void => {
  void timerAudio.play(sound, enabled);
};
