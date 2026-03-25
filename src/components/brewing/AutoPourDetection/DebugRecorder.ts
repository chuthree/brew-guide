import type {
  DetectionResult,
  DetectionConfig,
  StateMachineState,
  MotionAnalysis,
  StateMachineDebugInfo,
} from './types';

export interface FrameDebugRecord {
  frameIndex: number;
  timestamp: number;
  elapsedMs: number;
  state: StateMachineState;
  previousState: StateMachineState | null;
  isStateTransition: boolean;
  transitionReason: string;
  consecutiveCount: number;
  hasMotion: boolean;
  isPouring: boolean;
  shouldTrigger: boolean;
  processingTimeMs: number;
  motionAnalysis: MotionAnalysis | null;
  stateMachineDebug: StateMachineDebugInfo | null;
}

export interface StateTransitionEvent {
  frameIndex: number;
  timestamp: number;
  elapsedMs: number;
  fromState: StateMachineState;
  toState: StateMachineState;
  reason: string;
  consecutiveCount: number;
}

export interface DetectionEvent {
  frameIndex: number;
  timestamp: number;
  elapsedMs: number;
  timeToDetection: number;
  framesToDetection: number;
  motionAnalysis: MotionAnalysis;
  stateMachineDebug: StateMachineDebugInfo | null;
}

export interface RecordingSession {
  id: string;
  startTime: number;
  endTime: number | null;
  totalFrames: number;
  durationMs: number;
  config: DetectionConfig;
  frames: FrameDebugRecord[];
  stateTransitions: StateTransitionEvent[];
  detectionEvents: DetectionEvent[];
}

export interface StructuredReport {
  rawText: string;
  json: string;
  session: RecordingSession;
}

export default class DebugRecorder {
  private _session: RecordingSession | null = null;
  private _isRecording = false;
  private _frameIndex = 0;
  private _firstMotionFrame: number | null = null;
  private _firstMotionTime: number | null = null;

