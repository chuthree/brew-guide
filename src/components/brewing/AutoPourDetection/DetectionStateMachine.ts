/**
 * DetectionStateMachine
 *
 * Layer 2: Manages detection state transitions with temporal stability.
 * Uses sliding window and soft counting for robustness to noise.
 */

import type {
  StateMachineState,
  StateMachineEvent,
  StateTransitionResult,
  StateHistoryEntry,
} from './types';

interface StateMachineConfig {
  requiredConsecutiveDetections: number;
  stateTimeout: number;
  cooldownDuration: number;
  idleToMonitoringThreshold?: number;
  preparingTolerance?: number;
  triggeredAutoExitFrames?: number;
}

interface DebugInfo {
  stabilityScore: number;
  recentDetections: boolean[];
  softCounter: number;
  stateEntryTime: number;
}

export default class DetectionStateMachine {
  private _state: StateMachineState = 'idle';
  private _consecutiveCount = 0;
  private _consecutiveNoMotion = 0;
  private _cooldownStart: number | null = null;
  private _stateEntryTime: number = Date.now();
  private _stateHistory: StateHistoryEntry[] = [];
  private _config: StateMachineConfig;

  // Sliding window for stability detection
  private _detectionWindow: boolean[] = [];
  private readonly _windowSize = 5;

  // Soft counter for tolerant counting
  private _softCounter = 0;
  private readonly _softCounterMax = 8;

  // Debug info
  private _debugInfo: DebugInfo = {
    stabilityScore: 0,
    recentDetections: [],
    softCounter: 0,
    stateEntryTime: Date.now(),
  };

  constructor(config: StateMachineConfig) {
    this._config = {
      ...config,
      idleToMonitoringThreshold: config.idleToMonitoringThreshold ?? 1,
      preparingTolerance: config.preparingTolerance ?? 0.3,
      triggeredAutoExitFrames: config.triggeredAutoExitFrames ?? 30,
    };
  }

  /**
   * Process state transition with temporal stability
   */
  transition(event: StateMachineEvent): StateTransitionResult {
    const currentTime = Date.now();
    const previousState = this._state;
    let shouldTriggerTimer = false;
    let transitionReason = '';

    // Update detection window
    const isDetection = event.isKettleTilt && event.motionScore <= 0.7;
    this._updateDetectionWindow(isDetection);

    // Calculate stability score from window
    const stabilityScore = this._calculateStabilityScore();
    this._debugInfo.stabilityScore = stabilityScore;
    this._debugInfo.recentDetections = [...this._detectionWindow];

    // Check state-specific timeout
    const stateElapsed = currentTime - this._stateEntryTime;
    if (stateElapsed > this._config.stateTimeout) {
      if (this._state !== 'idle') {
        transitionReason = this._handleTimeout();
      }
    }

    // State machine logic
    switch (this._state) {
      case 'idle':
        // Require multiple consistent detections for stability
        if (stabilityScore >= this._config.idleToMonitoringThreshold!) {
          this._state = 'monitoring';
          this._softCounter = 0;
          this._updateStateEntryTime(currentTime);
          transitionReason = 'stable_kettle_detected';
        }
        break;

      case 'monitoring':
        // Soft counter with tolerance
        if (isDetection) {
          this._softCounter = Math.min(
            this._softCounter + 1,
            this._softCounterMax
          );
        } else {
          // Allow occasional misses
          this._softCounter = Math.max(
            0,
            this._softCounter - (1 - this._config.preparingTolerance!)
          );
        }

        this._consecutiveCount = this._softCounter;

        // Trigger when threshold reached
        if (
          this._consecutiveCount >= this._config.requiredConsecutiveDetections
        ) {
          this._state = 'triggered';
          shouldTriggerTimer = true;
          this._updateStateEntryTime(currentTime);
          transitionReason = 'threshold_met_stable';
        } else if (this._softCounter <= 0) {
          // Return to idle on complete loss (was incorrectly staying in monitoring)
          this._state = 'idle';
          this._consecutiveCount = 0;
          transitionReason = 'tilt_lost_return_idle';
        }
        break;

      case 'triggered':
        // Auto-exit after N frames of no detection
        // if (!isDetection) {
        //   this._consecutiveNoMotion++;
        //   if (
        //     this._consecutiveNoMotion >= this._config.triggeredAutoExitFrames!
        //   ) {
        //     this._state = 'cooldown';
        //     this._cooldownStart = currentTime;
        //     this._updateStateEntryTime(currentTime);
        //     transitionReason = 'auto_exit_no_motion';
        //   }
        // } else {
        //   this._consecutiveNoMotion = 0;
        // }

        // Manual reset always works
        if (event.type === 'manual_reset') {
          this._state = 'cooldown';
          this._cooldownStart = currentTime;
          this._consecutiveNoMotion = 0;
          this._updateStateEntryTime(currentTime);
          transitionReason = 'manual_reset';
        }
        break;

      case 'cooldown':
        // Complete isolation - ignore all detection events
        if (this._cooldownStart) {
          const cooldownElapsed = currentTime - this._cooldownStart;

          if (cooldownElapsed >= this._config.cooldownDuration) {
            this._state = 'idle';
            this._softCounter = 0;
            this._consecutiveCount = 0;
            this._consecutiveNoMotion = 0;
            this._updateStateEntryTime(currentTime);
            transitionReason = 'cooldown_complete';
          }
        }
        break;
    }

    this._debugInfo.softCounter = this._softCounter;

    // Record state transition
    if (previousState !== this._state) {
      this._stateHistory.push({
        state: this._state,
        timestamp: currentTime,
        duration: 0,
        consecutiveCount: this._consecutiveCount,
      });

      const prevIndex = this._stateHistory.length - 2;
      if (prevIndex >= 0) {
        this._stateHistory[prevIndex].duration =
          currentTime - this._stateHistory[prevIndex].timestamp;
      }
    }

    return {
      previousState,
      currentState: this._state,
      shouldTriggerTimer,
      consecutiveCount: this._consecutiveCount,
      transitionReason,
      debugInfo: { ...this._debugInfo },
    };
  }

