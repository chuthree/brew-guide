# Implementation Plan: Auto-Timer-On-Pour-Detection

## Overview

This implementation plan converts the two-layer detection architecture (frame diff + state machine) into actionable coding tasks. The feature enables automatic timer triggering when pour detection occurs, with three modes: auto-start, remind-only, and off. Implementation follows a phased approach: Phase 1 (infrastructure), Phase 2 (UX and integration), Phase 3 (testing and optimization).

## Tasks

- [ ] 1. Set up core infrastructure and type definitions
  - Create directory structure: `src/components/brewing/AutoPourDetection/`
  - Define TypeScript interfaces for all components (CameraManager, PourDetector, FrameDiffDetector, DetectionStateMachine, UndoController)
  - Define data models (AutoPourDetectionSettings, CameraState, DetectionState, VideoFrame, MotionAnalysis)
  - Add AutoPourDetectionSettings to settingsStore schema
  - _Requirements: 10.1, 10.10_

- [ ] 2. Implement CameraManager component (cross-platform camera access)
  - [ ] 2.1 Create CameraManager class with initialization and permission handling
    - Implement initialize() method
    - Implement requestPermission() for browser (MediaDevices API) and Capacitor environments
    - Handle permission states: granted, denied, prompt
    - _Requirements: 1.1, 1.2, 12.1, 12.2, 12.3_
  
  - [ ] 2.2 Implement video stream lifecycle management
    - Implement startVideoStream() with VideoStreamConfig support
    - Implement stopVideoStream() with resource cleanup
    - Support camera device enumeration (getAvailableCameras)
    - Support camera switching (switchCamera)
    - Handle stream errors and device unavailability
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 14.1, 14.2_
  
  - [ ]* 2.3 Write unit tests for CameraManager
    - Test permission request flows
    - Test stream lifecycle (start/stop)
    - Test error handling (permission denied, device not found)
    - Test resource cleanup
    - _Requirements: 1.1, 1.2, 9.1, 9.2_

- [ ] 3. Implement FrameProcessor component (video frame extraction)
  - [ ] 3.1 Create FrameProcessor class for frame capture
    - Implement initialize() to bind to video element
    - Implement startCapture() with configurable frame rate
    - Implement stopCapture() with cleanup
    - Implement getCurrentFrame() to extract ImageData from video
    - Use Canvas API for frame extraction
    - **Performance optimization**: Prioritize requestVideoFrameCallback() API over requestAnimationFrame (only triggers on new video frames, reduces CPU by ~20-30%)
    - Implement fallback to requestAnimationFrame for browsers without requestVideoFrameCallback support
    - _Requirements: 2.1, 7.3_
  
  - [ ]* 3.2 Write unit tests for FrameProcessor
    - Test frame capture at different frame rates
    - Test frame data format (ImageData)
    - Test cleanup on stopCapture
    - _Requirements: 2.1_

- [ ] 4. Implement Layer 1: FrameDiffDetector (frame difference detection)
  - [ ] 4.1 Create FrameDiffDetector class with frame diff algorithm
    - Implement computeFrameDiff() to calculate pixel-level differences
    - Calculate motion metrics: totalDiff, motionPixelCount, motionRatio
    - Optimize for performance (~2-3ms target for 320x240)
    - Use grayscale conversion for efficiency
    - _Requirements: 2.1, 2.6, 7.1_
  
  - [ ] 4.2 Implement downward motion detection with front camera optimization
    - Implement detectDownwardMotion() to analyze motion characteristics
    - Calculate vertical bias (-1 to 1, positive = downward) as auxiliary feature
    - Determine motion region (top/middle/bottom) as primary feature
    - Calculate motion score (0-1) with weighted formula: 50% top region + 30% area change + 20% vertical bias
    - Calculate area change ratio (positive = object approaching camera)
    - Filter large scene changes (motionRatio > 0.8 indicates lighting change or phone movement)
    - Relax direction constraint: prioritize top region motion over strict downward movement
    - _Requirements: 2.2, 2.3, 2.4_
  
  - [ ]* 4.3 Write property test for frame diff non-negativity
    - **Property 1: Frame diff non-negativity**
    - **Validates: Requirements 2.1, 2.6**
    - Use fast-check to generate random frame pairs
    - Verify motionRatio ∈ [0, 1], totalDiff ≥ 0, motionPixelCount ≥ 0
    - _Requirements: 2.1, 2.6_
  
  - [ ]* 4.4 Write property test for front camera motion detection
    - **Property 2: Front camera motion analysis**
    - **Validates: Requirements 2.2, 2.3, 2.4**
    - Verify motionScore ∈ [0, 1], verticalBias ∈ [-1, 1]
    - Verify areaChangeRatio calculation correctness
    - Verify isLargeSceneChange = true when motionRatio > 0.8
    - Verify top region motion prioritization
    - _Requirements: 2.2, 2.3, 2.4_

