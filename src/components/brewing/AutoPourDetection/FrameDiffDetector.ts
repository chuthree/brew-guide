/**
 * FrameDiffDetector
 *
 * Layer 1: Pixel-level motion analysis using frame differencing.
 * Detects kettle tilt motion using TEMPORAL motion difference between top and bottom.
 *
 * Core insight: Rotation causes differential motion
 * - Top (spout) moves DOWN faster than bottom (handle) during tilt
 * - Translation moves both equally
 * - tiltSignal = topDeltaY - bottomDeltaY captures this differential motion
 *
 * Performance target: ≤5ms for 320×240 resolution
 */

import type { FrameDiffResult, MotionAnalysis } from './types';

interface RegionCenters {
  topCenterY: number;
  bottomCenterY: number;
  topPixelCount: number;
  bottomPixelCount: number;
}

interface TiltHistory {
  topCenterY: number;
  bottomCenterY: number;
  tiltSignal: number;
  timestamp: number;
}

export default class FrameDiffDetector {
  private _previousROI: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;

  // History buffer for temporal motion analysis
  private _tiltHistory: TiltHistory[] = [];
  private readonly _historySize = 5;

  /**
   * Compute frame difference between current and previous frame
   */
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
    const isLargeSceneChange = motionRatio > 0.8;

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

  /**
   * Detect kettle tilt motion using TEMPORAL motion difference
   *
   * KEY INSIGHT: Rotation produces differential motion
   * - Tilt: top moves down MORE than bottom (topDeltaY > bottomDeltaY)
   * - Translation: both move equally (topDeltaY ≈ bottomDeltaY)
   * - tiltSignal = topDeltaY - bottomDeltaY captures this
   */
  detectDownwardMotion(diffMap: number[][], threshold: number): MotionAnalysis {
    const height = diffMap.length;
    const width = diffMap[0]?.length || 0;
    const midY = Math.floor(height / 2);

    // First pass: find bounding box of all motion
    let totalMotionPixels = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (diffMap[y][x] > threshold) {
          totalMotionPixels++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (totalMotionPixels === 0) {
      return this._createEmptyAnalysis();
    }

    // Calculate dynamic regions based on bounding box
    const motionHeight = maxY - minY;
    const topRegionEnd = minY + motionHeight * 0.3;
    const bottomRegionStart = minY + motionHeight * 0.7;

    // Second pass: analyze motion in dynamic top and bottom regions
    let topPixels = 0;
    let bottomPixels = 0;
    let topSumY = 0;
    let bottomSumY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (diffMap[y][x] > threshold) {
          if (y < topRegionEnd) {
            topPixels++;
            topSumY += y;
          } else if (y >= bottomRegionStart) {
            bottomPixels++;
            bottomSumY += y;
          }
        }
      }
    }

    // Calculate current frame's region centers
    const currentCenters: RegionCenters = {
      topCenterY: topPixels > 0 ? topSumY / topPixels / height : 0.25,
      bottomCenterY:
        bottomPixels > 0 ? bottomSumY / bottomPixels / height : 0.75,
      topPixelCount: topPixels,
      bottomPixelCount: bottomPixels,
    };

    // Calculate temporal tilt signal
    const tiltSignal = this._calculateTemporalTiltSignal(currentCenters);

    // Calculate tilt consistency across recent frames
    const tiltConsistency = this._calculateTiltConsistency();

    // Calculate motion magnitude for minimum motion threshold
    const motionMagnitude = this._calculateMotionMagnitude();

    // Calculate bounding box
    const boundingBoxWidth = maxX - minX;
    const boundingBoxHeight = maxY - minY;
    const boundingBoxArea = boundingBoxWidth * boundingBoxHeight;

    // Determine motion region
    const topRatio = topPixels / (totalMotionPixels || 1);
    let motionRegion: 'top' | 'middle' | 'bottom';
    if (topRatio > 0.6) {
      motionRegion = 'top';
    } else if (topRatio < 0.4) {
      motionRegion = 'bottom';
    } else {
      motionRegion = 'middle';
    }

    // Update history
    this._updateTiltHistory(currentCenters, tiltSignal);

    // Calculate rotation score based on tilt signal and consistency
    const rotationScore = this._calculateRotationScore(
      tiltSignal,
      tiltConsistency,
      motionMagnitude
    );

    // Determine if this is a kettle tilt
    const isKettleTilt = this._isKettleTilt(
      tiltSignal,
      tiltConsistency,
      rotationScore,
      motionMagnitude
    );

    const hasMotion = rotationScore >= 0.3;
    const isDownward = tiltSignal > 0.02;

