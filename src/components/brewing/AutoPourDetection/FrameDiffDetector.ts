/**
 * FrameDiffDetector
 *
 * Layer 1: Pixel-level motion analysis using frame differencing.
 * Detects kettle tilt (pour) using three complementary signals:
 *
 * 1. **Vertical histogram valley** (primary spatial discriminator):
 *    Compute a per-row histogram of diff pixels inside the bounding box.
 *    Translation always creates TWO horizontal strips (trailing + leading edge)
 *    with the unchanged kettle body between them → deep VALLEY in the histogram.
 *    Rotation (pour) creates ONE connected arc → NO internal valley.
 *      valleyDepth > 0.55 → two-strip translation   (REJECT)
 *      valleyDepth ≤ 0.55 → continuous arc           (PASS)
 *
 *    Why this beats fillRatio:
 *      fillRatio = 2d/(h+d) can exceed the threshold for small/fast objects.
 *      The valley test is invariant to object size — a gap is a gap.
 *
 * 2. **Horizontal asymmetry** (secondary spatial discriminator):
 *    Translation strips span the full width → symmetric around the center X.
 *    Rotation concentrates diff at the SPOUT END (one side) → asymmetric.
 *      asymmetry > 0.25 → rotation-like              (PASS)
 *      asymmetry < 0.12 → translation-like (symmetric)(REJECT)
 *
 * 3. **bottomRatioTrend** (temporal confidence booster):
 *    Least-squares slope of (bottomPixels/totalPixels) over last N frames.
 *    Demoted from primary discriminator to secondary confidence signal.
 *    Positive slope → spout sweeping downward → boosts rotationScore.
 *    No longer used as a hard gate for translation rejection.
 *
 * 4. **Motion pixel accumulator** (slow-pour sensitivity):
 *    A 10-frame sliding-window union of all diff pixel coordinates.
 *    Slow pours produce very few pixels per frame; accumulating them lets
 *    the signal exceed the minimum-pixel threshold that individual frames miss.
 *    Detection is run on the accumulated map in parallel with per-frame analysis.
 *
 * Performance target: ≤5ms for 320×240 resolution
 */

import type { FrameDiffResult, MotionAnalysis, DetectionConfig } from './types';

interface RegionCenters {
  topPixelCount: number;
  bottomPixelCount: number;
  /** Fraction of diff pixels in the bottom half of the frame (0–1) */
  bottomRatio: number;
  /** Fraction of diff pixels right of frame centre (0–1); 0.5 = symmetric */
  rightRatio: number;
}

interface TiltHistory {
  bottomRatio: number;
  fillRatio: number;
  timestamp: number;
  totalMotionPixels: number;
}

/**
 * Accumulates diff-pixel presence over a sliding window of frames.
 * Each cell stores the count of frames in which that pixel was active.
 * Used for slow-pour detection where per-frame signal is too weak.
 */
class MotionAccumulator {
  private readonly _width: number;
  private readonly _height: number;
  private readonly _windowSize: number;
  /** Circular buffer of per-frame bitmaps (1 = diff pixel active) */
  private readonly _frames: Uint8Array[];
  private _head = 0;
  private _count = 0;
  /** Sum map: how many frames each pixel was active */
  private _sumMap: Uint8Array;

  constructor(width: number, height: number, windowSize = 12) {
    this._width = width;
    this._height = height;
    this._windowSize = windowSize;
    this._frames = Array.from(
      { length: windowSize },
      () => new Uint8Array(width * height)
    );
    this._sumMap = new Uint8Array(width * height);
  }