- [ ] 5. Implement Layer 2: DetectionStateMachine (state transitions and debouncing)
  - [ ] 5.1 Create DetectionStateMachine class with state management
    - Implement state enum: idle, monitoring, preparing, triggered, cooldown
    - Implement transition() method with event handling (including scene_change event)
    - Implement consecutive detection counter
    - Implement state timeout mechanism
    - Implement reset() method that transitions to cooldown state (not idle)
    - Implement cooldown mechanism: requires 2 seconds or 10 consecutive no_motion frames before returning to idle
    - Track cooldown start time and consecutive no-motion count
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_
  
  - [ ]* 5.2 Write property test for state machine transitions
    - **Property 3: State machine correctness**
    - **Validates: Requirements 13.1-13.9**
    - Verify cooldown is entered on manual_reset from triggered
    - Verify cooldown → idle requires time elapsed or consecutive no_motion
    - Verify shouldTriggerTimer only true on preparing → triggered
    - Verify consecutive count resets on state regression
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_
  
  - [ ]* 5.3 Write unit tests for state machine edge cases
    - Test timeout behavior
    - Test consecutive detection threshold
    - Test state history tracking
    - Test cooldown mechanism (time-based and motion-based exit)
    - Test scene_change event handling
    - _Requirements: 13.8, 13.9_

- [ ] 6. Implement PourDetector coordinator (two-layer pipeline)
  - [ ] 6.1 Create PourDetector class to orchestrate detection layers
    - Integrate FrameDiffDetector (Layer 1) and DetectionStateMachine (Layer 2)
    - Implement processFrame() to run two-layer pipeline
    - Implement startDetection() and stopDetection()
    - Implement onPourDetected() callback registration
    - Track performance metrics (layer1AvgTime, layer2AvgTime, fps, droppedFrames)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 6.2 Write property test for end-to-end detection pipeline
    - **Property 4: Single trigger guarantee**
    - **Validates: Requirements 2.4, 13.7**
    - Process array of random frames
    - Verify trigger count ≤ 1 (no duplicate triggers)
    - _Requirements: 2.4, 13.7_
  
  - [ ]* 6.3 Write integration tests for PourDetector
    - Test complete detection flow with mock video frames
    - Test performance metrics tracking
    - Test callback invocation
    - _Requirements: 2.1, 2.6, 7.1_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement UndoController (2-second undo window)
  - [ ] 8.1 Create UndoController class with undo window management
    - Implement startUndoWindow() with configurable duration (default 2000ms)
    - Implement undo() to restore timer state
    - Implement cancelUndoWindow()
    - Implement isUndoAvailable() and getRemainingTime()
    - Save timer state snapshot (currentTime, isRunning, hasStartedOnce)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ]* 8.2 Write unit tests for UndoController
    - Test undo window lifecycle
    - Test timer state restoration
    - Test countdown timing accuracy
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 9. Implement Toast notification system (4 toast types)
  - [ ] 9.1 Create Toast component with 4 variants
    - Toast 1: "检测到注水，已开始计时" (success, 2s, auto-start mode)
    - Toast 2: "检测到注水，点击开始" (info, 3s, remind-only mode, with action button)
    - Toast 3: "已撤销" (neutral, 1s)
    - Toast 4: "摄像头权限被拒绝，请在设置中授予权限" (error, 5s, with "去设置" button)
    - Support icons, actions, dismissible/non-dismissible
    - _Requirements: 6.4, 6.5, 9.1_
  
  - [ ]* 9.2 Write unit tests for Toast component
    - Test all 4 toast variants
    - Test action button callbacks
    - Test auto-dismiss timing
    - _Requirements: 6.4, 6.5_

- [ ] 10. Implement UI components for detection feedback
  - [ ] 10.1 Create CameraActiveIndicator component
    - Display red dot + "摄像头已启用" text
    - Include "停止" button to stop camera
    - Position at top of screen
    - _Requirements: 1.3, 6.1, 6.2, 8.4_
  
  - [ ] 10.2 Create DetectionStateIndicator component (debug mode)
    - Display current state, consecutive count, motion score, processing time
    - Only visible when showDebugOverlay setting is enabled
    - _Requirements: 6.3, 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [ ] 10.3 Create UndoButton component with countdown
    - Display "撤销 (Xs)" with remaining time
    - Auto-hide after 2 seconds
    - Call UndoController.undo() on click
    - _Requirements: 4.1, 4.2, 4.3, 4.6_
  
  - [ ] 10.4 Implement play button highlight animation (remind-only mode)
    - Pulse animation (scale 1.0 → 1.1)
    - Green glow box-shadow
    - Duration: 3 seconds
    - _Requirements: 3.4, 6.6_
  
  - [ ]* 10.5 Write component tests for UI feedback elements
    - Test CameraActiveIndicator visibility and stop button
    - Test DetectionStateIndicator debug mode toggle
    - Test UndoButton countdown and click handler
    - Test play button highlight animation
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

