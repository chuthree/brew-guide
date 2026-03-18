# Auto-Timer-On-Pour-Detection

## TL;DR

> **Quick Summary**: Implement a computer-vision-based pour detection system that automatically triggers the brewing timer when the user begins pouring, using a two-layer frame-diff + state-machine pipeline. Integrates into the existing `BrewingTimer` component as an experimental feature.
>
> **Deliverables**:
>
> - New module: `src/components/brewing/AutoPourDetection/` (7 core files + 3 UI components)
> - Modified: `src/lib/core/db.ts` — `AppSettings` interface extended
> - Modified: `src/lib/stores/settingsStore.ts` — default settings + update method
> - Modified: `src/components/brewing/BrewingTimer.tsx` — detection lifecycle + `startTimerImmediately()`
> - Modified: `src/components/settings/ExperimentalSettings.tsx` — new settings section
> - New/Modified: Toast system — action-button support for "仅提醒" mode
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: T1 (types) → T2 (CameraManager) + T3 (FrameProcessor) → T4 (FrameDiffDetector) → T5 (StateMachine) → T6 (PourDetector) → T8 (UndoController) → T11 (BrewingTimer integration) → Final Wave

---

## Context

### Original Request

> 我有现成的设计文档 `specs/auto-timer-on-pour-detection/design.md` 和需求文档 `specs/auto-timer-on-pour-detection/requirements.md`，以及一份初步的任务清单 `specs/auto-timer-on-pour-detection/tasks.md`。请结合当前代码库的实际结构，重新生成一份 `.sisyphus/plans/` 下的 Todo。注意：任务必须具体到具体文件和函数修改。

### Key Architecture Decisions (from specs)

- **Two-layer detection**: Layer 1 = `FrameDiffDetector` (frame diff, ~2-3ms/frame), Layer 2 = `DetectionStateMachine` (debounce + cooldown)
- **Front-facing camera** (`facingMode: 'user'`) — phone lies flat, lens faces up toward user
- **Three modes**: `auto-start` (immediate timer, 0 delay), `remind-only` (toast + highlight button), `off`
- **Zero-delay start**: On detection → call `startMainTimer()` directly, skip `startCountdown(3)`
- **2-second undo window**: `UndoController` saves timer snapshot, `UndoButton` shows countdown
- **Experimental feature**: Exposed under `ExperimentalSettings.tsx`, not main settings

### Codebase Key Findings

- `BrewingTimer.tsx` line 415: `startMainTimer()` — direct timer start without countdown; this is the function to call for zero-delay auto-detection start
- `BrewingTimer.tsx` line 485: `startCountdown(seconds)` — the 3s countdown path for manual starts; must NOT be invoked on auto-detection
- `BrewingTimer.tsx` line 324: `clearTimerAndStates()` — must be called in undo handler
- `BrewingTimer.tsx` line 740: `startTimer()` — the manual start handler, must be preserved as-is
- `src/lib/core/db.ts` line 314: `AppSettings` interface ends here; `autoPourDetection?: AutoPourDetectionSettings` to be appended
- `src/lib/stores/settingsStore.ts` line 327: `mergedSettings = { ...defaultSettings, ...stored.data }` — new field needs a default in `defaultSettings`
- `src/components/common/feedback/LightToast.tsx` — current `showToast()` has no action-button support; needs extension for "仅提醒" mode
- `src/components/settings/ExperimentalSettings.tsx` — uses `SettingSection`, `SettingRow`, `SettingToggle`, `SettingSlider` atoms; new section follows this pattern

---

## Work Objectives

### Core Objective

Build the complete auto pour detection pipeline and integrate it into `BrewingTimer`, supporting all three detection modes with proper camera lifecycle management, undo functionality, and settings persistence.

### Concrete Deliverables

- `src/components/brewing/AutoPourDetection/types.ts` — all shared TypeScript interfaces
- `src/components/brewing/AutoPourDetection/CameraManager.ts` — MediaDevices + Capacitor camera wrapper
- `src/components/brewing/AutoPourDetection/FrameProcessor.ts` — video frame extraction via Canvas
- `src/components/brewing/AutoPourDetection/FrameDiffDetector.ts` — pixel-level motion analysis
- `src/components/brewing/AutoPourDetection/DetectionStateMachine.ts` — state transitions + cooldown
- `src/components/brewing/AutoPourDetection/PourDetector.ts` — two-layer pipeline coordinator
- `src/components/brewing/AutoPourDetection/UndoController.ts` — 2-second undo window
- `src/components/brewing/AutoPourDetection/index.ts` — barrel exports
- `src/components/brewing/AutoPourDetection/components/CameraActiveIndicator.tsx`
- `src/components/brewing/AutoPourDetection/components/DetectionStateIndicator.tsx`
- `src/components/brewing/AutoPourDetection/components/UndoButton.tsx`
- `src/components/settings/AutoPourDetectionSettings.tsx` — new settings section component
- Modified `ExperimentalSettings.tsx` — imports and renders `AutoPourDetectionSettings`

### Definition of Done

- [ ] `pnpm build` succeeds with no TypeScript errors
- [ ] `pnpm lint` passes with no new warnings
- [ ] Camera activates when mode ≠ 'off' and brewing page is open
- [ ] Simulated motion triggers timer with 0-delay in auto-start mode
- [ ] Undo button appears and functions within 2s window
- [ ] Settings persist across app restarts (verified via DevTools → IndexedDB)

### Must Have

- Zero-delay timer start on pour detection (no 3s countdown)
- 2-second undo window for auto-start mode
- Camera lifecycle: stop on page leave, stop on app background, stop after detection (if `autoStopCamera`)
- Settings persistence via existing `settingsStore.updateSettings()`
- Graceful fallback to manual mode on permission denial

### Must NOT Have (Guardrails)

- **No ML models** — pure frame-diff + state-machine only, no TensorFlow/ONNX
- **No new global state** beyond `settingsStore` — use React local state or refs inside `BrewingTimer`
- **No modifying `startTimer()`** (line 740) — add `startTimerImmediately()` as a parallel path
- **No `localStorage` direct access** — use `settingsStore` / `db` only
- **No `as any`** — strict typing throughout
- **No breaking existing manual-start behavior** — auto-detection is additive
- **Web Worker support is optional (Task 16.3)** — skip for MVP

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision

- **Infrastructure exists**: YES (ESLint + TypeScript strict; no jest/vitest found)
- **Automated tests**: NO (no test runner configured; fast-check property tests in spec are optional)
- **Framework**: none
- **Primary verification**: Agent-Executed QA Scenarios for every task

### QA Policy

Every task includes agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **TypeScript compile check**: `pnpm build` or `pnpm tsc --noEmit`
- **API/logic**: Node/Bun REPL — import module, call functions, assert output
- **UI**: Playwright — navigate to brewing page, trigger detection flow, screenshot

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — all independent):
├── Task 1: types.ts — all interfaces [quick]
├── Task 2a: db.ts — AppSettings extension [quick]
└── Task 2b: settingsStore.ts — default + updateAutoPourDetection [quick]

Wave 2 (Core modules — max parallel, depend on Task 1):
├── Task 3: CameraManager.ts [unspecified-high]
├── Task 4: FrameProcessor.ts [unspecified-high]
├── Task 5: FrameDiffDetector.ts [deep]
└── Task 6: DetectionStateMachine.ts [deep]