  /**
   * Update sliding detection window
   */
  private _updateDetectionWindow(isDetection: boolean): void {
    this._detectionWindow.push(isDetection);
    if (this._detectionWindow.length > this._windowSize) {
      this._detectionWindow.shift();
    }
  }

  /**
   * Calculate stability score from detection window
   * Returns count of recent positive detections
   */
  private _calculateStabilityScore(): number {
    if (this._detectionWindow.length === 0) {
      return 0;
    }
    return this._detectionWindow.filter(Boolean).length;
  }

  /**
   * Handle timeout for current state
   */
  private _handleTimeout(): string {
    const timeoutReason = `${this._state}_timeout`;

    switch (this._state) {
      case 'monitoring':
      case 'preparing':
        this._state = 'idle';
        this._softCounter = 0;
        break;
      case 'triggered':
        this._state = 'cooldown';
        this._cooldownStart = Date.now();
        break;
      case 'cooldown':
        this._state = 'idle';
        this._softCounter = 0;
        break;
    }

    this._updateStateEntryTime(Date.now());
    return timeoutReason;
  }

  /**
   * Update state entry time for timeout tracking
   */
  private _updateStateEntryTime(timestamp: number): void {
    this._stateEntryTime = timestamp;
    this._debugInfo.stateEntryTime = timestamp;
  }

  /**
   * Get debug information
   */
  getDebugInfo(): DebugInfo {
    return { ...this._debugInfo };
  }

  /**
   * Reset state machine to cooldown
   */
  reset(): void {
    this._state = 'cooldown';
    this._cooldownStart = Date.now();
    this._softCounter = 0;
    this._consecutiveCount = 0;
    this._consecutiveNoMotion = 0;
    this._detectionWindow = [];
    this._updateStateEntryTime(Date.now());
  }

  /**
   * Get current consecutive detection count
   */
  getConsecutiveCount(): number {
    return this._consecutiveCount;
  }

  /**
   * Get remaining cooldown time in ms
   */
  getCooldownRemaining(): number {
    if (this._state !== 'cooldown' || !this._cooldownStart) {
      return 0;
    }
    const elapsed = Date.now() - this._cooldownStart;
    return Math.max(0, this._config.cooldownDuration - elapsed);
  }

  /**
   * Get state history
   */
  getStateHistory(): StateHistoryEntry[] {
    return [...this._stateHistory];
  }

  /**
   * Get current state
   */
  getState(): StateMachineState {
    return this._state;
  }

  /**
   * Get detection window for debugging
   */
  getDetectionWindow(): boolean[] {
    return [...this._detectionWindow];
  }
}
