/**
 * Auto Pour Detection Types
 *
 * TypeScript interfaces for the auto pour detection feature.
 * Based on specs/auto-timer-on-pour-detection/design.md
 */

// ============================================================================
// Detection Modes
// ============================================================================

export type DetectionMode = 'auto-start' | 'remind-only' | 'off';

export type StateMachineState =
  | 'idle'
  | 'monitoring'
  | 'preparing'
  | 'triggered'
  | 'cooldown';

// ============================================================================
// Auto Pour Detection Settings
// ============================================================================

export interface AutoPourDetectionSettings {
  /** Whether auto detection is enabled */
  enabled: boolean;

  /** Detection mode: auto-start, remind-only, or off */
  mode: DetectionMode;

  // Camera config
  /** Selected camera device ID */
  cameraDeviceId: string | null;

  /** Camera facing mode: 'user' = front (recommended), 'environment' = back */
  cameraFacingMode: 'user' | 'environment';

  // UI config
  /** Whether to show camera preview */
  showCameraPreview: boolean;

  /** Whether to show debug overlay (frame diff, motion regions) */
  showDebugOverlay: boolean;

  /** Whether to auto-stop camera after successful detection */
  autoStopCamera: boolean;

  // UX config
  /** Whether to show toast notifications */
  showToastNotification: boolean;
}

// ============================================================================
// Camera Types
// ============================================================================

export interface CameraState {
  status:
    | 'idle'
    | 'requesting-permission'
    | 'initializing'
    | 'active'
    | 'error';
  permissionStatus: PermissionStatus | 'unknown';
  currentDeviceId: string | null;
  availableDevices: CameraDevice[];
  stream: MediaStream | null;
  error: CameraError | null;
}

export interface CameraError {
  code: 'PERMISSION_DENIED' | 'DEVICE_NOT_FOUND' | 'STREAM_ERROR' | 'UNKNOWN';
  message: string;
  timestamp: number;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
  kind: 'videoinput';
}

export interface VideoStreamConfig {
  deviceId?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  facingMode?: 'user' | 'environment';
}

export interface CameraInitResult {
  success: boolean;
  error?: string;
  supportedFeatures: {
    multipleCamera: boolean;
    focusControl: boolean;
    exposureControl: boolean;
  };
}

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export type VideoStreamStatus = 'idle' | 'initializing' | 'active' | 'error';

// ============================================================================
// Video Frame
// ============================================================================

export interface VideoFrame {
  data: ImageData;
  timestamp: number;
  width: number;
  height: number;
}

// ============================================================================
// Frame Difference Detection (Layer 1)
// ============================================================================

export interface FrameDiffResult {
  /** Pixel-level difference map */
  diffMap: number[][];

  /** Total difference value */
  totalDiff: number;

  /** Number of motion pixels */
  motionPixelCount: number;

  /** Motion pixel ratio (0-1) */
  motionRatio: number;

  /** Maximum difference value */
  maxDiff: number;

  /** Motion center Y coordinate (normalized 0-1) */
  motionCenterY: number;

  /** Whether this is a large scene change (motionRatio > 0.8) */
  isLargeSceneChange: boolean;
}

export interface MotionAnalysis {
  /** Whether there is significant motion */
  hasMotion: boolean;

  /** Whether motion is downward */
  isDownward: boolean;

  /** Motion score (0-1) */
  motionScore: number;

  /** Vertical bias (-1 to 1, positive = downward) */
  verticalBias: number;

  /** Motion region position */
  motionRegion: 'top' | 'middle' | 'bottom';

  /** Area change ratio (positive = expanding, negative = shrinking) */
  areaChangeRatio: number;

  /** Whether this is a large scene change */
  isLargeSceneChange: boolean;

  // === Debug Data: Raw metrics for observation ===
  /** Total number of motion pixels detected */
  totalMotionPixels: number;

  /** Motion center X coordinate (normalized 0-1) */
  motionCenterX: number;

  /** Motion center Y coordinate (normalized 0-1) */
  motionCenterY: number;

  /** Current bounding box area in pixels */
  boundingBoxArea: number;

  /** Bounding box width in pixels */
  boundingBoxWidth: number;

  /** Bounding box height in pixels */
  boundingBoxHeight: number;

  /** Aspect ratio of bounding box (height/width) */
  boundingBoxAspectRatio: number;

  /** Displacement from previous frame center Y (positive = downward) */
  centerYDisplacement: number;

  /** Historical motion center Y values for trend analysis (last N frames) */
  centerYHistory: number[];

  /** Downward velocity (displacement per frame, smoothed) */
  downwardVelocity: number;

  /** Whether this appears to be a kettle tilt (large slow-moving object) */
  isKettleTilt: boolean;

  /** Confidence score for kettle tilt detection (0-1) */
  kettleTiltConfidence: number;