Wave 3 (Integration layer — depends on Wave 2):
├── Task 7: PourDetector.ts — coordinator (depends: 3,4,5,6) [deep]
├── Task 8: UndoController.ts — independent [quick]
├── Task 9: Toast extension — action-button support [visual-engineering]
└── Task 10: UI components (CameraActiveIndicator, DetectionStateIndicator, UndoButton) [visual-engineering]

Wave 4 (Top-level integration — depends on Wave 3):
├── Task 11: BrewingTimer.tsx integration (depends: 7,8,9,10) [deep]
├── Task 12: AutoPourDetectionSettings.tsx + ExperimentalSettings.tsx (depends: 2b) [visual-engineering]
└── Task 13: index.ts barrel + cleanup [quick]

Wave FINAL (Parallel verification):
├── F1: Plan compliance audit [oracle]
├── F2: TypeScript + lint check [unspecified-high]
├── F3: Full QA scenario replay [unspecified-high]
└── F4: Scope fidelity check [deep]
→ Present results → Get explicit user okay
```

**Critical Path**: T1 → T5+T6 → T7 → T11 → Final
**Max Concurrent**: 4 (Waves 2 and 3)

---

## TODOs

---

- [ ] 1. `src/components/brewing/AutoPourDetection/types.ts` — Define all shared TypeScript interfaces

  **What to do**:
  - Create directory `src/components/brewing/AutoPourDetection/`
  - Create `types.ts` with the following exported interfaces (copy exactly from `specs/auto-timer-on-pour-detection/design.md` sections "数据模型" and "组件和接口"):
    - `AutoPourDetectionSettings` — full settings model (mode, frameDiffThreshold, minMotionRatio, requiredConsecutiveDetections, stateTimeout, cooldownDuration, maxMotionRatio, cameraFacingMode, videoResolution, frameRate, showCameraPreview, showDebugOverlay, autoStopCamera, showToastNotification, undoWindowDuration, downsampleScale, regionOfInterest)
    - `CameraState`, `CameraError`, `CameraDevice`, `VideoStreamConfig`, `CameraInitResult`, `PermissionStatus`, `VideoStreamStatus`
    - `VideoFrame` — `{ data: ImageData; timestamp: number; width: number; height: number }`
    - `FrameDiffResult`, `MotionAnalysis`
    - `DetectionConfig`, `DetectionResult`, `DetectionStatus`
    - `StateMachineEvent`, `StateTransitionResult`, `StateHistoryEntry`
    - `UndoState`
  - Export type `DetectionMode = 'auto-start' | 'remind-only' | 'off'`
  - Export type `StateMachineState = 'idle' | 'monitoring' | 'preparing' | 'triggered' | 'cooldown'`

  **Must NOT do**:
  - No runtime logic — types only
  - No imports from other project files (no circular deps at foundation layer)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure type definitions, no logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T2a, T2b — they are fully independent)
  - **Parallel Group**: Wave 1 (with Tasks 2a, 2b)
  - **Blocks**: Tasks 3, 4, 5, 6, 7, 8, 10, 11, 12
  - **Blocked By**: None

  **References**:
  - `specs/auto-timer-on-pour-detection/design.md` lines 574–1009 — all interface definitions (copy verbatim, translate to TypeScript)
  - `src/lib/core/db.ts` lines 1–314 — pattern for how interfaces are defined in this codebase

  **Acceptance Criteria**:
  - [ ] `src/components/brewing/AutoPourDetection/types.ts` exists and compiles: `pnpm tsc --noEmit` → 0 errors

  **QA Scenarios**:

  ```
  Scenario: TypeScript compilation succeeds
    Tool: Bash
    Steps:
      1. Run: pnpm tsc --noEmit 2>&1 | head -30
      2. Check output contains 0 errors
    Expected Result: No TypeScript errors related to AutoPourDetection types
    Evidence: .sisyphus/evidence/task-1-tsc-check.txt
  ```

  **Commit**: NO (groups with T2a, T2b, T13 into one commit)

---

- [ ] 2a. `src/lib/core/db.ts` — Extend `AppSettings` interface with `autoPourDetection`

  **What to do**:
  - Open `src/lib/core/db.ts`
  - Find the `AppSettings` interface (currently ends around line 313)
  - Add at the end of the interface (before the closing `}`):
    ```typescript
    // 自动注水检测设置
    autoPourDetection?: AutoPourDetectionSettings;
    ```
  - Add import at top of file (after existing imports):
    ```typescript
    import type { AutoPourDetectionSettings } from '@/components/brewing/AutoPourDetection/types';
    ```
  - Do NOT change the database version number — `autoPourDetection` is optional and stored inside the existing `appSettings.data` JSON blob; no schema migration needed

  **Must NOT do**:
  - Do NOT bump the Dexie version number
  - Do NOT add a new Dexie table
  - Do NOT modify any existing fields

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1, with T1 and T2b)
  - **Blocks**: Task 2b (needs the type to set default), Task 12
  - **Blocked By**: Task 1 (needs `AutoPourDetectionSettings` type)

  **References**:
  - `src/lib/core/db.ts` lines 250–314 — existing `AppSettings` fields pattern
  - `src/components/brewing/AutoPourDetection/types.ts` — `AutoPourDetectionSettings` interface (created in T1)

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors after adding the import and field

  **QA Scenarios**:

  ```
  Scenario: AppSettings type extension compiles
    Tool: Bash
    Steps:
      1. Run: pnpm tsc --noEmit 2>&1 | grep -i "db.ts"
      2. Check: no errors on db.ts
    Expected Result: Empty output (no errors)
    Evidence: .sisyphus/evidence/task-2a-tsc.txt
  ```

  **Commit**: NO (groups with T1, T2b, T13)

---

- [ ] 2b. `src/lib/stores/settingsStore.ts` — Add `autoPourDetection` default + update helper

  **What to do**:
  - Open `src/lib/stores/settingsStore.ts`
  - Find `defaultSettings` object (search for `const defaultSettings`)
  - Add the default value at the end of `defaultSettings`:
    ```typescript
    autoPourDetection: {
      enabled: false,
      mode: 'off' as const,
      frameDiffThreshold: 25,
      minMotionRatio: 0.02,
      maxMotionRatio: 0.8,
      requiredConsecutiveDetections: 6,
      stateTimeout: 5000,
      cooldownDuration: 2000,
      cameraDeviceId: null,
      cameraFacingMode: 'user' as const,
      videoResolution: { width: 320, height: 240 },
      frameRate: 30,
      showCameraPreview: false,
      showDebugOverlay: false,
      autoStopCamera: true,
      showToastNotification: true,
      undoWindowDuration: 2000,
      useWebWorker: false,
      downsampleScale: 1.0,
      regionOfInterest: null,
    },
    ```
  - In the `SettingsStore` interface (around line 220), add:
    ```typescript
    updateAutoPourDetectionSettings: (
      updates: Partial<AutoPourDetectionSettings>
    ) => Promise<void>;
    ```
  - In the `create<SettingsStore>()` implementation, add the method implementation (follow the pattern of `updateLayoutSettings`):
    ```typescript
    updateAutoPourDetectionSettings: async (updates) => {
      const current = get().settings.autoPourDetection ?? defaultSettings.autoPourDetection!;
      await get().updateSettings({ autoPourDetection: { ...current, ...updates } });
    },
    ```
  - Add import at top: `import type { AutoPourDetectionSettings } from '@/components/brewing/AutoPourDetection/types';`

  **Must NOT do**:
  - Do NOT change existing defaults
  - Do NOT use `localStorage` directly

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1, after T1 and T2a complete)
  - **Blocks**: Task 11, Task 12
  - **Blocked By**: Task 1, Task 2a

  **References**:
  - `src/lib/stores/settingsStore.ts` lines 220–305 — `SettingsStore` interface pattern
  - `src/lib/stores/settingsStore.ts` lines 361–370 — `updateSettings` implementation (the base method to call)
  - `src/lib/stores/settingsStore.ts` — search for `updateLayoutSettings` to see the pattern for sub-object updaters

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors
  - [ ] `useSettingsStore.getState().settings.autoPourDetection.mode` returns `'off'` on fresh load

  **QA Scenarios**:

  ```
  Scenario: Default setting is 'off' mode
    Tool: Bash (Node REPL or dev console)
    Steps:
      1. pnpm tsc --noEmit 2>&1 | grep settingsStore
      2. Check: 0 errors
    Expected Result: No errors
    Evidence: .sisyphus/evidence/task-2b-tsc.txt
  ```

  **Commit**: NO (groups with T1, T2a, T13)

---

- [ ] 3. `src/components/brewing/AutoPourDetection/CameraManager.ts` — Camera access and stream lifecycle

  **What to do**:
  - Create `CameraManager.ts` as a class implementing the `CameraManager` interface from `types.ts`
  - `initialize()`: Check if `navigator.mediaDevices` is available (browser), or detect Capacitor environment. Return `CameraInitResult`.
  - `requestPermission()`: Call `navigator.mediaDevices.getUserMedia({ video: true })` to trigger permission prompt; stop the stream immediately after (permission check only). Return `'granted' | 'denied' | 'prompt'`. Catch `NotAllowedError` → `'denied'`, `NotFoundError` → throw with code `DEVICE_NOT_FOUND`.
  - `startVideoStream(config: VideoStreamConfig)`: Call `navigator.mediaDevices.getUserMedia({ video: { facingMode: config.facingMode ?? 'user', width: config.width, height: config.height, frameRate: config.frameRate } })`. Store the returned `MediaStream` internally. Set internal `status` to `'active'`.
  - `stopVideoStream()`: Call `stream.getTracks().forEach(t => t.stop())`. Set `srcObject = null` on video element if bound. Set internal `status` to `'idle'`.
  - `getAvailableCameras()`: Call `navigator.mediaDevices.enumerateDevices()`, filter `kind === 'videoinput'`.
  - `switchCamera(deviceId)`: Stop current stream, call `startVideoStream` with the new `deviceId`.
  - `getStreamStatus()`: Return internal `status` field.
  - Store `MediaStream | null` in a private field `_stream`.
  - Export as `default` class.

  **Must NOT do**:
  - No Capacitor plugin calls for MVP (browser MediaDevices only; Capacitor is future work)
  - No auto-starting the stream — caller controls lifecycle
  - No storing video to disk

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Browser API integration with error handling and cross-environment concerns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2, parallel with T4, T5, T6)
  - **Blocks**: Task 7 (PourDetector coordinator)
  - **Blocked By**: Task 1 (types)

  **References**:
  - `specs/auto-timer-on-pour-detection/design.md` lines 576–638 — `CameraManager` interface specification
  - `src/components/brewing/AutoPourDetection/types.ts` — `CameraInitResult`, `VideoStreamConfig`, `CameraDevice`, `VideoStreamStatus`, `PermissionStatus` types
  - MDN: `navigator.mediaDevices.getUserMedia()` constraints format

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors
  - [ ] Class instantiates without error in browser context

  **QA Scenarios**:

  ```
  Scenario: CameraManager compiles cleanly
    Tool: Bash
    Steps:
      1. Run: pnpm tsc --noEmit 2>&1 | grep CameraManager
    Expected Result: No errors
    Evidence: .sisyphus/evidence/task-3-tsc.txt

  Scenario: Permission denial is handled gracefully
    Tool: Playwright
    Preconditions: Browser with camera permissions denied
    Steps:
      1. Navigate to http://localhost:3000 (pnpm dev must be running)
      2. Open DevTools console
      3. Paste: const cm = new (await import('./src/components/brewing/AutoPourDetection/CameraManager.ts')).default(); const result = await cm.requestPermission(); console.log(result);
      4. Assert result is 'denied' (not an exception)
    Expected Result: Returns 'denied' string
    Evidence: .sisyphus/evidence/task-3-permission-denied.png
  ```

  **Commit**: NO (groups into T13 commit)

---

- [ ] 4. `src/components/brewing/AutoPourDetection/FrameProcessor.ts` — Video frame extraction

  **What to do**:
  - Create `FrameProcessor.ts` as a class
  - Private fields: `_videoEl: HTMLVideoElement | null`, `_canvas: HTMLCanvasElement`, `_ctx: CanvasRenderingContext2D`, `_captureHandle: number | null`, `_frameCallback: ((frame: VideoFrame) => void) | null`, `_useVideoFrameCallback: boolean`
  - `initialize(videoElement: HTMLVideoElement)`: Store reference, create an offscreen canvas matching video dimensions, get 2D context. Check if `'requestVideoFrameCallback' in videoElement` and set `_useVideoFrameCallback`.
  - `startCapture(frameRate: number)`: If `_useVideoFrameCallback`, register via `videoElement.requestVideoFrameCallback(() => captureAndCallback())`. Else use `setInterval(() => captureAndCallback(), 1000 / frameRate)`. Store handle.
  - `stopCapture()`: Clear interval or cancel `requestVideoFrameCallback`. Set `_captureHandle = null`.
  - `getCurrentFrame(): VideoFrame | null`: Draw video to canvas via `ctx.drawImage(video, 0, 0, width, height)`. Return `ctx.getImageData(0, 0, width, height)` wrapped in `VideoFrame`.
  - `onFrameReady(callback)`: Store `_frameCallback`.
  - Private `captureAndCallback()`: Call `getCurrentFrame()`, if not null call `_frameCallback(frame)`.
  - `supportsVideoFrameCallback()`: Return `_useVideoFrameCallback`.

  **Must NOT do**:
  - No DOM manipulation outside the canvas
  - No storing frames in memory beyond the current frame

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Canvas API + browser-specific API (`requestVideoFrameCallback`) with fallback
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2, parallel with T3, T5, T6)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1 (types)

  **References**:
  - `specs/auto-timer-on-pour-detection/design.md` lines 732–764 — `FrameProcessor` interface specification
  - `src/components/brewing/AutoPourDetection/types.ts` — `VideoFrame` type

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors

  **QA Scenarios**:

  ```
  Scenario: FrameProcessor compiles without errors
    Tool: Bash
    Steps:
      1. pnpm tsc --noEmit 2>&1 | grep FrameProcessor
    Expected Result: No errors
    Evidence: .sisyphus/evidence/task-4-tsc.txt
  ```

  **Commit**: NO (groups into T13 commit)

---

- [ ] 5. `src/components/brewing/AutoPourDetection/FrameDiffDetector.ts` — Layer 1: pixel-level motion analysis

  **What to do**:
  - Create `FrameDiffDetector.ts` as a class
  - `computeFrameDiff(currentFrame: ImageData, previousFrame: ImageData): FrameDiffResult`:
    - Assert same dimensions. Use grayscale conversion: `gray = 0.299*r + 0.587*g + 0.114*b`
    - Iterate all pixels: compute `diff = abs(currentGray - prevGray)`, build `diffMap: number[][]`
    - Accumulate: `totalDiff`, `motionPixelCount` (where `diff > threshold`), `maxDiff`
    - `motionRatio = motionPixelCount / (width * height)`
    - `isLargeSceneChange = motionRatio > 0.8`
    - Return `FrameDiffResult` (see types.ts)
    - **Performance target**: ≤5ms for 320×240
  - `detectDownwardMotion(diffMap: number[][], threshold: number): MotionAnalysis`:
    - Iterate diffMap; accumulate `totalMotionPixels`, `motionCenterX`, `motionCenterY`, `topRegionMotion` (where `y < height/3`)
    - Normalize center: divide by `totalMotionPixels * width/height`
    - Determine `motionRegion`: center_y < 0.33 → 'top', < 0.67 → 'middle', else 'bottom'
    - `verticalBias`: calculate as (bottom-half motion pixels − top-half motion pixels) / totalMotionPixels; positive = downward
    - `isDownward = verticalBias > 0.3`
    - `areaChangeRatio`: compare current bounding box area to previous (use private `_previousROI` field)
    - `motionScore = clamp(0.5 * topRegionRatio + 0.3 * max(0, areaChangeRatio) + 0.2 * max(0, verticalBias), 0, 1)`
    - `hasMotion = motionScore >= 0.3`
  - `isPouringMotion(motionAnalysis: MotionAnalysis): boolean`:
    - `isTopRegionMotion = region === 'top' && motionScore >= 0.5`
    - `hasDownwardBias = isDownward && verticalBias > 0.3`
    - `hasAreaIncrease = areaChangeRatio > 0.2`
    - Return `isTopRegionMotion && (hasDownwardBias || hasAreaIncrease)`

  **Must NOT do**:
  - No `new ImageData()` allocation per frame — reuse caller-provided data
  - No 2D array `new Array()` — use `Float32Array` for diffMap if performance allows, or a flat typed array
  - No external library (no OpenCV, no canvas library)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Pixel-level algorithm with performance constraints; must match pseudocode exactly
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2, parallel with T3, T4, T6)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References**:
  - `specs/auto-timer-on-pour-detection/design.md` lines 766–813 — `FrameDiffDetector` interface and pseudocode
  - `specs/auto-timer-on-pour-detection/design.md` lines 1236–1445 — detailed algorithm pseudocode for `computeFrameDiff` and `detectDownwardMotion`
  - `src/components/brewing/AutoPourDetection/types.ts` — `FrameDiffResult`, `MotionAnalysis` types

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors
  - [ ] `motionRatio` is always in [0, 1]
  - [ ] `motionScore` is always in [0, 1]
  - [ ] `isLargeSceneChange = true` when all pixels differ (solid color swap)

  **QA Scenarios**:

  ```
  Scenario: Zero-motion frames produce hasMotion=false
    Tool: Bash (bun repl)
    Steps:
      1. Create two identical 320x240 ImageData objects (all zeros)
      2. Call computeFrameDiff(frame, frame)
      3. Assert result.motionRatio === 0
      4. Call detectDownwardMotion(result.diffMap, 25)
      5. Assert analysis.hasMotion === false
    Expected Result: No motion detected on identical frames
    Evidence: .sisyphus/evidence/task-5-zero-motion.txt

  Scenario: Full-screen change triggers isLargeSceneChange
    Tool: Bash (bun repl)
    Steps:
      1. Create currentFrame (all white: 255,255,255)
      2. Create previousFrame (all black: 0,0,0)
      3. Call computeFrameDiff(current, previous)
      4. Assert result.isLargeSceneChange === true
      5. Assert result.motionRatio > 0.8
    Expected Result: isLargeSceneChange=true
    Evidence: .sisyphus/evidence/task-5-scene-change.txt
  ```

  **Commit**: NO (groups into T13 commit)

---

- [ ] 6. `src/components/brewing/AutoPourDetection/DetectionStateMachine.ts` — Layer 2: state transitions

  **What to do**:
  - Create `DetectionStateMachine.ts` as a class
  - Private fields: `state: StateMachineState = 'idle'`, `_consecutiveCount = 0`, `_cooldownStart: number | null = null`, `_consecutiveNoMotion = 0`, `_stateHistory: StateHistoryEntry[] = []`, `_lastEventTime: number`
  - `transition(event: StateMachineEvent): StateTransitionResult`:
    - Implement the state machine from pseudocode in design.md lines 1576–1686:
      - `idle` + `motion_detected` + `motionRegion === 'top'` → `monitoring`
      - `monitoring` + `motion_detected` + top + score >= 0.5 → `preparing`; `no_motion | scene_change` → `idle`
      - `preparing` + qualifying motion → increment `_consecutiveCount`; if >= `requiredConsecutiveDetections` → `triggered` (set `shouldTriggerTimer = true`); `no_motion | scene_change` → reset count, back to `monitoring`
      - `triggered` + `manual_reset` → `cooldown` (set `_cooldownStart`)
      - `cooldown`: check elapsed time >= `cooldownDuration` → `idle`; on `no_motion` increment `_consecutiveNoMotion`; if >= 10 → `idle`; on `motion_detected` reset `_consecutiveNoMotion`
    - Timeout check: if `currentTime - _lastEventTime > config.stateTimeout` → `idle`
    - Append to `_stateHistory` on every transition
  - `reset()`: Transition to `cooldown` (not `idle`). Set `_cooldownStart = Date.now()`.
  - `getConsecutiveCount()`: Return `_consecutiveCount`
  - `getCooldownRemaining()`: Return `max(0, cooldownDuration - (Date.now() - _cooldownStart))`
  - `getStateHistory()`: Return `_stateHistory`
  - Constructor accepts `config: Pick<DetectionConfig, 'requiredConsecutiveDetections' | 'stateTimeout' | 'cooldownDuration'>`

  **Must NOT do**:
  - No async code in state machine — all transitions are synchronous
  - `reset()` must go to `cooldown`, NOT `idle` (per spec)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: State machine correctness is critical; must exactly match pseudocode
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2, parallel with T3, T4, T5)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References**:
  - `specs/auto-timer-on-pour-detection/design.md` lines 816–872 — `DetectionStateMachine` interface
  - `specs/auto-timer-on-pour-detection/design.md` lines 1576–1686 — full state machine pseudocode
  - `src/components/brewing/AutoPourDetection/types.ts` — `StateMachineEvent`, `StateTransitionResult`, `StateHistoryEntry`, `StateMachineState`

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors
  - [ ] `shouldTriggerTimer = true` ONLY on `preparing → triggered` transition
  - [ ] `reset()` → state becomes `'cooldown'`, not `'idle'`
  - [ ] After `manual_reset` + 2 seconds elapsed → state becomes `'idle'`

  **QA Scenarios**:

  ```
  Scenario: Happy path — 6 consecutive motion events trigger timer
    Tool: Bash (bun repl)
    Steps:
      1. Instantiate with requiredConsecutiveDetections=6
      2. Send motion_detected(region='top', score=0.8) × 1 → state='monitoring'
      3. Send motion_detected(region='top', score=0.8) × 1 → state='preparing'
      4. Send motion_detected(region='top', score=0.8) × 6 → state='triggered', shouldTriggerTimer=true
      5. Assert final state === 'triggered'
    Expected Result: Timer triggered after 6 preparing-state events
    Evidence: .sisyphus/evidence/task-6-happy-path.txt

  Scenario: Cooldown after manual_reset
    Tool: Bash (bun repl)
    Steps:
      1. Get to 'triggered' state (as above)
      2. Call transition({ type: 'manual_reset', ... })
      3. Assert state === 'cooldown'
      4. Call reset() and wait 2100ms
      5. Send no_motion events × 10
      6. Assert state === 'idle'
    Expected Result: State returns to 'idle' after cooldown
    Evidence: .sisyphus/evidence/task-6-cooldown.txt
  ```

  **Commit**: NO (groups into T13 commit)

---

- [ ] 7. `src/components/brewing/AutoPourDetection/PourDetector.ts` — Two-layer pipeline coordinator

  **What to do**:
  - Create `PourDetector.ts` as a class
  - Constructor accepts `config: DetectionConfig`
  - Private fields: `_frameDiff: FrameDiffDetector`, `_stateMachine: DetectionStateMachine`, `_onPourDetected: (() => void) | null`, `_isActive: boolean`, `_frameCount: number`, `_layer1Times: number[]`, `_layer2Times: number[]`, `_droppedFrames: number`
  - `startDetection(config: DetectionConfig)`: Set `_isActive = true`, reset state machine
  - `stopDetection()`: Set `_isActive = false`
  - `processFrame(frame: VideoFrame): DetectionResult`:
    - If not active, return early
    - Layer 1: call `_frameDiff.computeFrameDiff(frame.data, _previousFrame)` + `detectDownwardMotion()`. Track time.
    - If `isLargeSceneChange`: send `scene_change` event to state machine; skip Layer 2
    - If `!hasMotion`: send `no_motion` event; skip Layer 2
    - Layer 2: call `_stateMachine.transition({ type: 'motion_detected', motionScore, isDownward, motionRegion, timestamp })`. Track time.
    - If `result.shouldTriggerTimer && _onPourDetected`: call `_onPourDetected()` once; set `_isActive = false` (single trigger)
    - Update `_previousFrame = frame.data`
    - Return `DetectionResult`
  - `onPourDetected(callback)`: Store `_onPourDetected`
  - `getDetectionStatus(): DetectionStatus`: Compute averages from `_layer1Times`, `_layer2Times`; calculate FPS from frame timestamps
  - `updateConfig(config)`: Update internal config, reset state machine

  **Must NOT do**:
  - `onPourDetected` callback must fire at most ONCE per `startDetection` call (single trigger guarantee)
  - No async operations inside `processFrame` — must be synchronous

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Coordinates two layers; single-trigger guarantee must be correct
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T8, T9 in Wave 3)
  - **Blocks**: Task 11
  - **Blocked By**: Tasks 3, 4, 5, 6

  **References**:
  - `specs/auto-timer-on-pour-detection/design.md` lines 640–729 — `PourDetector` interface
  - `specs/auto-timer-on-pour-detection/design.md` lines 1122–1233 — main detection algorithm pseudocode
  - Tasks 5 and 6 outputs: `FrameDiffDetector`, `DetectionStateMachine`

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors
  - [ ] `onPourDetected` fires exactly once per detection cycle even with multiple triggering frames
  - [ ] `getDetectionStatus()` returns valid `DetectionStatus` with non-null values

  **QA Scenarios**:

  ```
  Scenario: Single trigger guarantee
    Tool: Bash (bun repl)
    Steps:
      1. Create PourDetector with requiredConsecutiveDetections=2
      2. Register onPourDetected callback that increments counter
      3. Process 10 identical "strong motion" frames
      4. Assert counter === 1 (not 10)
    Expected Result: Callback fires exactly once
    Evidence: .sisyphus/evidence/task-7-single-trigger.txt
  ```

  **Commit**: NO (groups into T13 commit)

---

- [ ] 8. `src/components/brewing/AutoPourDetection/UndoController.ts` — 2-second undo window

  **What to do**:
  - Create `UndoController.ts` as a class
  - Private fields: `_timerSnapshot: { currentTime: number; isRunning: boolean; hasStartedOnce: boolean } | null`, `_intervalId: ReturnType<typeof setInterval> | null`, `_remainingMs: number`, `_onUndo: (() => void) | null`, `_onExpire: (() => void) | null`, `_onTick: ((remaining: number) => void) | null`
  - `startUndoWindow(duration: number, snapshot, callbacks: { onUndo, onExpire, onTick })`:
    - Store `_timerSnapshot = snapshot`
    - Set `_remainingMs = duration`
    - Start `setInterval` at 100ms intervals; decrement `_remainingMs` by 100 each tick
    - Call `onTick(_remainingMs)` each tick
    - When `_remainingMs <= 0`: clear interval, call `onExpire()`
  - `undo()`:
    - Clear interval
    - Call `_onUndo()` with snapshot (caller restores timer state)
  - `cancelUndoWindow()`: Clear interval, `_remainingMs = 0`
  - `isUndoAvailable()`: Return `_remainingMs > 0`
  - `getRemainingTime()`: Return `_remainingMs`

  **Must NOT do**:
  - Do NOT call `resetTimer()` or `clearTimerAndStates()` directly — pass via `onUndo` callback
  - `undo()` must be idempotent (calling twice has no extra effect)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward timer/callback pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3, independent)
  - **Blocks**: Task 11
  - **Blocked By**: Task 1

  **References**:
  - `specs/auto-timer-on-pour-detection/design.md` lines 874–912 — `UndoController` interface
  - `specs/auto-timer-on-pour-detection/design.md` lines 380–410 — UX pseudocode for undo countdown

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors
  - [ ] `isUndoAvailable()` returns `false` after 2 seconds
  - [ ] Double-calling `undo()` does not call `onUndo` twice

  **QA Scenarios**:

  ```
  Scenario: Undo window expires after 2 seconds
    Tool: Bash (bun repl / fake timers)
    Steps:
      1. Create UndoController
      2. Call startUndoWindow(2000, snapshot, callbacks)
      3. Advance time 2100ms (fake timers or await)
      4. Assert isUndoAvailable() === false
      5. Assert onExpire was called exactly once
    Expected Result: Window expires at 2s, onExpire fires
    Evidence: .sisyphus/evidence/task-8-expiry.txt
  ```

  **Commit**: NO (groups into T13 commit)

---

- [ ] 9. `src/components/common/feedback/LightToast.tsx` — Extend to support action buttons

  **What to do**:
  - Open `src/components/common/feedback/LightToast.tsx`
  - Read current `showToast()` signature and internal implementation
  - Extend `ToastOptions` (or equivalent internal type) to add:
    ```typescript
    action?: {
      label: string;
      onClick: () => void;
    };
    ```
  - In the toast render function (the JSX returned), add a conditional action button below the message:
    ```tsx
    {
      options.action && (
        <button
          className="mt-2 text-sm font-medium underline"
          onClick={() => {
            options.action!.onClick();
          }}
        >
          {options.action.label}
        </button>
      );
    }
    ```
  - Style the button to match existing toast aesthetics (use Tailwind, no new CSS files)
  - The existing four `showToast` call sites must NOT be broken — `action` is optional

  **Must NOT do**:
  - Do not create a new toast component — extend the existing one
  - Do not change the existing `showToast()` API signature (only additive extension)
  - Do not modify existing toast duration or position logic

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component modification; needs visual correctness
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3, parallel with T8 and T10)
  - **Blocks**: Task 11
  - **Blocked By**: None (independent of Wave 2 outputs)

  **References**:
  - `src/components/common/feedback/LightToast.tsx` — full file (read before editing)
  - `specs/auto-timer-on-pour-detection/design.md` lines 315–357 — Toast 2 and Toast 4 specs (the two that need action buttons)
  - `src/components/settings/ExperimentalSettings.tsx` — Tailwind class patterns used in this codebase

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors
  - [ ] Existing `showToast()` calls work unchanged
  - [ ] `showToast({ type: 'info', title: 'Test', action: { label: 'Go', onClick: () => {} } })` renders a clickable button

  **QA Scenarios**:

  ```
  Scenario: Action button renders in info toast
    Tool: Playwright
    Preconditions: pnpm dev running at localhost:3000
    Steps:
      1. Navigate to http://localhost:3000
      2. Open browser DevTools console
      3. Execute: window.__showToast?.({ type: 'info', title: '检测到注水，点击开始', action: { label: '开始', onClick: () => console.log('clicked') } })
         (Or trigger via any page action that calls showToast)
      4. Assert toast container is visible: div[data-toast] or equivalent selector
      5. Assert button with text "开始" exists inside toast
      6. Click the button, assert console logs "clicked"
    Expected Result: Toast shows with action button, button is clickable
    Evidence: .sisyphus/evidence/task-9-toast-action.png

  Scenario: Existing toasts (no action) still work
    Tool: Playwright
    Steps:
      1. Trigger any existing toast (e.g., save a setting)
      2. Assert no JS errors in console
      3. Assert toast appears and auto-dismisses
    Expected Result: No regressions
    Evidence: .sisyphus/evidence/task-9-no-regression.png
  ```

  **Commit**: NO (groups into T13 commit)

---

- [ ] 10. `src/components/brewing/AutoPourDetection/components/` — UI feedback components

  **What to do**:
  - Create three components in `src/components/brewing/AutoPourDetection/components/`:

  **`CameraActiveIndicator.tsx`**:
  - Props: `onStop: () => void`
  - Render: small bar at top of parent containing a pulsing red dot (`●`) + text "摄像头已启用" + a "停止" button
  - Pulsing red dot: Tailwind `animate-pulse bg-red-500 rounded-full w-2 h-2`
  - "停止" button: calls `onStop()` prop
  - Use `className="flex items-center gap-2 px-3 py-1 bg-black/20 rounded-full text-sm"`

  **`DetectionStateIndicator.tsx`**:
  - Props: `state: StateMachineState; consecutiveCount: number; motionScore: number; processingTimeMs: number; visible: boolean`
  - Renders only when `visible === true`
  - Small debug overlay: four lines of monospace text: `状态: {state}`, `连续检测: {consecutiveCount}/N`, `运动分数: {motionScore.toFixed(2)}`, `处理时间: {processingTimeMs.toFixed(1)}ms`
  - Use `className="font-mono text-xs bg-black/60 text-white p-2 rounded"`

  **`UndoButton.tsx`**:
  - Props: `remainingMs: number; onUndo: () => void; visible: boolean`
  - Renders only when `visible === true`
  - Shows: `↶ 撤销 ({Math.ceil(remainingMs / 1000)}s)` as a button
  - Use `className="px-4 py-2 bg-neutral-800/80 text-white rounded-full text-sm"`
  - Calls `onUndo()` on click

  **Must NOT do**:
  - No inline styles — Tailwind only
  - No state inside these components — all data via props

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI components needing visual correctness and Tailwind styling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3, parallel with T8, T9)
  - **Blocks**: Task 11
  - **Blocked By**: Task 1

  **References**:
  - `specs/auto-timer-on-pour-detection/design.md` lines 412–523 — UX specs for each component
  - `src/components/settings/ExperimentalSettings.tsx` — Tailwind class style reference
  - `src/components/common/feedback/LightToast.tsx` — component structure reference

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors
  - [ ] `CameraActiveIndicator` renders red dot + "停止" button
  - [ ] `UndoButton` shows correct countdown seconds
  - [ ] `DetectionStateIndicator` hidden when `visible=false`

  **QA Scenarios**:

  ```
  Scenario: UndoButton shows correct countdown
    Tool: Playwright
    Steps:
      1. Render UndoButton with remainingMs=1500, visible=true in Storybook or test page
      2. Assert text contains "2s" (Math.ceil(1500/1000)=2)
      3. Assert button is visible
    Expected Result: Shows "↶ 撤销 (2s)"
    Evidence: .sisyphus/evidence/task-10-undo-button.png

  Scenario: DetectionStateIndicator hidden when visible=false
    Tool: Playwright
    Steps:
      1. Render DetectionStateIndicator with visible=false
      2. Assert component DOM is not rendered (or display:none)
    Expected Result: Not visible
    Evidence: .sisyphus/evidence/task-10-state-indicator-hidden.png
  ```

  **Commit**: NO (groups into T13 commit)

---

- [ ] 11. `src/components/brewing/BrewingTimer.tsx` — Integrate auto pour detection

  **What to do**:

  **11a. Imports and refs** (add near top of file, after existing imports at line ~41):

  ```typescript
  import {
    CameraManager,
    PourDetector,
    UndoController,
  } from '@/components/brewing/AutoPourDetection';
  import CameraActiveIndicator from '@/components/brewing/AutoPourDetection/components/CameraActiveIndicator';
  import DetectionStateIndicator from '@/components/brewing/AutoPourDetection/components/DetectionStateIndicator';
  import UndoButton from '@/components/brewing/AutoPourDetection/components/UndoButton';
  import { showToast } from '@/components/common/feedback/LightToast';
  ```

  Add refs (after existing refs, around line ~200):

  ```typescript
  const cameraManagerRef = useRef<CameraManager | null>(null);
  const pourDetectorRef = useRef<PourDetector | null>(null);
  const undoControllerRef = useRef<UndoController | null>(null);
  ```

  Add state (near existing `useState` declarations):

  ```typescript
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showUndoButton, setShowUndoButton] = useState(false);
  const [undoRemainingMs, setUndoRemainingMs] = useState(0);
  const [debugState, setDebugState] = useState<{
    state: string;
    consecutiveCount: number;
    motionScore: number;
    processingTimeMs: number;
  }>({
    state: 'idle',
    consecutiveCount: 0,
    motionScore: 0,
    processingTimeMs: 0,
  });
  const [highlightPlayButton, setHighlightPlayButton] = useState(false);
  ```

  **11b. `startTimerImmediately()` function** (add after `startCountdown`, around line ~540):

  ```typescript
  const startTimerImmediately = useCallback(() => {
    // Zero-delay start — skips 3s countdown, directly starts main timer
    clearTimerAndStates();
    setIsRunning(true);
    setHasStartedOnce(true);
    startMainTimer();
  }, [clearTimerAndStates, startMainTimer]);
  ```

  **11c. `handlePourDetected()` callback** (add after `startTimerImmediately`):

  ```typescript
  const handlePourDetected = useCallback(() => {
    const autoPourSettings =
      useSettingsStore.getState().settings.autoPourDetection;
    if (!autoPourSettings || autoPourSettings.mode === 'off') return;
    if (isRunning) return; // already running, ignore

    if (autoPourSettings.mode === 'auto-start') {
      // Save snapshot before starting
      const snapshot = { currentTime, isRunning, hasStartedOnce };
      startTimerImmediately();
      showToast({
        type: 'success',
        title: '检测到注水，已开始计时',
        duration: 2000,
      });
      // Start undo window
      undoControllerRef.current = new UndoController();
      undoControllerRef.current.startUndoWindow(
        autoPourSettings.undoWindowDuration ?? 2000,
        snapshot,
        {
          onTick: remaining => {
            setUndoRemainingMs(remaining);
          },
          onExpire: () => {
            setShowUndoButton(false);
          },
          onUndo: () => {}, // handled in handleUndo
        }
      );
      setShowUndoButton(true);
      if (autoPourSettings.autoStopCamera) stopCamera();
    } else if (autoPourSettings.mode === 'remind-only') {
      showToast({
        type: 'info',
        title: '检测到注水，点击开始',
        duration: 3000,
        action: { label: '开始', onClick: () => startTimer() },
      });
      setHighlightPlayButton(true);
      setTimeout(() => setHighlightPlayButton(false), 3000);
    }
  }, [
    isRunning,
    currentTime,
    hasStartedOnce,
    startTimerImmediately,
    startTimer,
  ]);
  ```

  **11d. `handleUndo()` function**:

  ```typescript
  const handleUndo = useCallback(() => {
    undoControllerRef.current?.undo();
    undoControllerRef.current = null;
    setShowUndoButton(false);
    clearTimerAndStates();
    setIsRunning(false);
    setCurrentTime(0);
    setHasStartedOnce(false);
    showToast({ type: 'info', title: '已撤销', duration: 1000 });
    // Restart detection
    initAutoPourDetection();
  }, [clearTimerAndStates]);
  ```

  **11e. `stopCamera()` function**:

  ```typescript
  const stopCamera = useCallback(() => {
    cameraManagerRef.current?.stopVideoStream();
    pourDetectorRef.current?.stopDetection();
    setIsCameraActive(false);
  }, []);
  ```

  **11f. `initAutoPourDetection()` function**:

  ```typescript
  const initAutoPourDetection = useCallback(async () => {
    const settings = useSettingsStore.getState().settings.autoPourDetection;
    if (!settings || settings.mode === 'off') return;

    const cm = new CameraManager();
    await cm.initialize();
    const permission = await cm.requestPermission();
    if (permission === 'denied') {
      showToast({
        type: 'error',
        title: '摄像头权限被拒绝，请在设置中授予权限',
        duration: 5000,
        action: { label: '去设置', onClick: () => {} }, // platform-specific: no-op for web
      });
      return;
    }
    cameraManagerRef.current = cm;
    const stream = await cm.startVideoStream({
      facingMode: settings.cameraFacingMode ?? 'user',
      width: settings.videoResolution?.width ?? 320,
      height: settings.videoResolution?.height ?? 240,
      frameRate: settings.frameRate ?? 30,
    });

    const pd = new PourDetector({
      /* default config from settings */
    });
    pd.onPourDetected(handlePourDetected);
    pourDetectorRef.current = pd;
    pd.startDetection(/* config */);
    setIsCameraActive(true);
  }, [handlePourDetected]);
  ```

  **11g. `useEffect` for lifecycle**:
  - On mount: if `autoPourDetection.mode !== 'off'`, call `initAutoPourDetection()`
  - On unmount cleanup: call `stopCamera()`
  - Add `brewing:reset` event handler to also call `stopCamera()` then re-init if mode active
  - Add `visibilitychange` handler: on `hidden` → `stopCamera()`

  **11h. JSX changes** (in the return section, add inside the existing container div):

  ```tsx
  {
    isCameraActive && <CameraActiveIndicator onStop={stopCamera} />;
  }
  {
    showUndoButton && (
      <UndoButton
        remainingMs={undoRemainingMs}
        onUndo={handleUndo}
        visible={showUndoButton}
      />
    );
  }
  {
    autoPourSettings?.showDebugOverlay && (
      <DetectionStateIndicator {...debugState} visible={true} />
    );
  }
  ```

  - Also pass `className={cn(existingClasses, highlightPlayButton && 'ring-2 ring-green-400 animate-pulse')}` to the play button element (find the play button JSX, add the conditional class)

  **Must NOT do**:
  - Do NOT modify the `startTimer()` function at line 740
  - Do NOT modify `startCountdown()` at line 485
  - Do NOT modify `clearTimerAndStates()` at line 324
  - `startTimerImmediately()` is a NEW separate function — do not replace existing start paths

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex integration into a 1963-line component; must not break existing behavior
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T12 in Wave 4)
  - **Blocks**: Final verification wave
  - **Blocked By**: Tasks 7, 8, 9, 10

  **References**:
  - `src/components/brewing/BrewingTimer.tsx` — read the FULL file before editing; key lines:
    - line 1–42: imports section (add new imports here)
    - line 80–200: component props and state declarations (add new state here)
    - line 324: `clearTimerAndStates()` — use in `handleUndo`
    - line 415: `startMainTimer()` — call in `startTimerImmediately()`
    - line 485: `startCountdown()` — do NOT call in auto-detection path
    - line 740: `startTimer()` — do NOT modify; call in remind-only action
  - `src/components/brewing/AutoPourDetection/index.ts` — imports come from here
  - `specs/auto-timer-on-pour-detection/design.md` lines 100–272 — full UX flow diagrams

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors
  - [ ] `pnpm build` succeeds
  - [ ] Manual start (click play → 3s countdown) still works unchanged
  - [ ] Setting mode to `'auto-start'` and simulating `handlePourDetected()` starts timer immediately
  - [ ] Undo button appears and resets timer when clicked

  **QA Scenarios**:

  ```
  Scenario: Manual start still works (no regression)
    Tool: Playwright
    Preconditions: pnpm dev running, autoPourDetection.mode = 'off'
    Steps:
      1. Navigate to http://localhost:3000
      2. Select any brewing method
      3. Click the play button (selector: button[aria-label="start"] or find the actual selector)
      4. Assert countdown appears: text "3", "2", "1" in sequence
      5. Assert timer starts after countdown
    Expected Result: 3s countdown then timer starts
    Evidence: .sisyphus/evidence/task-11-manual-start.png

  Scenario: Auto-start mode triggers zero-delay timer
    Tool: Playwright + console
    Preconditions: autoPourDetection.mode = 'auto-start' in settings
    Steps:
      1. Navigate to brewing page with a method selected
      2. Open DevTools console
      3. Execute: window.__debugPourDetected?.() (or call handlePourDetected via exposed test hook)
      4. Assert timer starts immediately (currentTime > 0 within 100ms, no countdown shown)
      5. Assert success toast appears with text "检测到注水，已开始计时"
      6. Assert undo button appears with "↶ 撤销 (2s)"
    Expected Result: Timer starts without countdown, toast shown, undo button visible
    Evidence: .sisyphus/evidence/task-11-auto-start.png

  Scenario: Undo restores timer to 0
    Tool: Playwright
    Steps:
      1. Trigger auto-start (as above)
      2. Within 2 seconds, click the undo button
      3. Assert timer resets to 0
      4. Assert "已撤销" toast appears
      5. Assert undo button disappears
    Expected Result: Timer resets, undo confirmed
    Evidence: .sisyphus/evidence/task-11-undo.png
  ```

  **Commit**: `feat(brewing): integrate auto pour detection into BrewingTimer`
  - Files: `src/components/brewing/BrewingTimer.tsx`
  - Pre-commit: `pnpm tsc --noEmit && pnpm lint`

---

- [ ] 12. `src/components/settings/AutoPourDetectionSettings.tsx` + `ExperimentalSettings.tsx` — Settings UI

  **What to do**:

  **Create `src/components/settings/AutoPourDetectionSettings.tsx`**:
  - Import `useSettingsStore` from `@/lib/stores/settingsStore`
  - Import `SettingSection`, `SettingRow`, `SettingToggle` from `@/components/settings/atomic/` (check actual paths in ExperimentalSettings.tsx)
  - Read `settings.autoPourDetection` from store
  - Render a `SettingSection` titled "自动注水检测" with:
    - Warning banner: `此功能正在测试中，可能不稳定` (use `text-yellow-600 text-sm` or existing warning style)
    - **检测模式** (`SettingRow` with radio-like selector or three-option toggle):
      - Options: "自动开始 / 仅提醒 / 关闭"
      - On change: call `updateAutoPourDetectionSettings({ mode: newMode })`
    - **摄像头朝向** (`SettingRow` with two-option selector): "前置（推荐）/ 后置"
      - On change: `updateAutoPourDetectionSettings({ cameraFacingMode: value })`
    - **视频分辨率** (`SettingRow`): "320×240 / 640×480" selector
    - **帧率** (`SettingRow`): "15 / 30 / 60 FPS"
    - **灵敏度** (`SettingSlider` if available): 0–100, maps to `frameDiffThreshold` (100 - value → 0–255 range)
    - **显示调试信息** (`SettingToggle`): maps to `showDebugOverlay`
    - **检测成功后自动停止摄像头** (`SettingToggle`): maps to `autoStopCamera`
  - Export as `default`

  **Modify `src/components/settings/ExperimentalSettings.tsx`**:
  - Add import: `import AutoPourDetectionSettings from './AutoPourDetectionSettings';`
  - Add `<AutoPourDetectionSettings />` inside the existing experimental section JSX (after existing experimental settings items)

  **Must NOT do**:
  - Do not create new atomic setting components — use existing ones from `src/components/settings/atomic/`
  - Do not add a top-level "实验性功能" heading — it already exists in `ExperimentalSettings.tsx`

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Settings UI with multiple controls, needs visual correctness
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 4, parallel with T11)
  - **Blocks**: Final verification wave
  - **Blocked By**: Tasks 2a, 2b

  **References**:
  - `src/components/settings/ExperimentalSettings.tsx` — full file (copy section/row/toggle usage patterns exactly)
  - `src/components/settings/atomic/` — list available atomic components and their props
  - `src/lib/stores/settingsStore.ts` — `updateAutoPourDetectionSettings()` method (created in T2b)
  - `specs/auto-timer-on-pour-detection/design.md` lines 443–473 — settings UI layout spec

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors
  - [ ] Settings section visible in app under Experimental
  - [ ] Changing mode in UI persists to IndexedDB (verify via DevTools → Application → IndexedDB → BrewGuideDB → appSettings)

  **QA Scenarios**:

  ```
  Scenario: Settings section renders in Experimental
    Tool: Playwright
    Preconditions: pnpm dev running
    Steps:
      1. Navigate to settings page (find actual route, likely /settings)
      2. Click "实验性功能" or "Experimental" section
      3. Assert section containing "自动注水检测" is visible
      4. Screenshot the section
    Expected Result: Full settings section visible
    Evidence: .sisyphus/evidence/task-12-settings-visible.png

  Scenario: Mode selection persists across reload
    Tool: Playwright
    Steps:
      1. Navigate to experimental settings
      2. Change detection mode to "自动开始"
      3. Reload the page (F5)
      4. Navigate back to experimental settings
      5. Assert selected mode is still "自动开始"
    Expected Result: Setting persisted in IndexedDB
    Evidence: .sisyphus/evidence/task-12-settings-persist.png
  ```

  **Commit**: `feat(settings): add auto pour detection settings`
  - Files: `src/components/settings/AutoPourDetectionSettings.tsx`, `src/components/settings/ExperimentalSettings.tsx`
  - Pre-commit: `pnpm tsc --noEmit && pnpm lint`

---

- [ ] 13. `src/components/brewing/AutoPourDetection/index.ts` — Barrel exports + final cleanup

  **What to do**:
  - Create `src/components/brewing/AutoPourDetection/index.ts` with barrel exports:
    ```typescript
    export { default as CameraManager } from './CameraManager';
    export { default as FrameProcessor } from './FrameProcessor';
    export { default as FrameDiffDetector } from './FrameDiffDetector';
    export { default as DetectionStateMachine } from './DetectionStateMachine';
    export { default as PourDetector } from './PourDetector';
    export { default as UndoController } from './UndoController';
    export * from './types';
    ```
  - Run `pnpm tsc --noEmit` to verify no circular imports or missing exports
  - Run `pnpm lint` to catch any remaining issues across all new files
  - Fix any lint warnings (unused imports, missing return types if lint requires them)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — must run after ALL other module files are complete
  - **Blocked By**: Tasks 1–12

  **References**:
  - `src/components/brewing/Timer/index.ts` — pattern for existing barrel export in this codebase

  **Acceptance Criteria**:
  - [ ] `pnpm tsc --noEmit` → 0 errors
  - [ ] `pnpm lint` → 0 new errors (pre-existing errors are acceptable)
  - [ ] `pnpm build` succeeds

  **QA Scenarios**:

  ```
  Scenario: Full build succeeds
    Tool: Bash
    Steps:
      1. Run: pnpm build 2>&1 | tail -20
      2. Assert output contains "Export successful" or equivalent success message
    Expected Result: Clean build
    Evidence: .sisyphus/evidence/task-13-build.txt

  Scenario: TypeScript strict check passes
    Tool: Bash
    Steps:
      1. Run: pnpm tsc --noEmit 2>&1
      2. Assert 0 errors
    Expected Result: 0 TypeScript errors
    Evidence: .sisyphus/evidence/task-13-tsc.txt
  ```

  **Commit**: `feat(brewing): add auto pour detection module`
  - Files: all files in `src/components/brewing/AutoPourDetection/`, `src/lib/core/db.ts`, `src/lib/stores/settingsStore.ts`, `src/components/common/feedback/LightToast.tsx`
  - Pre-commit: `pnpm tsc --noEmit && pnpm lint`

---

## Final Verification Wave

> Run all 4 in parallel. ALL must APPROVE. Present consolidated results to user and wait for explicit "okay" before marking complete.

- [ ] F1. **Plan Compliance Audit** — `oracle`
      Read this plan end-to-end. For each "Must Have": read the relevant file and verify implementation exists. For each "Must NOT Have": `grep` codebase for forbidden patterns. Check that `.sisyphus/evidence/` files exist.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **TypeScript + Lint Check** — `unspecified-high`
      Run `pnpm tsc --noEmit` and `pnpm lint`. Review all new/modified files for `as any`, `@ts-ignore`, empty catches, `console.log` in prod paths, commented-out code. Check that all new exports are re-exported from `index.ts`.
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Issues: [list] | VERDICT`