- [ ] 11. Integrate auto-detection into BrewingTimer component
  - [ ] 11.1 Add auto-detection initialization logic to BrewingTimer
    - Check autoPourMode setting (auto-start / remind-only / off)
    - Initialize CameraManager and PourDetector when mode is not 'off'
    - Request camera permission on component mount
    - Handle permission denied error
    - _Requirements: 1.1, 1.2, 3.5, 5.1, 9.1_
  
  - [ ] 11.2 Implement zero-delay timer start (auto-start mode)
    - Create startTimerImmediately() function that skips 3-second countdown
    - Call startMainTimer() directly when pour detected
    - Set isRunning and hasStartedOnce states
    - _Requirements: 3.1, 3.2, 5.3_
  
  - [ ] 11.3 Implement remind-only mode behavior
    - Show toast with "开始" action button
    - Trigger play button highlight animation
    - Keep camera running after detection
    - _Requirements: 3.3, 3.4_
  
  - [ ] 11.4 Implement dual start methods (manual + auto)
    - Preserve existing manual start (click play button → 3s countdown)
    - Disable manual start when timer already running
    - Stop auto-detection when manual start triggered
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ] 11.5 Implement undo functionality integration
    - Show UndoButton for 2 seconds after auto-start
    - Restore timer state on undo
    - Restart camera and detection after undo
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ] 11.6 Implement camera lifecycle management
    - Stop camera when user leaves brewing page
    - Stop camera when app goes to background
    - Stop camera after detection success (if autoStopCamera enabled)
    - Implement 5-minute detection timeout
    - _Requirements: 1.5, 8.6, 8.7, 8.8_
  
  - [ ]* 11.7 Write integration tests for BrewingTimer auto-detection
    - Test auto-start mode flow
    - Test remind-only mode flow
    - Test off mode (manual only)
    - Test undo functionality
    - Test camera lifecycle
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 5.1_

- [ ] 12. Implement settings UI in experimental features section
  - [ ] 12.1 Create AutoPourDetectionSettings component
    - Add "实验性功能" section marker
    - Add warning: "此功能正在测试中，可能不稳定"
    - Add detection mode selector (auto-start / remind-only / off)
    - Add camera settings: facing mode, resolution, frame rate
    - Add advanced detection parameters: sensitivity, consecutive detections, state timeout
    - Add UI options: show camera preview, show debug info, auto-stop camera
    - _Requirements: 6.7, 6.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_
  
  - [ ] 12.2 Implement settings persistence to IndexedDB
    - Save settings changes to settingsStore
    - Load settings on app initialization
    - Validate settings values (ranges, enums)
    - _Requirements: 3.8, 10.10_
  
  - [ ]* 12.3 Write tests for settings UI and persistence
    - Test settings form validation
    - Test IndexedDB persistence
    - Test settings load on initialization
    - _Requirements: 10.10_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement error handling and recovery
  - [ ] 14.1 Add error handling for camera permission denied
    - Show Toast with "去设置" action button
    - Fallback to manual start mode
    - _Requirements: 9.1_
  
  - [ ] 14.2 Add error handling for camera device not found
    - Show Toast: "未检测到可用摄像头"
    - Provide "重试" button
    - Fallback to manual start mode
    - _Requirements: 9.2_
  
  - [ ] 14.3 Add error handling for stream initialization failure
    - Show Toast: "摄像头启动失败，请重试"
    - Provide "重试" button
    - Log error for debugging
    - _Requirements: 9.3_
  
  - [ ] 14.4 Add performance degradation handling
    - Monitor frame processing time
    - Auto-reduce frame rate if processing time > threshold
    - Show warning if device performance insufficient
    - _Requirements: 7.6, 7.7, 9.4_
  
  - [ ]* 14.5 Write tests for error handling flows
    - Test permission denied flow
    - Test device not found flow
    - Test stream error flow
    - Test performance degradation
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 15. Implement resource management and cleanup
  - [ ] 15.1 Add resource cleanup in CameraManager
    - Release MediaStream tracks on stopVideoStream()
    - Clear video element srcObject
    - Remove event listeners
    - _Requirements: 14.2, 14.8_
  
  - [ ] 15.2 Add resource cleanup in PourDetector
    - Release frame buffers
    - Clear detection history
    - Cancel pending callbacks
    - _Requirements: 14.4, 14.8_
  
  - [ ] 15.3 Implement frame buffer pooling for GC optimization
    - Create FrameBufferPool class
    - Reuse ImageData objects
    - Implement acquire() and release() methods
    - _Requirements: 14.5, 14.6_
  
  - [ ] 15.4 Add cleanup on component unmount
    - Stop camera and detection in useEffect cleanup
    - Release all resources
    - _Requirements: 14.7, 14.8_
  
  - [ ]* 15.5 Write tests for resource management
    - Test camera resource cleanup
    - Test detector resource cleanup
    - Test frame buffer pooling
    - Test component unmount cleanup
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.7, 14.8_