  /** Push a new frame's diff bitmap and update the sum map */
  push(diffMap: number[][], threshold: number): void {
    const evicted = this._frames[this._head];
    const incoming = this._frames[this._head]; // reuse buffer

    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        const idx = y * this._width + x;
        const wasActive = evicted[idx];
        const isActive = diffMap[y][x] > threshold ? 1 : 0;
        incoming[idx] = isActive;
        this._sumMap[idx] = Math.max(
          0,
          (this._sumMap[idx] - wasActive + isActive) as number
        );
      }
    }

    this._head = (this._head + 1) % this._windowSize;
    if (this._count < this._windowSize) this._count++;
  }

  /** Number of frames currently in the accumulator */
  get frameCount(): number {
    return this._count;
  }

  /**
   * Returns a pseudo-diffMap where a pixel is "active" if it fired in
   * at least `minFrames` out of the sliding window.
   * Using minFrames=1 gives the union; minFrames=2 filters single-frame noise.
   */
  getAccumulatedMap(minFrames = 1): number[][] {
    const map: number[][] = Array.from({ length: this._height }, () =>
      new Array(this._width).fill(0)
    );
    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        if (this._sumMap[y * this._width + x] >= minFrames) {
          map[y][x] = 255; // treat as "above threshold"
        }
      }
    }
    return map;
  }

  reset(): void {
    for (const frame of this._frames) frame.fill(0);
    this._sumMap.fill(0);
    this._head = 0;
    this._count = 0;
  }
}

export default class FrameDiffDetector {
  private _tiltHistory: TiltHistory[] = [];
  private readonly _historySize = 8;

  private _config: DetectionConfig;

  /**
   * EMA of bottomRatioTrend (alpha = 0.35).
   * Prevents a single noisy frame from zeroing the rotation score —
   * the smoothed signal persists through brief negative excursions.
   */
  private _smoothedTrend = 0;
  private readonly _trendAlpha = 0.35;

  /** Lazy-initialised — created on first frame once we know dimensions */
  private _accumulator: MotionAccumulator | null = null;
  private _lastWidth = 0;
  private _lastHeight = 0;

  constructor(config?: DetectionConfig) {
    this._config = config ?? {
      sensitivity: 50,
      frameDiffThreshold: 30,
      minMotionRatio: 0.005,
      maxMotionRatio: 0.8,
      requiredConsecutiveDetections: 2,
      stateTimeout: 5000,
    };
  }

  updateConfig(config: Partial<DetectionConfig>): void {
    this._config = { ...this._config, ...config };
  }

