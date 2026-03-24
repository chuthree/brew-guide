'use client';

import React, { useState } from 'react';
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
  onExport?: () => void;
  onCopyLog?: () => Promise<string>;
  hasRecording?: boolean;
}

export default function DebugOverlay({
  state,
  consecutiveCount,
  processingTimeMs,
  motionAnalysis,
  stateMachineDebug,
  visible,
  position = 'top-right',
  onExport,
  onCopyLog,
  hasRecording = false,
}: DebugOverlayProps) {
  const [showExportPanel, setShowExportPanel] = useState(false);

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

  const handleExport = () => {
    if (onExport) {
      onExport();
    }
    setShowExportPanel(true);
  };

  const handleCloseExportPanel = () => {
    setShowExportPanel(false);
  };

  return (
    <>
      <div
        className={`absolute ${positionClasses[position]} z-50 w-[150px] overflow-hidden rounded bg-black/70 p-2 font-mono text-[10px] leading-tight text-white backdrop-blur-sm`}
      >
        <div className="mb-1 flex items-center justify-between border-b border-white/20 pb-1">
          <span className="font-semibold text-green-400">运动检测调试</span>
          {hasRecording && (
            <button
              onClick={handleExport}
              className="rounded bg-green-500/20 px-1.5 py-0.5 text-[8px] text-green-400 hover:bg-green-500/30"
              title="导出调试数据"
            >
              导出
            </button>
          )}
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

          {motionAnalysis && (
            <>
              <div className="my-1 border-t border-white/10" />

              <div className="flex justify-between">
                <span className="text-neutral-400">区域:</span>
                <span className="capitalize">
                  {motionAnalysis.motionRegion}
                </span>
              </div>

              <div className="my-1 border-t border-white/10" />

              <div className="flex justify-between">
                <span className="text-neutral-400">水壶倾斜:</span>
                <span
                  className={
                    motionAnalysis.isKettleTilt
                      ? 'font-bold text-green-400'
                      : ''
                  }
                >
                  {motionAnalysis.isKettleTilt ? '是' : '否'}
                </span>
              </div>

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
              <div className="text-center text-[9px] text-cyan-400">
                旋转检测
              </div>

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

              <div className="my-1 border-t border-white/10" />

              <div className="flex justify-between">
                <span className="text-neutral-400">像素数:</span>
                <span>{formatInt(motionAnalysis.totalMotionPixels)}</span>
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
                    <span>
                      {formatNumber(stateMachineDebug.softCounter, 1)}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showExportPanel && (
        <ExportPanel onClose={handleCloseExportPanel} onCopyLog={onCopyLog} />
      )}
    </>
  );
}

function ExportPanel({
  onClose,
  onCopyLog,
}: {
  onClose: () => void;
  onCopyLog?: () => Promise<string>;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      setCopyError(null);
      let textToCopy: string;
      if (onCopyLog) {
        textToCopy = await onCopyLog();
        if (
          !textToCopy ||
          textToCopy === '无调试数据' ||
          textToCopy === '复制失败'
        ) {
          setCopyError('暂无可用日志数据，请先进行倾倒动作');
          return;
        }
      } else {
        textToCopy = '调试数据已复制到剪贴板。请在停止摄像头后导出完整报告。';
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setCopyError('复制失败，请重试');
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const event = new CustomEvent('debug:export');
    window.dispatchEvent(event);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl dark:bg-neutral-800">
        <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-700">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            导出调试数据
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            调试数据会在摄像头停止后自动生成完整报告。您可以选择下载报告或复制到剪贴板。
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
            >
              下载报告
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
            >
              {copied ? '已复制!' : '复制到剪贴板'}
            </button>
          </div>

          {copyError && (
            <div className="rounded bg-red-50 p-3 text-xs text-red-500 dark:bg-red-900/20 dark:text-red-400">
              <p>{copyError}</p>
            </div>
          )}

          <div className="rounded bg-neutral-50 p-3 text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            <p>提示：完整报告包含所有帧的详细数据，可用于AI分析问题。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
