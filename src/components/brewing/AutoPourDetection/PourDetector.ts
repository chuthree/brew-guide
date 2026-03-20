/**
 * PourDetector
 *
 * Two-layer pipeline coordinator that orchestrates frame difference detection (Layer 1)
 * and state machine (Layer 2) to detect pouring motion and trigger the timer.
 */

import FrameDiffDetector from './FrameDiffDetector';
import DetectionStateMachine from './DetectionStateMachine';
import type {
  VideoFrame,
  DetectionConfig,
  DetectionResult,
  DetectionStatus,
  MotionAnalysis,
  StateMachineEvent,
  StateTransitionResult,
} from './types';

export default class PourDetector {
  private _frameDiff: FrameDiffDetector;
  private _stateMachine: DetectionStateMachine;
  private _config: DetectionConfig;
  private _onPourDetected: (() => void) | null = null;
  private _isActive = false;
  private _previousFrame: ImageData | null = null;
  private _frameCount = 0;
  private _layer1Times: number[] = [];
  private _layer2Times: number[] = [];
  private _droppedFrames = 0;
  private _lastFrameTime = 0;
  private _hasTriggered = false;

  constructor(config: DetectionConfig) {
    this._config = config;
    this._frameDiff = new FrameDiffDetector();
    this._stateMachine = new DetectionStateMachine({
      requiredConsecutiveDetections: config.requiredConsecutiveDetections,
      stateTimeout: config.stateTimeout,
      cooldownDuration: config.cooldownDuration,
    });
  }

  /**
   * Start detection
   */
  startDetection(config?: DetectionConfig): void {
    if (config) {
      this._config = config;
      this._stateMachine = new DetectionStateMachine({
        requiredConsecutiveDetections: config.requiredConsecutiveDetections,
        stateTimeout: config.stateTimeout,
        cooldownDuration: config.cooldownDuration,
      });
    }

    this._isActive = true;
    this._hasTriggered = false;
    this._frameCount = 0;
    this._layer1Times = [];
    this._layer2Times = [];
    this._droppedFrames = 0;
    this._previousFrame = null;
    this._lastFrameTime = Date.now();
  }

  /**
   * Stop detection
   */
  stopDetection(): void {
    this._isActive = false;
    this._previousFrame = null;
  }

