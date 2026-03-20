/**
 * Auto Pour Detection Module
 *
 * Computer-vision-based pour detection system that automatically triggers
 * the brewing timer when the user begins pouring.
 *
 * Architecture: Two-layer pipeline (FrameDiffDetector + DetectionStateMachine)
 */

// Core classes
export { default as CameraManager } from './CameraManager';
export { default as FrameProcessor } from './FrameProcessor';
export { default as FrameDiffDetector } from './FrameDiffDetector';
export { default as DetectionStateMachine } from './DetectionStateMachine';
export { default as PourDetector } from './PourDetector';
export { default as UndoController } from './UndoController';

// Components
export { default as CameraActiveIndicator } from './components/CameraActiveIndicator';
export { default as DetectionStateIndicator } from './components/DetectionStateIndicator';
export { default as UndoButton } from './components/UndoButton';
export { default as DebugOverlay } from './components/DebugOverlay';

// Types
export type {
  DetectionMode,
  StateMachineState,
  AutoPourDetectionSettings,
  CameraState,
  CameraError,
  CameraDevice,
  VideoStreamConfig,
  CameraInitResult,
  PermissionStatus,
  VideoStreamStatus,
  VideoFrame,
  FrameDiffResult,
  MotionAnalysis,
  DetectionConfig,
  DetectionResult,
  DetectionStatus,
  StateMachineEvent,
  StateTransitionResult,
  StateHistoryEntry,
  UndoState,
} from './types';