- [ ] 16. Implement performance optimizations
  - [ ] 16.1 Add adaptive frame rate adjustment
    - Monitor processing time per frame
    - Reduce frame rate if processing time > 50ms
    - Increase frame rate if processing time < 25ms
    - Clamp frame rate to [15, 60] FPS
    - _Requirements: 7.3, 7.6_
  
  - [ ] 16.2 Implement frame downsampling
    - Add downsampleFrame() utility function
    - Support configurable downsample scale (0.25-1.0)
    - Use Canvas API for efficient downsampling
    - _Requirements: 7.4, 7.5_
  
  - [ ] 16.3 Add Web Worker support for background processing (optional)
    - Create detection-worker.ts for offscreen processing
    - Move FrameDiffDetector and DetectionStateMachine to worker
    - Use OffscreenCanvas for frame processing
    - Implement MessageChannel communication
    - _Requirements: 7.4_
  
  - [ ]* 16.4 Write performance tests
    - Test frame processing time < 5ms (Layer 1)
    - Test state machine transition time < 1ms (Layer 2)
    - Test overall latency at 30 FPS
    - Test adaptive frame rate behavior
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 17. Implement cross-platform compatibility
  - [ ] 17.1 Test and fix browser environment (MediaDevices API)
    - Test on Chrome, Firefox, Safari
    - Handle browser-specific quirks
    - _Requirements: 12.1, 12.4_
  
  - [ ] 17.2 Test and fix iOS environment (Capacitor Camera Plugin)
    - Test camera access on iOS
    - Handle iOS-specific permissions
    - _Requirements: 12.2_
  
  - [ ] 17.3 Test and fix Android environment (Capacitor Camera Plugin)
    - Test camera access on Android
    - Handle Android-specific permissions
    - _Requirements: 12.3_
  
  - [ ]* 17.4 Write cross-platform integration tests
    - Test consistent detection results across platforms
    - Test consistent UI across platforms
    - _Requirements: 12.5, 12.6_

- [ ] 18. Implement first-time user onboarding (optional)
  - [ ] 18.1 Create onboarding flow component
    - Step 1: Feature introduction with animation
    - Step 2: Camera permission request with privacy explanation
    - Step 3: Detection mode selection with recommendations
    - Step 4: Test detection functionality
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_
  
  - [ ]* 18.2 Write tests for onboarding flow
    - Test step progression
    - Test permission request handling
    - Test mode selection
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Final integration and polish
  - [ ] 20.1 Add debug visualization overlay (optional)
    - Overlay motion regions on camera preview
    - Display frame diff heatmap
    - Show detection state transitions
    - _Requirements: 15.6, 15.7_
  
  - [ ] 20.2 Add performance monitoring dashboard (optional)
    - Display real-time FPS
    - Display average processing time
    - Display CPU usage estimate
    - Display dropped frame count
    - _Requirements: 15.8_
  
  - [ ] 20.3 Final manual testing and bug fixes
    - Test all three modes (auto-start, remind-only, off)
    - Test undo functionality
    - Test error scenarios
    - Test on multiple devices
    - _Requirements: All_
  
  - [ ]* 20.4 Write end-to-end tests
    - Test complete user flows for all modes
    - Test error recovery flows
    - Test cross-platform compatibility
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript with React and integrates with existing BrewingTimer component
- Two-layer architecture: Layer 1 (FrameDiffDetector) + Layer 2 (DetectionStateMachine)
- Three detection modes: auto-start (zero-delay timer), remind-only (toast + highlight), off (manual only)
- 2-second undo window for auto-start mode
- Cross-platform support: Web (MediaDevices API), iOS/Android (Capacitor Camera Plugin)