    return {
      hasMotion,
      isDownward,
      motionScore: rotationScore,
      verticalBias: tiltSignal,
      motionRegion,
      areaChangeRatio: 0,
      isLargeSceneChange: false,
      totalMotionPixels,
      motionCenterX: 0.5,
      motionCenterY:
        (currentCenters.topCenterY + currentCenters.bottomCenterY) / 2,
      boundingBoxArea,
      boundingBoxWidth,
      boundingBoxHeight,
      boundingBoxAspectRatio:
        boundingBoxWidth > 0 ? boundingBoxHeight / boundingBoxWidth : 1,
      centerYDisplacement: tiltSignal,
      centerYHistory: this._tiltHistory.map(h => h.topCenterY),
      downwardVelocity: tiltSignal,
      isKettleTilt,
      kettleTiltConfidence: isKettleTilt ? tiltConsistency : 0,
      hasRotation: rotationScore > 0.2,
      rotationScore,
      topCenterY: currentCenters.topCenterY,
      bottomCenterY: currentCenters.bottomCenterY,
      centerYDiff: currentCenters.bottomCenterY - currentCenters.topCenterY,
      verticalGradient: topRatio - 0.5,
      asymmetryScore: 0,
      topPixelCount: topPixels,
      bottomPixelCount: bottomPixels,
      tiltSignal,
      tiltConsistency,
    };
  }

  /**
   * Calculate temporal tilt signal
   * tiltSignal = topDeltaY - bottomDeltaY
   *
   * Rotation: top moves down MORE than bottom → positive tiltSignal
   * Translation: both move equally → tiltSignal ≈ 0
   */
  private _calculateTemporalTiltSignal(currentCenters: RegionCenters): number {
    if (this._tiltHistory.length === 0) {
      return 0;
    }

    const prev = this._tiltHistory[this._tiltHistory.length - 1];

    // Calculate motion deltas
    const topDeltaY = currentCenters.topCenterY - prev.topCenterY;
    const bottomDeltaY = currentCenters.bottomCenterY - prev.bottomCenterY;

    // Tilt signal: difference between top and bottom motion
    // Positive = top moving down more than bottom (tilting)
    const tiltSignal = topDeltaY - bottomDeltaY;

    return tiltSignal;
  }

  /**
   * Calculate tilt consistency across recent frames
   * Measures how consistently the tilt signal has the same sign
   */
  private _calculateTiltConsistency(): number {
    if (this._tiltHistory.length < 2) {
      return 0;
    }

    const recentSignals = this._tiltHistory.slice(-3).map(h => h.tiltSignal);

    // Count positive and negative signals
    const positiveCount = recentSignals.filter(s => s > 0).length;
    const negativeCount = recentSignals.filter(s => s < 0).length;

    // Consistency = max(positive, negative) / total
    const maxCount = Math.max(positiveCount, negativeCount);
    return maxCount / recentSignals.length;
  }

  /**
   * Calculate motion magnitude for minimum threshold
   */
  private _calculateMotionMagnitude(): number {
    if (this._tiltHistory.length < 2) {
      return 0;
    }

    const prev = this._tiltHistory[this._tiltHistory.length - 1];
    const curr = this._tiltHistory[this._tiltHistory.length - 1];

    // Total motion = |topDelta| + |bottomDelta|
    // Use last two frames to estimate
    if (this._tiltHistory.length >= 2) {
      const lastIdx = this._tiltHistory.length - 1;
      const prevIdx = this._tiltHistory.length - 2;

      const topDelta = Math.abs(
        this._tiltHistory[lastIdx].topCenterY -
          this._tiltHistory[prevIdx].topCenterY
      );
      const bottomDelta = Math.abs(
        this._tiltHistory[lastIdx].bottomCenterY -
          this._tiltHistory[prevIdx].bottomCenterY
      );

      return topDelta + bottomDelta;
    }

    return 0;
  }

  /**
   * Update tilt history buffer
   */
  private _updateTiltHistory(centers: RegionCenters, tiltSignal: number): void {
    this._tiltHistory.push({
      topCenterY: centers.topCenterY,
      bottomCenterY: centers.bottomCenterY,
      tiltSignal,
      timestamp: Date.now(),
    });

    if (this._tiltHistory.length > this._historySize) {
      this._tiltHistory.shift();
    }
  }

  /**
   * Calculate rotation score based on tilt signal and consistency
   */
  private _calculateRotationScore(
    tiltSignal: number,
    tiltConsistency: number,
    motionMagnitude: number
  ): number {
    // Minimum motion threshold
    if (motionMagnitude < 0.005) {
      return 0;
    }

    // Factor 1: Tilt signal strength (most important)
    // Scale: typical tilt produces 0.01-0.05 signal
    const signalScore = Math.min(1, Math.abs(tiltSignal) / 0.03);

    // Factor 2: Consistency bonus
    // Requires consistent signal across frames
    const consistencyBonus = tiltConsistency * 0.3;

    // Factor 3: Sufficient motion magnitude
    // Ensures we're not detecting noise
    const magnitudeScore = Math.min(1, motionMagnitude / 0.02);

    // Combined score
    const score = signalScore * 0.6 + consistencyBonus + magnitudeScore * 0.1;

    // Only positive tilt signals count (downward tilt)
    return tiltSignal > 0 ? Math.min(1, score) : 0;
  }

  /**
   * Determine if current motion matches kettle tilt characteristics
   */
  private _isKettleTilt(
    tiltSignal: number,
    tiltConsistency: number,
    rotationScore: number,
    motionMagnitude: number
  ): boolean {
    // Must have positive tilt signal (top moving down more)
    if (tiltSignal <= 0.025) {
      return false;
    }

    // Must have sufficient consistency
    if (tiltConsistency < 0.6) {
      return false;
    }

    // Must have good rotation score
    if (rotationScore < 0.6) {
      return false;
    }

    // Must have sufficient motion
    if (motionMagnitude < 0.02) {
      return false;
    }

    return true;
  }

  /**
   * Create empty analysis when no motion detected
   */
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
    };
  }

  /**
   * Check if motion matches pouring characteristics
   */
  isPouringMotion(motionAnalysis: MotionAnalysis): boolean {
    // Primary: Kettle tilt with high confidence
    const isKettleTilt =
      motionAnalysis.isKettleTilt && motionAnalysis.kettleTiltConfidence >= 0.3;

    // Secondary: Strong tilt signal with consistency
    const hasStrongTilt =
      motionAnalysis.tiltSignal > 0.04 &&
      motionAnalysis.tiltConsistency >= 0.7 &&
      motionAnalysis.motionScore >= 0.6;

    return isKettleTilt || hasStrongTilt;
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this._previousROI = null;
    this._tiltHistory = [];
  }
}