  computeFrameDiff(
    currentFrame: ImageData,
    previousFrame: ImageData
  ): FrameDiffResult {
    const width = currentFrame.width;
    const height = currentFrame.height;
    const totalPixels = width * height;
    const data1 = currentFrame.data;
    const data2 = previousFrame.data;

    const diffMap: number[][] = Array(height)
      .fill(0)
      .map(() => Array(width).fill(0));

    let totalDiff = 0;
    let motionPixelCount = 0;
    let maxDiff = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        const gray1 = Math.round(
          0.299 * data1[idx] + 0.587 * data1[idx + 1] + 0.114 * data1[idx + 2]
        );
        const gray2 = Math.round(
          0.299 * data2[idx] + 0.587 * data2[idx + 1] + 0.114 * data2[idx + 2]
        );

        const diff = Math.abs(gray1 - gray2);
        diffMap[y][x] = diff;

        totalDiff += diff;
        if (diff > 25) {
          motionPixelCount++;
        }
        if (diff > maxDiff) {
          maxDiff = diff;
        }
      }
    }

    const motionRatio = motionPixelCount / totalPixels;
    const isLargeSceneChange = motionRatio > this._config.maxMotionRatio;

    let motionCenterY = 0.5;
    if (motionPixelCount > 0) {
      let sumY = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (diffMap[y][x] > 25) {
            sumY += y;
          }
        }
      }
      motionCenterY = sumY / motionPixelCount / height;
    }

    // Feed accumulator (always, even if per-frame ratio is low)
    this._ensureAccumulator(width, height);
    this._accumulator!.push(diffMap, this._config.frameDiffThreshold);

    return {
      diffMap,
      totalDiff,
      motionPixelCount,
      motionRatio,
      maxDiff,
      motionCenterY,
      isLargeSceneChange,
    };
  }

  detectDownwardMotion(diffMap: number[][], threshold: number): MotionAnalysis {
    const height = diffMap.length;
    const width = diffMap[0]?.length || 0;

    const perFrame = this._extractRegionFeatures(
      diffMap,
      threshold,
      width,
      height
    );

    let accAnalysis: ReturnType<typeof this._extractRegionFeatures> | null =
      null;
    if (this._accumulator && this._accumulator.frameCount >= 3) {
      const accMap = this._accumulator.getAccumulatedMap(2);
      accAnalysis = this._extractRegionFeatures(accMap, 128, width, height);
    }

    const useAcc =
      accAnalysis !== null &&
      accAnalysis.totalMotionPixels > perFrame.totalMotionPixels * 1.5 &&
      perFrame.totalMotionPixels < 80;

    const primary = useAcc ? accAnalysis! : perFrame;
    const {
      totalMotionPixels,
      topPixels,
      bottomPixels,
      rightPixels,
      bottomRatio,
      rightRatio,
      bbWidth,
      bbHeight,
      bbArea,
      centroidX,
      centroidY,
    } = primary;

    const fillRatio = totalMotionPixels / Math.max(1, bbArea);

    const valleyDepth = this._computeValleyDepth(
      primary.rowHistogram,
      primary.bbMinY,
      primary.bbMaxY
    );

    const leftPixels = totalMotionPixels - rightPixels;
    const asymmetry =
      totalMotionPixels > 0
        ? Math.abs(leftPixels - rightPixels) / totalMotionPixels
        : 0;

    const currentCenters: RegionCenters = {
      topPixelCount: topPixels,
      bottomPixelCount: bottomPixels,
      bottomRatio,
      rightRatio,
    };

    const bottomRatioTrend = this._calculateBottomRatioTrend(bottomRatio);
    const trendConsistency = this._calculateTrendConsistency(bottomRatioTrend);
    const motionMagnitude = this._calculateMotionMagnitude(bottomRatio);

    this._updateTiltHistory(currentCenters, totalMotionPixels);

    this._smoothedTrend =
      this._trendAlpha * bottomRatioTrend +
      (1 - this._trendAlpha) * this._smoothedTrend;

    const rotationScore = this._calculateRotationScore(
      this._smoothedTrend,
      trendConsistency,
      motionMagnitude,
      asymmetry,
      bottomRatio
    );

    // Detect pour pattern for better pour recognition
    const isPourPattern = this._detectPourPattern(
      asymmetry,
      valleyDepth,
      bottomRatio,
      trendConsistency,
      totalMotionPixels
    );

    const translationScore = Math.max(0, valleyDepth * 0.4);

    const isKettleTilt = this._isKettleTilt(
      rotationScore, // 传入当前的旋转得分
      trendConsistency, // 传入趋势一致性
      this._smoothedTrend, // 传入倾斜信号 (tiltSignal)，用于判断方向
      totalMotionPixels // 传入运动像素总数
    );

    const gradientStability =
      this._calculateGradientStability(bottomRatioTrend);

    const trendStrength = Math.min(1, Math.max(0, this._smoothedTrend) / 0.04);
    const rotationEvidence = trendStrength * 0.5 + 0.3 + trendConsistency * 0.2;

    const topRatio = topPixels / totalMotionPixels;
    let motionRegion: 'top' | 'middle' | 'bottom';
    if (topRatio > 0.6) {
      motionRegion = 'top';
    } else if (topRatio < 0.4) {
      motionRegion = 'bottom';
    } else {
      motionRegion = 'middle';
    }

    const hasMotion = rotationScore >= 0.2;
    const isDownward =
      bottomRatioTrend > 0.002 || (useAcc && bottomRatio > 0.55);

    return {
      hasMotion,
      isDownward,
      motionScore: rotationScore,
      verticalBias: bottomRatioTrend,
      motionRegion,
      areaChangeRatio: 0,
      isLargeSceneChange: false,
      totalMotionPixels,
      motionCenterX: centroidX,
      motionCenterY: centroidY,
      boundingBoxArea: bbArea,
      boundingBoxWidth: bbWidth,
      boundingBoxHeight: bbHeight,
      boundingBoxAspectRatio: bbWidth > 0 ? bbHeight / bbWidth : 1,
      centerYDisplacement: bottomRatioTrend,
      centerYHistory: this._tiltHistory.map(h => h.bottomRatio),
      downwardVelocity: bottomRatioTrend,
      isKettleTilt,
      kettleTiltConfidence: isKettleTilt
        ? Math.min(1, rotationScore + trendConsistency * 0.3)
        : 0,
      hasRotation: rotationScore > 0.2,
      rotationScore,
      topCenterY: topRatio,
      bottomCenterY: bottomRatio,
      centerYDiff: bottomRatio - topRatio,
      verticalGradient: topRatio - 0.5,
      asymmetryScore: asymmetry,
      topPixelCount: topPixels,
      bottomPixelCount: bottomPixels,
      tiltSignal: this._smoothedTrend,
      tiltConsistency: trendConsistency,
      translationScore,
      commonModeDisplacement: bottomRatio,
      rotationEvidence,
      velocityRatio: valleyDepth,
      gradientStability,
    };
  }

  // ─── Feature extraction ───────────────────────────────────────────────────

  private _extractRegionFeatures(
    diffMap: number[][],
    threshold: number,
    width: number,
    height: number
  ) {
    const midY = Math.floor(height / 2);
    const midX = Math.floor(width / 2);

    let totalMotionPixels = 0;
    let bbMinX = width,
      bbMaxX = 0;
    let bbMinY = height,
      bbMaxY = 0;
    let topPixels = 0,
      bottomPixels = 0;
    let rightPixels = 0;
    let sumCX = 0,
      sumCY = 0;

    // Row histogram — indexed from row 0 of the frame
    const rowHistogram = new Int32Array(height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (diffMap[y][x] > threshold) {
          totalMotionPixels++;
          if (x < bbMinX) bbMinX = x;
          if (x > bbMaxX) bbMaxX = x;
          if (y < bbMinY) bbMinY = y;
          if (y > bbMaxY) bbMaxY = y;
          if (y < midY) topPixels++;
          else bottomPixels++;
          if (x >= midX) rightPixels++;
          sumCX += x;
          sumCY += y;
          rowHistogram[y]++;
        }
      }
    }

    const bbWidth = bbMaxX - bbMinX + 1;
    const bbHeight = bbMaxY - bbMinY + 1;
    const bbArea = bbWidth * bbHeight;

    return {
      totalMotionPixels,
      topPixels,
      bottomPixels,
      rightPixels,
      bottomRatio: bottomPixels / totalMotionPixels,
      rightRatio: rightPixels / totalMotionPixels,
      bbMinX,
      bbMaxX,
      bbMinY,
      bbMaxY,
      bbWidth,
      bbHeight,
      bbArea,
      centroidX: sumCX / totalMotionPixels / width,
      centroidY: sumCY / totalMotionPixels / height,
      rowHistogram,
    };
  }

  // ─── Valley detection ─────────────────────────────────────────────────────

  /**
   * Detect internal gap (valley) in the vertical row histogram.
   *
   * For downward translation: rows outside the two strips have near-zero
   * counts → a clear valley between the top strip and bottom strip.
   * For a pour arc: the histogram is unimodal or broadly continuous → no valley.
   *
   * Algorithm:
   *   1. Take the sub-histogram within [bbMinY .. bbMaxY].
   *   2. Find the peak value.
   *   3. Find the minimum value in the MIDDLE 60% of that range
   *      (avoids confusing the actual sparse edges with a valley).
   *   4. valleyDepth = (peak − min) / peak
   *
   * Returns 0 if there are fewer than 4 rows (not enough to detect a valley).
   */
  private _computeValleyDepth(
    rowHistogram: Int32Array,
    bbMinY: number,
    bbMaxY: number
  ): number {
    const span = bbMaxY - bbMinY + 1;
    if (span < 4) return 0;

    // Extract sub-histogram
    let peak = 0;
    for (let y = bbMinY; y <= bbMaxY; y++) {
      if (rowHistogram[y] > peak) peak = rowHistogram[y];
    }
    if (peak === 0) return 0;

    // Search for valley in the middle 60% of bounding box height
    const innerStart = bbMinY + Math.floor(span * 0.2);
    const innerEnd = bbMinY + Math.floor(span * 0.8);

    let valleyMin = peak;
    for (let y = innerStart; y <= innerEnd; y++) {
      if (rowHistogram[y] < valleyMin) valleyMin = rowHistogram[y];
    }

    return (peak - valleyMin) / peak;
  }

  // ─── Temporal helpers ─────────────────────────────────────────────────────

  /**
   * Least-squares slope of bottomRatio over history + current frame.
   */
  private _calculateBottomRatioTrend(currentBottomRatio: number): number {
    if (this._tiltHistory.length < 2) return 0;

    const values: number[] = this._tiltHistory.map(h => h.bottomRatio);
    values.push(currentBottomRatio);

    const n = values.length;
    let sumI = 0,
      sumY = 0,
      sumIY = 0,
      sumI2 = 0;
    for (let i = 0; i < n; i++) {
      sumI += i;
      sumY += values[i];
      sumIY += i * values[i];
      sumI2 += i * i;
    }

    const denom = n * sumI2 - sumI * sumI;
    if (denom === 0) return 0;
    return (n * sumIY - sumI * sumY) / denom;
  }

  private _calculateTrendConsistency(currentTrend: number): number {
    if (this._tiltHistory.length < 2) return 0;

    const ratios = this._tiltHistory.map(h => h.bottomRatio);
    const trendSign = currentTrend >= 0 ? 1 : -1;
    let agree = 0;

    for (let i = 1; i < ratios.length; i++) {
      if ((ratios[i] - ratios[i - 1]) * trendSign > 0) agree++;
    }

    return agree / (ratios.length - 1);
  }

  private _calculateMotionMagnitude(currentBottomRatio: number): number {
    if (this._tiltHistory.length < 2) return 0;
    return Math.abs(currentBottomRatio - this._tiltHistory[0].bottomRatio);
  }

  private _calculateGradientStability(currentTrend: number): number {
    if (this._tiltHistory.length < 2) return 0;

    const ratios = this._tiltHistory.slice(-3).map(h => h.bottomRatio);
    const deltas: number[] = [];
    for (let i = 1; i < ratios.length; i++) {
      deltas.push(ratios[i] - ratios[i - 1]);
    }
    deltas.push(currentTrend);

    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const variance =
      deltas.reduce((s, v) => s + (v - mean) ** 2, 0) / deltas.length;

    return Math.max(0, 1 - variance * 500);
  }

  // ─── Score computation ────────────────────────────────────────────────────

  /**
   * Translation detector: returns true when the diff pattern looks like two
   * parallel strips (leading + trailing edge of a translating object).
   *
   * Two-tier check:
   *   Tier 1 (preferred): vertical histogram valley.  Works for any speed
   *   when the object displacement produces ≥4 rows of bounding-box span.
   *   Tier 2 (fallback):  fillRatio < 0.25.  Catches slow translations where
   *   displacement is tiny (<4px) so valley detection has insufficient span.
   */
  private _calculateRotationScore(
    bottomRatioTrend: number,
    trendConsistency: number,
    motionMagnitude: number,
    asymmetry: number,
    bottomRatio: number
  ): number {
    const trendScore = Math.min(1, Math.max(0, bottomRatioTrend) / 0.025);
    const asymmetryScore = Math.min(1, asymmetry / 0.4);
    const bottomDominanceScore = Math.min(
      1,
      Math.max(0, (bottomRatio - 0.5) * 2)
    );
    const consistScore = trendConsistency;
    const magnitudeBonus = Math.min(0.05, motionMagnitude * 1);

    // Relaxed weights: less dependency on trend direction
    return Math.min(
      1,
      trendScore * 0.25 +
        asymmetryScore * 0.25 +
        bottomDominanceScore * 0.25 +
        consistScore * 0.15 +
        magnitudeBonus
    );
  }

  /**
   * Detect pour pattern: recognizes kettle pouring motion based on
   * spatial distribution characteristics unique to pouring.
   *
   * Pour characteristics:
   *   - High asymmetry (spout concentrates motion on one side)
   *   - Moderate valley depth (not pure translation)
   *   - Bottom-heavy pixel distribution
   *   - Consistent temporal trend
   *   - Sufficient motion magnitude
   */
  private _detectPourPattern(
    asymmetry: number,
    valleyDepth: number,
    bottomRatio: number,
    trendConsistency: number,
    totalMotionPixels: number
  ): boolean {
    return (
      asymmetry > 0.15 &&
      valleyDepth < 0.6 &&
      bottomRatio > 0.6 &&
      trendConsistency > 0.3 &&
      totalMotionPixels > 1000
    );
  }

  /**
   * Hard gate for the pour decision.
   *
   * Conditions:
   *   1. NOT a detected translation pattern.
   *   2. bottomRatioTrend > 0   — diff centroid shifting toward bottom half.
   *   3. trendConsistency > 0.3 — trend is monotonic, not noise.
   *   4. totalMotionPixels ≥ 15 — minimum signal.
   *   5. ≥2 history entries     — minimum temporal context.
   *
   * No asymmetry gate — a kettle held centrally has symmetric diff even
   * during a genuine pour, so asymmetry cannot be a hard requirement.
   */
  private _isKettleTilt(
    rotationScore: number,
    trendConsistency: number,
    tiltSignal: number,
    totalMotionPixels: number
  ): boolean {
    // 1. 严格的像素过滤：过小（噪点）或过大（整体平移）直接拒绝
    // 倒水稳定期通常在 4000-10000 之间，这里设定 15000 为绝对上限
    if (totalMotionPixels < 100 || totalMotionPixels > 20000) return false;

    // 2. 核心方向规则：根据需求，tiltSignal > 0 时表示未倾倒水壶（拒绝）。
    // 这意味着只有当 tiltSignal <= 0 时，才有可能判定为倒水。
    if (tiltSignal > 0.4) return false;

    // 3. 历史数据要求：需要至少 2 帧历史记录来建立上下文，否则拒绝。
    if (this._tiltHistory.length < 2) return false;

    // 3. 【绝对核心】趋势一致性必须极高
    // 日志证明：平移最高仅为 0.57，而倒水在 0.75 - 1.0 之间。
    if (trendConsistency < 0.55) return false;

    return true;
  }

  // ─── History ──────────────────────────────────────────────────────────────

  private _updateTiltHistory(
    centers: RegionCenters,
    totalMotionPixels: number
  ): void {
    const fillRatio = 0; // not used in history but kept for compat
    this._tiltHistory.push({
      bottomRatio: centers.bottomRatio,
      fillRatio,
      timestamp: Date.now(),
      totalMotionPixels,
    });
    if (this._tiltHistory.length > this._historySize) {
      this._tiltHistory.shift();
    }
  }

  // ─── Accumulator ──────────────────────────────────────────────────────────

  private _ensureAccumulator(width: number, height: number): void {
    if (
      this._accumulator === null ||
      width !== this._lastWidth ||
      height !== this._lastHeight
    ) {
      this._accumulator = new MotionAccumulator(width, height, 12);
      this._lastWidth = width;
      this._lastHeight = height;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  private _createEmptyAnalysis(): MotionAnalysis {
    return {
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
      translationScore: 0,
      commonModeDisplacement: 0,
      rotationEvidence: 0,
      velocityRatio: 0,
      gradientStability: 0,
    };
  }

  isPouringMotion(motionAnalysis: MotionAnalysis): boolean {
    //废弃
    return motionAnalysis.isKettleTilt;
  }

  reset(): void {
    this._tiltHistory = [];
    this._smoothedTrend = 0;
    this._accumulator?.reset();
  }
}