  startRecording(config: DetectionConfig): void {
    const now = Date.now();
    this._session = {
      id: `session_${now}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: now,
      endTime: null,
      totalFrames: 0,
      durationMs: 0,
      config: { ...config },
      frames: [],
      stateTransitions: [],
      detectionEvents: [],
    };
    this._isRecording = true;
    this._frameIndex = 0;
    this._firstMotionFrame = null;
    this._firstMotionTime = null;
  }

  stopRecording(): void {
    if (this._session) {
      this._session.endTime = Date.now();
      this._session.durationMs =
        this._session.endTime - this._session.startTime;
    }
    this._isRecording = false;
  }

  recordFrame(params: {
    detectionResult: DetectionResult;
    stateTransition?: {
      previousState: StateMachineState;
      transitionReason: string;
    } | null;
  }): void {
    if (!this._isRecording || !this._session) return;

    const { detectionResult, stateTransition } = params;
    const timestamp = Date.now();
    const elapsedMs = timestamp - this._session.startTime;

    if (detectionResult.hasMotion && this._firstMotionFrame === null) {
      this._firstMotionFrame = this._frameIndex;
      this._firstMotionTime = timestamp;
    }

    const previousState = stateTransition?.previousState ?? null;
    const isStateTransition =
      stateTransition !== null && stateTransition !== undefined;

    const frameRecord: FrameDebugRecord = {
      frameIndex: this._frameIndex,
      timestamp,
      elapsedMs,
      state: detectionResult.currentState,
      previousState,
      isStateTransition,
      transitionReason: stateTransition?.transitionReason ?? '',
      consecutiveCount: detectionResult.consecutiveCount,
      hasMotion: detectionResult.hasMotion,
      isPouring: detectionResult.motionAnalysis?.isKettleTilt ?? false,
      shouldTrigger: detectionResult.shouldTrigger,
      processingTimeMs: detectionResult.processingTime,
      motionAnalysis: detectionResult.motionAnalysis,
      stateMachineDebug: detectionResult.stateMachineDebug ?? null,
    };

    this._session.frames.push(frameRecord);
    this._session.totalFrames = this._session.frames.length;

    if (isStateTransition && previousState) {
      const transitionEvent: StateTransitionEvent = {
        frameIndex: this._frameIndex,
        timestamp,
        elapsedMs,
        fromState: previousState,
        toState: detectionResult.currentState,
        reason: stateTransition.transitionReason,
        consecutiveCount: detectionResult.consecutiveCount,
      };
      this._session.stateTransitions.push(transitionEvent);
    }

    if (detectionResult.shouldTrigger) {
      const timeToDetection =
        this._firstMotionTime !== null ? timestamp - this._firstMotionTime : 0;
      const framesToDetection =
        this._firstMotionFrame !== null
          ? this._frameIndex - this._firstMotionFrame
          : 0;

      const detectionEvent: DetectionEvent = {
        frameIndex: this._frameIndex,
        timestamp,
        elapsedMs,
        timeToDetection,
        framesToDetection,
        motionAnalysis: detectionResult.motionAnalysis!,
        stateMachineDebug: detectionResult.stateMachineDebug ?? null,
      };
      this._session.detectionEvents.push(detectionEvent);
    }

    this._frameIndex++;
  }

  exportToStructuredText(): StructuredReport {
    if (!this._session) {
      throw new Error('No recording session available');
    }

    const session = this._session;
    const lines: string[] = [];

    lines.push(
      '╔══════════════════════════════════════════════════════════════════╗'
    );
    lines.push(
      '║           AUTO POUR DETECTION - DEBUG RECORDING REPORT           ║'
    );
    lines.push(
      '╚══════════════════════════════════════════════════════════════════╝'
    );
    lines.push('');

    lines.push('📊 SESSION INFORMATION');
    lines.push(
      '────────────────────────────────────────────────────────────────────'
    );
    lines.push(`Session ID:        ${session.id}`);
    lines.push(
      `Start Time:        ${new Date(session.startTime).toISOString()}`
    );
    lines.push(`Duration:          ${session.durationMs}ms`);
    lines.push(`Total Frames:      ${session.totalFrames}`);
    const avgFps =
      session.durationMs > 0
        ? Math.round((session.totalFrames / session.durationMs) * 1000)
        : 0;
    lines.push(`Avg Frame Rate:    ${avgFps} FPS`);
    lines.push('');

    lines.push('⚙️  CONFIGURATION');
    lines.push(
      '────────────────────────────────────────────────────────────────────'
    );
    lines.push(`Sensitivity:                 ${session.config.sensitivity}`);
    lines.push(
      `Frame Diff Threshold:        ${session.config.frameDiffThreshold}`
    );
    lines.push(`Min Motion Ratio:            ${session.config.minMotionRatio}`);
    lines.push(`Max Motion Ratio:            ${session.config.maxMotionRatio}`);
    lines.push(
      `Required Consecutive Detections: ${session.config.requiredConsecutiveDetections}`
    );
    lines.push(`State Timeout:               ${session.config.stateTimeout}ms`);
    lines.push('');

    lines.push('📈 SUMMARY STATISTICS');
    lines.push(
      '────────────────────────────────────────────────────────────────────'
    );
    lines.push(
      `Total State Transitions:     ${session.stateTransitions.length}`
    );
    lines.push(
      `Total Detection Events:      ${session.detectionEvents.length}`
    );
    lines.push('');

    lines.push('Time in Each State:');
    const stateDurations = this._calculateStateDurations(session);
    for (const [state, duration] of Object.entries(stateDurations)) {
      const percentage =
        session.durationMs > 0
          ? Math.round((duration / session.durationMs) * 100)
          : 0;
      lines.push(
        `  ${state.padEnd(15)} ${duration.toString().padStart(6)}ms (${percentage}%)`
      );
    }
    lines.push('');

    if (session.stateTransitions.length > 0) {
      lines.push('🔄 STATE TRANSITIONS');
      lines.push(
        '────────────────────────────────────────────────────────────────────'
      );
      for (const transition of session.stateTransitions) {
        const timeStr = transition.elapsedMs.toString().padStart(6);
        const frameStr = transition.frameIndex.toString().padStart(4);
        const fromStr = transition.fromState.padEnd(12);
        const toStr = transition.toState.padEnd(12);
        lines.push(
          `[${timeStr}ms] Frame ${frameStr}: ${fromStr} → ${toStr} | Reason: ${transition.reason}`
        );
      }
      lines.push('');
    }

    if (session.detectionEvents.length > 0) {
      lines.push('☕ DETECTION EVENTS (POURING DETECTED)');
      lines.push(
        '────────────────────────────────────────────────────────────────────'
      );
      for (const event of session.detectionEvents) {
        const timeStr = event.elapsedMs.toString().padStart(6);
        const frameStr = event.frameIndex.toString().padStart(4);
        lines.push(`[${timeStr}ms] Frame ${frameStr}:`);
        lines.push(
          `  Time to Detection:  ${event.timeToDetection}ms (${event.framesToDetection} frames from first motion)`
        );

        const ma = event.motionAnalysis;
        lines.push(`  Rotation Score:     ${ma.rotationScore.toFixed(4)}`);
        lines.push(
          `  Translation Score:  ${ma.translationScore?.toFixed(4) ?? 'N/A'}`
        );
        lines.push(
          `  Valley Depth:       ${ma.velocityRatio?.toFixed(4) ?? 'N/A'}`
        );
        lines.push(`  Has Rotation:       ${ma.hasRotation ? 'YES' : 'NO'}`);
        lines.push(`  Is Kettle Tilt:     ${ma.isKettleTilt ? 'YES' : 'NO'}`);
        lines.push(`  Tilt Signal:        ${ma.tiltSignal.toFixed(4)}`);
        lines.push(`  Tilt Consistency:   ${ma.tiltConsistency.toFixed(2)}`);

        if (event.stateMachineDebug) {
          lines.push(
            `  Stability Score:    ${event.stateMachineDebug.stabilityScore}`
          );
          lines.push(
            `  Soft Counter:       ${event.stateMachineDebug.softCounter.toFixed(1)}`
          );
        }
        lines.push('');
      }
    }

    lines.push('🔄 TRANSLATION vs ROTATION ANALYSIS');
    lines.push(
      '────────────────────────────────────────────────────────────────────'
    );
    lines.push(
      'Frame | Time     | RotScore | TrScore | Valley | isTrans | Pixels'
    );
    lines.push(
      '──────┼──────────┼──────────┼─────────┼────────┼─────────┼─────────'
    );

    for (let i = 0; i < session.frames.length; i++) {
      const frame = session.frames[i];
      if (
        !frame.motionAnalysis ||
        frame.motionAnalysis.totalMotionPixels === 0
      ) {
        continue;
      }

      const ma = frame.motionAnalysis;
      const frameStr = i.toString().padStart(5);
      const timeStr = frame.elapsedMs.toString().padStart(8) + 'ms';
      const rotScore = ma.rotationScore.toFixed(4).padStart(8);
      const trScore = (ma.translationScore ?? 0).toFixed(4).padStart(7);
      const valley = (ma.velocityRatio ?? 0).toFixed(4).padStart(6);
      const isTrans = (ma.translationScore ?? 0) > 0.52 ? 'YES    ' : 'NO     ';
      const pixels = ma.totalMotionPixels.toString().padStart(7);

      lines.push(
        `${frameStr} | ${timeStr} | ${rotScore} | ${trScore} | ${valley} | ${isTrans} | ${pixels}`
      );
    }
    lines.push('');
    lines.push('Notes:');
    lines.push(
      '  - RotScore: Rotation score (>= 0.2 triggers motion detection)'
    );
    lines.push(
      '  - TrScore: Translation score (> 0.52 indicates translation motion)'
    );
    lines.push(
      '  - Valley: Valley depth from histogram analysis (> 0.52 = translation)'
    );
    lines.push(
      '  - isTrans: Is motion classified as translation (blocks rotation detection)'
    );
    lines.push('');

    lines.push('🎬 KEY FRAME ANALYSIS');
    lines.push(
      '────────────────────────────────────────────────────────────────────'
    );
    lines.push(
      'Frame | Time     | State       | Motion | Score | Consec | Key Metrics'
    );
    lines.push(
      '──────┼──────────┼─────────────┼────────┼───────┼────────┼─────────────────────────────────────────────────'
    );

    const sampleInterval = Math.max(1, Math.floor(session.frames.length / 50));
    const importantFrames = new Set<number>();

    for (const t of session.stateTransitions) {
      importantFrames.add(t.frameIndex);
    }

    for (const e of session.detectionEvents) {
      importantFrames.add(e.frameIndex);
    }

    for (let i = 0; i < session.frames.length; i++) {
      const frame = session.frames[i];
      const isImportant =
        importantFrames.has(i) ||
        i % sampleInterval === 0 ||
        i === session.frames.length - 1;

      if (!isImportant) continue;

      const frameStr = i.toString().padStart(5);
      const timeStr = frame.elapsedMs.toString().padStart(8) + 'ms';
      const stateStr = frame.state.padEnd(11);
      const motionStr = frame.hasMotion ? '  YES  ' : '   no  ';
      const scoreStr = frame.motionAnalysis
        ? (frame.motionAnalysis.motionScore * 100).toFixed(0).padStart(3) + '%'
        : '   -';
      const consecStr = frame.consecutiveCount.toString().padStart(6);

      let metrics = '';
      if (frame.motionAnalysis) {
        const ma = frame.motionAnalysis;
        const pixels = ma.totalMotionPixels.toString().padStart(3);
        const tr = (ma.translationScore ?? 0).toFixed(2);
        const rot = ma.rotationScore.toFixed(2);
        const valley = (ma.velocityRatio ?? 0).toFixed(2);
        metrics = `pixels=${pixels} tr=${tr} rot=${rot} valley=${valley}`;
      }

      lines.push(
        `${frameStr} | ${timeStr} | ${stateStr} | ${motionStr} | ${scoreStr} | ${consecStr} | ${metrics}`
      );
    }

    lines.push('');

    lines.push('📋 DETAILED FRAME DATA (JSON)');
    lines.push(
      '────────────────────────────────────────────────────────────────────'
    );
    lines.push('```json');
    const jsonData = this._exportToJSON();
    lines.push(jsonData);
    lines.push('```');

    lines.push('');
    lines.push(
      '════════════════════════════════════════════════════════════════════'
    );
    lines.push('END OF REPORT');
    lines.push(
      '════════════════════════════════════════════════════════════════════'
    );

    const rawText = lines.join('\n');

    return {
      rawText,
      json: jsonData,
      session: { ...session },
    };
  }

  private _exportToJSON(): string {
    if (!this._session) return '{}';

    const exportData = {
      session: {
        id: this._session.id,
        startTime: this._session.startTime,
        endTime: this._session.endTime,
        durationMs: this._session.durationMs,
        totalFrames: this._session.totalFrames,
        config: this._session.config,
      },
      summary: {
        stateTransitions: this._session.stateTransitions,
        detectionEvents: this._session.detectionEvents.map(e => ({
          frameIndex: e.frameIndex,
          timestamp: e.timestamp,
          elapsedMs: e.elapsedMs,
          timeToDetection: e.timeToDetection,
          framesToDetection: e.framesToDetection,
          keyMetrics: {
            rotationScore: e.motionAnalysis.rotationScore,
            translationScore: e.motionAnalysis.translationScore,
            valleyDepth: e.motionAnalysis.velocityRatio,
            tiltSignal: e.motionAnalysis.tiltSignal,
            tiltConsistency: e.motionAnalysis.tiltConsistency,
            isKettleTilt: e.motionAnalysis.isKettleTilt,
            hasRotation: e.motionAnalysis.hasRotation,
            stabilityScore: e.stateMachineDebug?.stabilityScore,
            softCounter: e.stateMachineDebug?.softCounter,
          },
        })),
      },
      frames: this._session.frames.map(f => ({
        frameIndex: f.frameIndex,
        timestamp: f.timestamp,
        elapsedMs: f.elapsedMs,
        state: f.state,
        previousState: f.previousState,
        isStateTransition: f.isStateTransition,
        transitionReason: f.transitionReason,
        consecutiveCount: f.consecutiveCount,
        hasMotion: f.hasMotion,
        isPouring: f.isPouring,
        shouldTrigger: f.shouldTrigger,
        processingTimeMs: f.processingTimeMs,
        motionAnalysis: f.motionAnalysis
          ? {
              motionScore: f.motionAnalysis.motionScore,
              rotationScore: f.motionAnalysis.rotationScore,
              translationScore: f.motionAnalysis.translationScore,
              valleyDepth: f.motionAnalysis.velocityRatio,
              tiltSignal: f.motionAnalysis.tiltSignal,
              tiltConsistency: f.motionAnalysis.tiltConsistency,
              isKettleTilt: f.motionAnalysis.isKettleTilt,
              hasRotation: f.motionAnalysis.hasRotation,
              totalMotionPixels: f.motionAnalysis.totalMotionPixels,
              motionRegion: f.motionAnalysis.motionRegion,
              rotationEvidence: f.motionAnalysis.rotationEvidence,
              gradientStability: f.motionAnalysis.gradientStability,
              asymmetryScore: f.motionAnalysis.asymmetryScore,
              topPixelCount: f.motionAnalysis.topPixelCount,
              bottomPixelCount: f.motionAnalysis.bottomPixelCount,
            }
          : null,
        stateMachineDebug: f.stateMachineDebug,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  private _calculateStateDurations(
    session: RecordingSession
  ): Record<string, number> {
    const durations: Record<string, number> = {
      idle: 0,
      monitoring: 0,
      preparing: 0,
      triggered: 0,
    };

    if (session.frames.length === 0) return durations;

    let currentState = session.frames[0].state;
    let stateStartTime = session.frames[0].elapsedMs;

    for (let i = 1; i < session.frames.length; i++) {
      const frame = session.frames[i];
      if (frame.state !== currentState) {
        durations[currentState] += frame.elapsedMs - stateStartTime;
        currentState = frame.state;
        stateStartTime = frame.elapsedMs;
      }
    }

    const lastFrame = session.frames[session.frames.length - 1];
    durations[currentState] += lastFrame.elapsedMs - stateStartTime;

    return durations;
  }

  getSession(): RecordingSession | null {
    return this._session ? { ...this._session } : null;
  }

  isRecording(): boolean {
    return this._isRecording;
  }

  clear(): void {
    this._session = null;
    this._isRecording = false;
    this._frameIndex = 0;
    this._firstMotionFrame = null;
    this._firstMotionTime = null;
  }
}