  // === Rotation Detection Features ===
  /** Whether rotation is detected */
  hasRotation: boolean;

  /** Rotation score (0-1) */
  rotationScore: number;

  /** Top half motion center Y (normalized 0-1) */
  topCenterY: number;

  /** Bottom half motion center Y (normalized 0-1) */
  bottomCenterY: number;

  /** Difference between top and bottom motion centers (rotation indicator, positive = tilting) */
  centerYDiff: number;

  /** Vertical motion gradient (positive = more motion on top = tilting down) */
  verticalGradient: number;

  /** How asymmetric the motion is (0-1) */
  asymmetryScore: number;

  /** Top half pixel count */
  topPixelCount: number;

  /** Bottom half pixel count */
  bottomPixelCount: number;

  /** Temporal tilt signal: difference between top and bottom motion (positive = tilting) */
  tiltSignal: number;

  /** Tilt consistency across frames (0-1, higher = more consistent) */
  tiltConsistency: number;

  translationScore?: number;
  velocityRatio?: number;
  commonModeDisplacement?: number;
  rotationEvidence?: number;
  gradientStability?: number;
}

/**
 * State machine debug information
 */
export interface StateMachineDebugInfo {
  stabilityScore: number;
  recentDetections: boolean[];
  softCounter: number;
  stateEntryTime: number;
}

/**
 * Kettle Tilt Detection Analysis
 * Specialized analysis for detecting kettle pouring motion
 */
export interface KettleTiltAnalysis {
  /** Whether a kettle tilt is currently detected */
  isTilting: boolean;

  /** Confidence level (0-1) */
  confidence: number;

  /** Current tilt phase */
  tiltPhase: 'none' | 'starting' | 'tilting' | 'pouring' | 'recovering';

  /** Duration of current tilt in frames */
  tiltDuration: number;

  /** Cumulative downward displacement */
  cumulativeDisplacement: number;

  /** Average area of moving region */
  averageArea: number;

  /** Stability of motion (low = erratic, high = smooth) */
  motionStability: number;

  /** Debug metrics */
  debugMetrics: {
    frameCount: number;
    centerY: number;
    area: number;
    velocity: number;
    aspectRatio: number;
  };
}

// ============================================================================
// Detection (Layer 2)
// ============================================================================

export interface DetectionConfig {
  /** Sensitivity (0-100) */
  sensitivity: number;

  /** Frame difference threshold (0-255) */
  frameDiffThreshold: number;

  /** Minimum motion pixel ratio (0-1) */
  minMotionRatio: number;

  /** Maximum motion pixel ratio (0-1) */
  maxMotionRatio: number;

  /** Required consecutive detections for state transition */
  requiredConsecutiveDetections: number;

  /** State timeout in milliseconds */
  stateTimeout: number;

  /** Cooldown duration in milliseconds */
  cooldownDuration: number;

  /** Region of interest */
  regionOfInterest?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DetectionResult {
  // Layer 1 results
  hasMotion: boolean;
  motionScore: number;
  isDownward: boolean;
  motionRegion: 'top' | 'middle' | 'bottom';

  // Layer 2 results
  currentState: StateMachineState;
  shouldTrigger: boolean;
  consecutiveCount: number;

  // Metadata
  timestamp: number;
  processingTime: number;

  // Debug data: full motion analysis
  motionAnalysis: MotionAnalysis | null;

  // State machine debug info
  stateMachineDebug?: StateMachineDebugInfo;
}

export interface DetectionStatus {
  isActive: boolean;
  currentState: StateMachineState;
  frameCount: number;
  processedFrameCount: number;
  lastDetectionTime: number | null;
  averageProcessingTime: number;
  performanceMetrics: {
    layer1AvgTime: number;
    layer2AvgTime: number;
    fps: number;
    droppedFrames: number;
  };
}

// ============================================================================
// State Machine
// ============================================================================

export interface StateMachineEvent {
  type:
    | 'motion_detected'
    | 'no_motion'
    | 'scene_change'
    | 'timeout'
    | 'manual_reset';
  motionScore: number;
  isDownward: boolean;
  motionRegion: 'top' | 'middle' | 'bottom';
  timestamp: number;
  isKettleTilt: boolean;
  kettleTiltConfidence: number;
}

export interface StateTransitionResult {
  previousState: StateMachineState;
  currentState: StateMachineState;
  shouldTriggerTimer: boolean;
  consecutiveCount: number;
  transitionReason: string;
  debugInfo?: StateMachineDebugInfo;
}

export interface StateHistoryEntry {
  state: StateMachineState;
  timestamp: number;
  duration: number;
  consecutiveCount: number;
}

// ============================================================================
// Undo Controller
// ============================================================================

export interface UndoState {
  isAvailable: boolean;
  remainingTime: number;
  timerSnapshot: {
    currentTime: number;
    isRunning: boolean;
    hasStartedOnce: boolean;
  };
}