- [ ] F3. **Full QA Scenario Replay** — `unspecified-high` + `playwright` skill
      Start dev server (`pnpm dev`). Execute EVERY QA scenario from EVERY task. Capture screenshots to `.sisyphus/evidence/final-qa/`. Test cross-task integration: auto-start → undo → manual start. Test settings persistence: change mode → reload → verify.
      Output: `Scenarios [N/N pass] | Integration [N/N] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
      For each task: read "What to do", read actual file diff. Verify no missing pieces and no scope creep. Check that `startTimer()` (line 740) was NOT modified. Check that no ML library was added to `package.json`.
      Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- After Task 13 (all new files complete): `feat(brewing): add auto pour detection module`
- After Task 12 (settings UI): `feat(settings): add auto pour detection settings`
- After Task 11 (BrewingTimer integration): `feat(brewing): integrate auto pour detection into BrewingTimer`

---

## Success Criteria

### Verification Commands

```bash
pnpm tsc --noEmit   # Expected: 0 errors
pnpm lint           # Expected: 0 new errors
pnpm build          # Expected: successful static export
```

### Final Checklist

- [ ] All three detection modes work end-to-end
- [ ] Timer starts with 0 delay in auto-start mode (no countdown)
- [ ] Undo button appears and restores timer state within 2s
- [ ] Camera stops when navigating away from brewing page
- [ ] Settings persist to IndexedDB and survive app reload
- [ ] `pnpm build` succeeds with no TypeScript errors