  /**
   * Process a single video frame through the two-layer pipeline
   */
  processFrame(frame: VideoFrame): DetectionResult {
    const startTime = performance.now();

    // Default result
    const defaultResult: DetectionResult = {
      hasMotion: false,
      motionScore: 0,
      isDownward: false,
      motionRegion: 'middle',
      currentState: this._stateMachine.getState(),
      shouldTrigger: false,
      consecutiveCount: this._stateMachine.getConsecutiveCount(),
      timestamp: frame.timestamp,
      processingTime: 0,
      motionAnalysis: null,
    };

    if (!this._isActive) {
      return defaultResult;
    }

    this._frameCount++;

    // Update FPS calculation
    const now = Date.now();
    if (this._lastFrameTime > 0) {
      const frameInterval = now - this._lastFrameTime;
      if (frameInterval > 100) {
        // Frame was dropped (took more than 100ms)
        this._droppedFrames++;
      }
    }
    this._lastFrameTime = now;

    // Layer 1: Frame difference detection
    const layer1Start = performance.now();

    let motionAnalysis: MotionAnalysis = {
      hasMotion: false,
      isDownward: false,
      motionScore: 0,
      verticalBias: 0,
      motionRegion: 'middle',
      areaChangeRatio: 0,
      isLargeSceneChange: false,
      totalMotionPixels: 0,
      motionCenterX: 0.5,
      motionCenterY: 0.5,
      boundingBoxArea: 0,
      boundingBoxWidth: 0,
      boundingBoxHeight: 0,
      boundingBoxAspectRatio: 1,
      centerYDisplacement: 0,
      centerYHistory: [],
      downwardVelocity: 0,
      isKettleTilt: false,
      kettleTiltConfidence: 0,
      hasRotation: false,
      rotationScore: 0,
      topCenterY: 0.25,
      bottomCenterY: 0.75,
      centerYDiff: 0,
      verticalGradient: 0,
      asymmetryScore: 0,
      topPixelCount: 0,
      bottomPixelCount: 0,
      tiltSignal: 0,
      tiltConsistency: 0,
    };

    let isLargeSceneChange = false;

    if (this._previousFrame) {
      const frameDiffResult = this._frameDiff.computeFrameDiff(
        frame.data,
        this._previousFrame
      );

      isLargeSceneChange = frameDiffResult.isLargeSceneChange;

      if (
        !isLargeSceneChange &&
        frameDiffResult.motionRatio >= this._config.minMotionRatio
      ) {
        motionAnalysis = this._frameDiff.detectDownwardMotion(
          frameDiffResult.diffMap,
          this._config.frameDiffThreshold
        );
        // Preserve isLargeSceneChange from frame diff result
        motionAnalysis.isLargeSceneChange = isLargeSceneChange;
      }
    }

    const layer1Time = performance.now() - layer1Start;
    this._layer1Times.push(layer1Time);
    if (this._layer1Times.length > 30) {
      this._layer1Times.shift();
    }

    // Layer 2: State machine transition (only if not large scene change)
    const layer2Start = performance.now();
    let stateResult: StateTransitionResult = {
      previousState: this._stateMachine.getState(),
      currentState: this._stateMachine.getState(),
      shouldTriggerTimer: false,
      consecutiveCount: this._stateMachine.getConsecutiveCount(),
      transitionReason: '',
    };

    if (isLargeSceneChange) {
      // Large scene change - reset state machine
      const event: StateMachineEvent = {
        type: 'scene_change',
        motionScore: 0,
        isDownward: false,
        motionRegion: 'middle',
        timestamp: frame.timestamp,
        isKettleTilt: false,
        kettleTiltConfidence: 0,
      };
      stateResult = this._stateMachine.transition(event);
    } else if (!motionAnalysis.hasMotion) {
      // No motion detected
      const event: StateMachineEvent = {
        type: 'no_motion',
        motionScore: motionAnalysis.motionScore,
        isDownward: motionAnalysis.isDownward,
        motionRegion: motionAnalysis.motionRegion,
        timestamp: frame.timestamp,
        isKettleTilt: motionAnalysis.isKettleTilt,
        kettleTiltConfidence: motionAnalysis.kettleTiltConfidence,
      };
      stateResult = this._stateMachine.transition(event);
    } else {
      // Motion detected - send to state machine
      const event: StateMachineEvent = {
        type: 'motion_detected',
        motionScore: motionAnalysis.motionScore,
        isDownward: motionAnalysis.isDownward,
        motionRegion: motionAnalysis.motionRegion,
        timestamp: frame.timestamp,
        isKettleTilt: motionAnalysis.isKettleTilt,
        kettleTiltConfidence: motionAnalysis.kettleTiltConfidence,
      };
      stateResult = this._stateMachine.transition(event);
    }

    const layer2Time = performance.now() - layer2Start;
    this._layer2Times.push(layer2Time);
    if (this._layer2Times.length > 30) {
      this._layer2Times.shift();
    }

    // Check if we should trigger timer (single trigger guarantee)
    if (
      stateResult.shouldTriggerTimer &&
      !this._hasTriggered &&
      this._onPourDetected
    ) {
      this._hasTriggered = true;
      this._onPourDetected();
      // Optionally stop detection after trigger
      // this._isActive = false;
    }

    // Store frame for next comparison
    this._previousFrame = frame.data;

    const totalTime = performance.now() - startTime;

    return {
      hasMotion: motionAnalysis.hasMotion,
      motionScore: motionAnalysis.motionScore,
      isDownward: motionAnalysis.isDownward,
      motionRegion: motionAnalysis.motionRegion,
      currentState: stateResult.currentState,
      shouldTrigger: stateResult.shouldTriggerTimer && !this._hasTriggered,
      consecutiveCount: stateResult.consecutiveCount,
      timestamp: frame.timestamp,
      processingTime: totalTime,
      motionAnalysis: motionAnalysis,
      stateMachineDebug: stateResult.debugInfo,
    };
  }

  /**
   * Register callback for pour detection
   */
  onPourDetected(callback: () => void): void {
    this._onPourDetected = callback;
  }

  /**
   * Get current detection status
   */
  getDetectionStatus(): DetectionStatus {
    const layer1AvgTime =
      this._layer1Times.length > 0
        ? this._layer1Times.reduce((a, b) => a + b, 0) /
          this._layer1Times.length
        : 0;

    const layer2AvgTime =
      this._layer2Times.length > 0
        ? this._layer2Times.reduce((a, b) => a + b, 0) /
          this._layer2Times.length
        : 0;

    // Calculate FPS from frame timestamps
    const fps =
      this._layer1Times.length > 0
        ? Math.round(1000 / (layer1AvgTime + layer2AvgTime))
        : 0;

    return {
      isActive: this._isActive,
      currentState: this._stateMachine.getState(),
      frameCount: this._frameCount,
      processedFrameCount: this._frameCount - this._droppedFrames,
      lastDetectionTime: this._hasTriggered ? Date.now() : null,
      averageProcessingTime: layer1AvgTime + layer2AvgTime,
      performanceMetrics: {
        layer1AvgTime,
        layer2AvgTime,
        fps,
        droppedFrames: this._droppedFrames,
      },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DetectionConfig>): void {
    this._config = { ...this._config, ...config };
    // Recreate state machine with new config
    this._stateMachine = new DetectionStateMachine({
      requiredConsecutiveDetections: this._config.requiredConsecutiveDetections,
      stateTimeout: this._config.stateTimeout,
      cooldownDuration: this._config.cooldownDuration,
    });
  }

  /**
   * Reset the detector
   */
  reset(): void {
    this._stateMachine.reset();
    this._previousFrame = null;
    this._hasTriggered = false;
    this._frameCount = 0;
    this._layer1Times = [];
    this._layer2Times = [];
    this._droppedFrames = 0;
  }
}
