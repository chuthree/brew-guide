'use client';

import React from 'react';
import type {
  MotionAnalysis,
  StateMachineDebugInfo,
  StateMachineState,
} from '../types';

interface DebugOverlayProps {
  state: StateMachineState;
  consecutiveCount: number;
  motionScore: number;
  processingTimeMs: number;
  motionAnalysis: MotionAnalysis | null;
  stateMachineDebug?: StateMachineDebugInfo | null;
  visible: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export default function DebugOverlay({
  state,
  consecutiveCount,
  processingTimeMs,
  motionAnalysis,
  stateMachineDebug,
  visible,
  position = 'top-right',
}: DebugOverlayProps) {
  if (!visible) {
    return null;
  }

  const positionClasses = {
    'top-left': 'left-2 top-2',
    'top-right': 'right-2 top-2',
    'bottom-left': 'left-2 bottom-2',
    'bottom-right': 'right-2 bottom-2',
  };

  const formatNumber = (num: number, decimals = 2) =>
    Number.isFinite(num) ? num.toFixed(decimals) : '0';

  const formatInt = (num: number) =>
    Number.isFinite(num) ? Math.round(num).toString() : '0';

  return (
    <div
      className={`absolute ${positionClasses[position]} z-50 w-[150px] overflow-hidden rounded bg-black/70 p-2 font-mono text-[10px] leading-tight text-white backdrop-blur-sm`}
    >
      <div className="mb-1 border-b border-white/20 pb-1 font-semibold text-green-400">
        运动检测调试
      </div>

      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span className="text-neutral-400">状态:</span>
          <span className={state === 'triggered' ? 'text-green-400' : ''}>
            {state}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-400">连续:</span>
          <span>{consecutiveCount}</span>
        </div>

        {/* <div className="flex justify-between">
          <span className="text-neutral-400">处理:</span>
          <span>{formatNumber(processingTimeMs, 1)}ms</span>
        </div> */}

        {motionAnalysis && (
          <>
            <div className="my-1 border-t border-white/10" />

            {/* <div className="flex justify-between">
              <span className="text-neutral-400">运动像素:</span>
              <span>{formatInt(motionAnalysis.totalMotionPixels)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">中心X:</span>
              <span>{formatNumber(motionAnalysis.motionCenterX)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">中心Y:</span>
              <span>{formatNumber(motionAnalysis.motionCenterY)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">边界框:</span>
              <span>{formatInt(motionAnalysis.boundingBoxArea)}px²</span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">宽高比:</span>
              <span>
                {formatNumber(motionAnalysis.boundingBoxAspectRatio, 2)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">Y位移:</span>
              <span
                className={
                  motionAnalysis.centerYDisplacement > 0
                    ? 'text-yellow-400'
                    : ''
                }
              >
                {formatNumber(motionAnalysis.centerYDisplacement, 3)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">垂直偏移:</span>
              <span
                className={
                  motionAnalysis.verticalBias > 0 ? 'text-yellow-400' : ''
                }
              >
                {formatNumber(motionAnalysis.verticalBias, 2)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">Y速度:</span>
              <span
                className={
                  motionAnalysis.downwardVelocity > 0 ? 'text-green-400' : ''
                }
              >
                {formatNumber(motionAnalysis.downwardVelocity, 4)}
              </span>
            </div> */}

            <div className="flex justify-between">
              <span className="text-neutral-400">区域:</span>
              <span className="capitalize">{motionAnalysis.motionRegion}</span>
            </div>

            <div className="my-1 border-t border-white/10" />

            <div className="flex justify-between">
              <span className="text-neutral-400">水壶倾斜:</span>
              <span
                className={
                  motionAnalysis.isKettleTilt ? 'font-bold text-green-400' : ''
                }
              >
                {motionAnalysis.isKettleTilt ? '是' : '否'}
              </span>
            </div>

            {/* <div className="flex justify-between">
              <span className="text-neutral-400">倾斜置信:</span>
              <span
                className={
                  motionAnalysis.kettleTiltConfidence > 0.5
                    ? 'text-green-400'
                    : ''
                }
              >
                {formatNumber(motionAnalysis.kettleTiltConfidence, 2)}
              </span>
            </div> */}

            <div className="flex justify-between">
              <span className="text-neutral-400">运动得分:</span>
              <span
                className={
                  motionAnalysis.motionScore > 0.5 ? 'text-green-400' : ''
                }
              >
                {formatNumber(motionAnalysis.motionScore, 2)}
              </span>
            </div>

            <div className="my-1 border-t border-white/10" />
            <div className="text-center text-[9px] text-cyan-400">旋转检测</div>

            <div className="flex justify-between">
              <span className="text-neutral-400">旋转:</span>
              <span
                className={
                  motionAnalysis.hasRotation ? 'font-bold text-cyan-400' : ''
                }
              >
                {motionAnalysis.hasRotation ? '是' : '否'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">旋转得分:</span>
              <span
                className={
                  motionAnalysis.rotationScore > 0.3 ? 'text-cyan-400' : ''
                }
              >
                {formatNumber(motionAnalysis.rotationScore, 2)}
              </span>
            </div>

            {/* <div className="flex justify-between">
              <span className="text-neutral-400">上中心Y:</span>
              <span>{formatNumber(motionAnalysis.topCenterY, 3)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">下中心Y:</span>
              <span>{formatNumber(motionAnalysis.bottomCenterY, 3)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">Y差值:</span>
              <span
                className={
                  motionAnalysis.centerYDiff > 0.1 ? 'text-cyan-400' : ''
                }
              >
                {formatNumber(motionAnalysis.centerYDiff, 3)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">垂直梯度:</span>
              <span
                className={
                  motionAnalysis.verticalGradient > 0.1 ? 'text-cyan-400' : ''
                }
              >
                {formatNumber(motionAnalysis.verticalGradient, 3)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">不对称:</span>
              <span>{formatNumber(motionAnalysis.asymmetryScore, 2)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">上像素:</span>
              <span>{formatInt(motionAnalysis.topPixelCount)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">下像素:</span>
              <span>{formatInt(motionAnalysis.bottomPixelCount)}</span>
            </div>

            <div className="my-1 border-t border-white/10" />
            <div className="text-center text-[9px] text-cyan-400">时间差值</div> */}

            <div className="flex justify-between">
              <span className="text-neutral-400">倾斜信号:</span>
              <span
                className={
                  motionAnalysis.tiltSignal > 0.02
                    ? 'font-bold text-cyan-400'
                    : ''
                }
              >
                {formatNumber(motionAnalysis.tiltSignal, 4)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-neutral-400">一致性:</span>
              <span
                className={
                  motionAnalysis.tiltConsistency >= 0.5 ? 'text-cyan-400' : ''
                }
              >
                {formatNumber(motionAnalysis.tiltConsistency, 2)}
              </span>
            </div>

            {stateMachineDebug && (
              <>
                <div className="my-1 border-t border-white/10" />
                <div className="text-center text-[9px] text-purple-400">
                  状态机
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-400">稳定性:</span>
                  <span
                    className={
                      stateMachineDebug.stabilityScore >= 2
                        ? 'text-purple-400'
                        : ''
                    }
                  >
                    {stateMachineDebug.stabilityScore}/5
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-400">软计数:</span>
                  <span>{formatNumber(stateMachineDebug.softCounter, 1)}</span>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
