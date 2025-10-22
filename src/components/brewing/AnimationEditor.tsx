/**
 * AnimationEditor组件功能整理
 *
 * 当前实现存在一些问题，以下是整理后的功能说明和重构建议。
 * 这可以作为您重新实现动画编辑器的参考。
 *
 * ## 当前组件主要功能
 *
 * 1. 帧管理
 *    - 添加/删除/复制/切换帧
 *    - 保存帧内容为SVG
 *    - 播放动画（循环和单次播放）
 *
 * 2. 绘图功能
 *    - 基于Canvas的绘图
 *    - 支持参考图像
 *    - 深色模式适配
 *
 * 3. 底图功能 (当前主要问题所在)
 *    - 显示前面帧作为半透明底图
 *    - 用于动画绘制参考
 *
 * ## 当前实现的主要问题
 *
 * 1. 底图实现复杂且不可靠
 *    - 使用SVG合并方式实现底图
 *    - 状态更新时序问题
 *    - 深色模式适配困难
 *
 * 2. 组件职责不清晰
 *    - AnimationEditor和DrawingCanvas职责混淆
 *    - 过多的状态和副作用
 *
 * 3. 性能问题
 *    - SVG解析和合并开销大
 *    - 频繁的DOM操作
 *
 * ## 建议的重构方案 (Canvas图层方案)
 *
 * 1. 数据结构
 *    ```typescript
 *    interface AnimationFrame {
 *      id: string;
 *      imageData: ImageData | null; // 使用Canvas的ImageData而非SVG
 *      thumbnail: string;           // 缩略图数据URL
 *    }
 *    ```
 *
 * 2. 使用叠加Canvas替代SVG合并
 *    - 底层Canvas: 显示参考图像
 *    - 中间Canvas: 显示前帧合成底图
 *    - 顶层Canvas: 当前绘制内容
 *
 * 3. 底图实现
 *    - 切换帧时直接将前帧渲染到中间Canvas
 *    - 设置适当的globalAlpha值
 *    - 深色模式使用CSS滤镜
 *
 * 4. 状态管理
 *    - 使用useReducer替代多个useState
 *    - 清晰的动作类型和状态转换
 *
 * ## 实现建议
 *
 * 1. 帧数据使用ImageData而非SVG
 *    - 更高效的数据结构
 *    - 避免SVG解析和操作
 *
 * 2. 分离关注点
 *    - 帧管理逻辑独立
 *    - 绘图功能独立
 *    - UI控制独立
 *
 * 3. 优化性能
 *    - 使用requestAnimationFrame实现平滑播放
 *    - 缓存底图和缩略图
 *    - 避免不必要的重渲染
 *
 * 这些建议可以帮助您实现一个更可靠、更高效的动画编辑器组件。
 */

'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import DrawingCanvas, { DrawingCanvasRef } from '../common/ui/DrawingCanvas';
import hapticsUtils from '@/lib/ui/haptics';
import Image from 'next/image';

// 定义单帧数据结构
export interface AnimationFrame {
  id: string;
  svgData: string;
}

// 定义动画编辑器引用接口
export interface AnimationEditorRef {
  save: () => AnimationFrame[];
  addFrame: () => void;
  deleteFrame: () => void;
  duplicateFrame: () => void;
  nextFrame: () => void;
  prevFrame: () => void;
  togglePlayback: () => void;
  undo: () => void;
  clear: () => void;
  setStrokeWidth: (width: number) => void;
}

// 定义动画编辑器属性
interface AnimationEditorProps {
  width?: number;
  height?: number;
  initialFrames?: AnimationFrame[];
  onAnimationComplete?: (frames: AnimationFrame[]) => void;
  referenceImages?: Array<{ url: string; label: string }>;
  maxFrames?: number;
  referenceSvg?: string;
}

// 使用forwardRef包装组件，便于父组件访问API
const AnimationEditor = forwardRef<AnimationEditorRef, AnimationEditorProps>(
  (
    {
      width = 300,
      height = 300,
      initialFrames,
      onAnimationComplete,
      referenceImages = [],
      maxFrames = 8,
      referenceSvg,
    },
    ref
  ) => {
    // 引用和状态
    const canvasRef = useRef<DrawingCanvasRef>(null);
    const [frames, setFrames] = useState<AnimationFrame[]>(
      initialFrames || [{ id: 'frame-1', svgData: '' }]
    );
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [referenceSrc, setReferenceSrc] = useState<string | null>(
      referenceImages.length > 0 ? referenceImages[0].url : null
    );
    // 修改：存储合并后的前面帧SVG作为底图
    const [previousFramesSvg, setPreviousFramesSvg] = useState<string>('');

    // 计算当前帧
    const currentFrame = frames[currentFrameIndex];

    // 获取缩略图大小
    const thumbnailSize = 64;

    // 合并指定帧范围的SVG
    const mergePreviousFrames = useCallback(
      (endIndex: number) => {
        if (endIndex <= 0 || frames.length === 0) return '';

        // 创建一个全新的SVG文档，避免累积偏移问题
        const newSvg = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'svg'
        );
        newSvg.setAttribute('width', width.toString());
        newSvg.setAttribute('height', height.toString());
        newSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        newSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        newSvg.setAttribute('class', 'custom-cup-shape outline-only');

        const parser = new DOMParser();

        // 遍历所有之前的帧，提取其SVG路径并合并
        for (let i = 0; i < endIndex; i++) {
          const frameSvg = frames[i]?.svgData || '';
          if (!frameSvg || frameSvg.trim() === '') {
            // 跳过空帧
            continue;
          }

          try {
            const svgDoc = parser.parseFromString(frameSvg, 'image/svg+xml');

            if (
              svgDoc.documentElement &&
              svgDoc.documentElement.tagName === 'svg'
            ) {
              // 获取所有path元素
              const pathElements = svgDoc.querySelectorAll('path');

              pathElements.forEach(originalPath => {
                // 创建一个全新的path元素，确保坐标系统正确
                const newPath = document.createElementNS(
                  'http://www.w3.org/2000/svg',
                  'path'
                );

                // 复制关键属性，确保坐标系统不变
                const dAttribute = originalPath.getAttribute('d');
                if (dAttribute) {
                  // 直接使用原始的路径数据，不进行任何变换
                  newPath.setAttribute('d', dAttribute);
                }

                // 复制其他样式属性
                const stroke =
                  originalPath.getAttribute('stroke') ||
                  'var(--custom-shape-color)';
                const strokeWidth =
                  originalPath.getAttribute('stroke-width') || '3';
                const fill = originalPath.getAttribute('fill') || 'none';

                newPath.setAttribute('stroke', stroke);
                newPath.setAttribute('stroke-width', strokeWidth);
                newPath.setAttribute('fill', fill);
                newPath.setAttribute('stroke-linecap', 'round');
                newPath.setAttribute('stroke-linejoin', 'round');

                // 添加到新的SVG中
                newSvg.appendChild(newPath);
              });
            }
          } catch (error) {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
              console.error(`合并第${i}帧时出错:`, error);
            }
          }
        }

        // 将DOM转换回字符串
        const serializer = new XMLSerializer();
        const result = serializer.serializeToString(newSvg);

        return result;
      },
      [frames, width, height]
    );

    // 保存当前帧内容
    const saveCurrentFrame = useCallback(() => {
      if (
        !canvasRef.current ||
        currentFrameIndex < 0 ||
        currentFrameIndex >= frames.length
      )
        return;

      try {
        // 获取当前画布内容
        const svgData = canvasRef.current.save();

        // 更新当前帧数据
        setFrames(prev =>
          prev.map((frame, index) =>
            index === currentFrameIndex ? { ...frame, svgData } : frame
          )
        );
      } catch (_error) {
        // 保存帧数据失败
      }
    }, [currentFrameIndex, frames.length]);

    // 切换到指定帧
    const goToFrame = useCallback(
      (index: number) => {
        if (index < 0 || index >= frames.length) return;

        // 先保存当前帧的内容
        saveCurrentFrame();

        // 更新前面帧的合并SVG
        const mergedSvg = mergePreviousFrames(index);
        // 切换帧
        setPreviousFramesSvg(mergedSvg);

        // 切换到新帧
        setCurrentFrameIndex(index);

        // 清空画布并加载当前帧内容（如果有）
        if (canvasRef.current) {
          if (frames[index] && frames[index].svgData) {
            // 如果有保存的内容则加载
            try {
              // 不需要额外操作，defaultSvg变化会自动触发DrawingCanvas的useEffect
            } catch (_error) {
              // 无法加载帧内容
            }
          } else {
            // 如果是空帧则清空画布
            canvasRef.current.clear();
          }
        }

        hapticsUtils.light();
      },
      [frames, saveCurrentFrame, mergePreviousFrames]
    );

    // 添加新帧
    const addFrame = useCallback(() => {
      if (frames.length >= maxFrames) {
        // 达到最大帧数
        hapticsUtils.warning();
        return;
      }

      hapticsUtils.light();

      // 先保存当前帧内容
      saveCurrentFrame();

      // 生成新的帧ID
      const newFrameId = `frame-${Date.now()}`;

      // 添加新帧（空白）并更新当前帧索引
      setFrames(prev => {
        const newFrames = [...prev, { id: newFrameId, svgData: '' }];
        // 在帧数组更新的同时更新当前帧索引，确保它们是同步的
        const newIndex = newFrames.length - 1;

        // 更新前面帧的合并SVG
        const mergedSvg = mergePreviousFrames(newIndex);
        // 添加新帧
        setPreviousFramesSvg(mergedSvg);

        // 更新当前帧索引
        setCurrentFrameIndex(newIndex);

        return newFrames;
      });

      // 清空当前绘图内容
      if (canvasRef.current) {
        canvasRef.current.clear();
      }
    }, [frames, maxFrames, saveCurrentFrame, mergePreviousFrames]);

    // 删除当前帧
    const deleteCurrentFrame = useCallback(() => {
      if (frames.length <= 1) {
        // 至少保留一帧
        hapticsUtils.warning();
        return;
      }

      hapticsUtils.medium();

      // 移除当前帧
      setFrames(prev => {
        const newFrames = prev.filter(
          (_, index) => index !== currentFrameIndex
        );
        return newFrames;
      });

      // 调整当前帧索引
      setCurrentFrameIndex(prev => Math.min(prev, frames.length - 2));
    }, [frames, currentFrameIndex]);

    // 复制当前帧
    const duplicateCurrentFrame = useCallback(() => {
      if (frames.length >= maxFrames) {
        // 达到最大帧数
        hapticsUtils.warning();
        return;
      }

      hapticsUtils.light();

      // 先保存当前帧
      saveCurrentFrame();

      // 复制当前帧数据
      const frameToClone = frames[currentFrameIndex];

      // 如果当前帧为空，等同于添加新帧
      if (!frameToClone || !frameToClone.svgData) {
        addFrame();
        return;
      }

      // 创建副本
      const clonedFrame: AnimationFrame = {
        id: `frame-${Date.now()}`,
        svgData: frameToClone.svgData,
      };

      // 在当前帧后插入副本
      setFrames(prev => [
        ...prev.slice(0, currentFrameIndex + 1),
        clonedFrame,
        ...prev.slice(currentFrameIndex + 1),
      ]);

      // 切换到新复制的帧
      setCurrentFrameIndex(currentFrameIndex + 1);
    }, [frames, currentFrameIndex, addFrame, maxFrames, saveCurrentFrame]);

    // 切换播放状态
    const togglePlayback = useCallback(() => {
      setIsPlaying(prev => !prev);
      hapticsUtils.light();
    }, []);

    // 确保参考图像在组件挂载时正确初始化
    useEffect(() => {
      if (referenceImages.length > 0 && !referenceSrc) {
        // 初始化默认参考图像
        setReferenceSrc(referenceImages[0].url);
      }
    }, [referenceImages, referenceSrc]);

    // 选择参考图像
    const selectReferenceImage = useCallback((src: string | null) => {
      // 切换参考图像
      setReferenceSrc(src);
      hapticsUtils.light();
    }, []);

    // 保存整个动画
    const saveAnimation = useCallback(() => {
      // 首先保存当前帧
      saveCurrentFrame();

      // 保存动画

      return frames;
    }, [frames, saveCurrentFrame]);

    // 切换到下一帧/上一帧
    const nextFrame = useCallback(() => {
      if (currentFrameIndex < frames.length - 1) {
        goToFrame(currentFrameIndex + 1);
      }
    }, [currentFrameIndex, frames.length, goToFrame]);

    const prevFrame = useCallback(() => {
      if (currentFrameIndex > 0) {
        goToFrame(currentFrameIndex - 1);
      }
    }, [currentFrameIndex, goToFrame]);

    // 暴露API给父组件
    useImperativeHandle(
      ref,
      () => ({
        save: saveAnimation,
        addFrame,
        deleteFrame: deleteCurrentFrame,
        duplicateFrame: duplicateCurrentFrame,
        nextFrame,
        prevFrame,
        togglePlayback,
        undo: () => canvasRef.current?.undo(),
        clear: () => canvasRef.current?.clear(),
        setStrokeWidth: (width: number) =>
          canvasRef.current?.setStrokeWidth(width),
      }),
      [
        saveAnimation,
        addFrame,
        deleteCurrentFrame,
        duplicateCurrentFrame,
        nextFrame,
        prevFrame,
        togglePlayback,
      ]
    );

    // 处理帧切换时的画布更新
    useEffect(() => {
      // 更新画布内容为当前帧
      if (canvasRef.current && currentFrame) {
        // 如果当前帧有SVG数据，画布组件会自动加载
        // 如果当前帧无数据，确保画布是空的
        if (!currentFrame.svgData) {
          canvasRef.current.clear();
        }
      }
    }, [currentFrame, currentFrameIndex]);

    // 处理播放逻辑
    useEffect(() => {
      if (!isPlaying) return;

      const interval = setInterval(() => {
        setCurrentFrameIndex(prev => {
          // 循环播放
          const nextIndex = (prev + 1) % frames.length;
          return nextIndex;
          // 底图更新将在专门的useEffect中处理
        });
      }, 800); // 每帧800ms，同步与预览速度

      return () => clearInterval(interval);
    }, [isPlaying, frames.length]);

    // 添加一个专门用于更新底图的useEffect
    useEffect(() => {
      // 只有在有多个帧，且当前帧索引大于0时才需要设置底图
      if (frames.length > 1 && currentFrameIndex > 0) {
        // 更新底图

        // 合并当前帧之前的所有帧作为底图
        const mergedPreviousSvg = mergePreviousFrames(currentFrameIndex);
        // 合并前帧SVG
        setPreviousFramesSvg(mergedPreviousSvg);
      } else if (currentFrameIndex === 0) {
        // 第一帧不需要底图
        // 第一帧，清空底图
        setPreviousFramesSvg('');
      }
    }, [currentFrameIndex, frames, mergePreviousFrames]);

    // 处理键盘快捷键
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') {
          prevFrame();
        } else if (e.key === 'ArrowRight') {
          nextFrame();
        } else if (e.key === ' ') {
          // 空格键切换播放状态
          togglePlayback();
          e.preventDefault(); // 防止页面滚动
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [prevFrame, nextFrame, togglePlayback]);

    // 处理绘制完成
    const handleDrawingComplete = useCallback(
      (svgString: string) => {
        if (!svgString) return;

        // 更新当前帧的SVG数据
        setFrames(prev => {
          const newFrames = [...prev];
          newFrames[currentFrameIndex] = {
            ...newFrames[currentFrameIndex],
            svgData: svgString,
          };
          return newFrames;
        });

        // 如果有完成回调，则调用
        if (onAnimationComplete) {
          onAnimationComplete(frames);
        }
      },
      [currentFrameIndex, frames, onAnimationComplete]
    );

    return (
      <div className="flex flex-col space-y-4">
        {/* 主画布区域 */}
        <div className="relative overflow-hidden rounded-lg border-2 border-neutral-300 bg-white shadow-md dark:border-neutral-700 dark:bg-neutral-900">
          <DrawingCanvas
            ref={canvasRef}
            width={width}
            height={height}
            defaultSvg={currentFrame.svgData}
            onDrawingComplete={handleDrawingComplete}
            referenceSvg={previousFramesSvg}
            referenceSvgUrl={
              !referenceSvg ? referenceSrc || undefined : undefined
            }
            _customReferenceSvg={referenceSvg}
            showReference={true}
          />

          {/* 帧指示器 */}
          <div className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-1 text-xs text-neutral-100">
            帧 {currentFrameIndex + 1}/{frames.length}
          </div>
        </div>

        {/* 帧控制和预览区域 */}
        <div className="flex flex-col space-y-2">
          {/* 帧缩略图容器 */}
          <div className="flex gap-2 overflow-x-auto rounded-lg bg-neutral-100 p-2 dark:bg-neutral-800">
            {frames.map((frame, index) => (
              <button
                key={frame.id}
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  goToFrame(index);
                }}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-neutral-200 dark:bg-neutral-700 ${
                  index === currentFrameIndex
                    ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
                    : 'border-neutral-300 dark:border-neutral-600'
                }`}
              >
                <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-neutral-900">
                  {frame.svgData ? (
                    <div
                      className="h-full w-full"
                      dangerouslySetInnerHTML={{
                        __html: frame.svgData.replace(
                          /<svg/,
                          `<svg width="${thumbnailSize}" height="${thumbnailSize}"`
                        ),
                      }}
                    />
                  ) : (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      空白
                    </span>
                  )}
                </div>
                <div className="absolute right-0 bottom-0 left-0 bg-black/50 text-center text-[10px] text-neutral-100">
                  帧 {index + 1}
                </div>
              </button>
            ))}

            {/* 添加新帧按钮 */}
            {frames.length < maxFrames && (
              <button
                onClick={e => {
                  // 阻止事件冒泡，防止点击导致模态框关闭
                  e.stopPropagation();
                  e.preventDefault();
                  addFrame();
                }}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-neutral-300 bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-700"
              >
                <svg
                  className="h-6 w-6 text-neutral-500 dark:text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* 帧操作按钮 */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              {/* 播放/暂停按钮 */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  togglePlayback();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700"
                aria-label={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? (
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10 9V15M14 9V15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6 4.75L17.25 12L6 19.25V4.75Z"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>

              {/* 上一帧按钮 */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  prevFrame();
                }}
                disabled={currentFrameIndex <= 0}
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 ${
                  currentFrameIndex <= 0 ? 'cursor-not-allowed opacity-50' : ''
                }`}
                aria-label="上一帧"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15 18L9 12L15 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* 下一帧按钮 */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  nextFrame();
                }}
                disabled={currentFrameIndex >= frames.length - 1}
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 ${
                  currentFrameIndex >= frames.length - 1
                    ? 'cursor-not-allowed opacity-50'
                    : ''
                }`}
                aria-label="下一帧"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 6L15 12L9 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div className="flex gap-2">
              {/* 复制帧按钮 */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  duplicateCurrentFrame();
                }}
                disabled={frames.length >= maxFrames}
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 ${
                  frames.length >= maxFrames
                    ? 'cursor-not-allowed opacity-50'
                    : ''
                }`}
                aria-label="复制当前帧"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 16H6C4.89543 16 4 15.1046 4 14V6C4 4.89543 4.89543 4 6 4H14C15.1046 4 16 4.89543 16 6V8M10 20H18C19.1046 20 20 19.1046 20 18V10C20 8.89543 19.1046 8 18 8H10C8.89543 8 8 8.89543 8 10V18C8 19.1046 8.89543 20 10 20Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* 删除帧按钮 */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  deleteCurrentFrame();
                }}
                disabled={frames.length <= 1}
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 ${
                  frames.length <= 1 ? 'cursor-not-allowed opacity-50' : ''
                }`}
                aria-label="删除当前帧"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* 参考图像选择器 - 如果有参考图像 */}
          {referenceImages.length > 0 && (
            <div className="mt-2">
              <label className="mb-1 block text-sm font-medium text-neutral-600 dark:text-neutral-400">
                参考图像
              </label>
              <div className="flex gap-2 overflow-x-auto rounded-lg bg-neutral-100 p-2 dark:bg-neutral-800">
                {/* 无参考选项 */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    e.preventDefault();
                    selectReferenceImage(null);
                  }}
                  className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 ${
                    !referenceSrc
                      ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
                      : 'border-neutral-300 dark:border-neutral-600'
                  }`}
                >
                  <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-neutral-900">
                    <svg
                      className="h-6 w-6 text-neutral-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M18.364 18.364C21.8787 14.8492 21.8787 9.15076 18.364 5.63604C14.8492 2.12132 9.15076 2.12132 5.63604 5.63604M18.364 18.364C14.8492 21.8787 9.15076 21.8787 5.63604 18.364C2.12132 14.8492 2.12132 9.15076 5.63604 5.63604M18.364 18.364L5.63604 5.63604"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="absolute right-0 bottom-0 left-0 bg-black/50 text-center text-[10px] text-neutral-100">
                    无
                  </div>
                </button>

                {/* 参考图像列表 */}
                {referenceImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={e => {
                      e.stopPropagation();
                      e.preventDefault();
                      selectReferenceImage(img.url);
                    }}
                    className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 ${
                      referenceSrc === img.url
                        ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
                        : 'border-neutral-300 dark:border-neutral-600'
                    }`}
                  >
                    <Image
                      src={img.url}
                      alt={img.label}
                      width={48}
                      height={48}
                      className="object-contain"
                    />
                    <div className="absolute right-0 bottom-0 left-0 bg-black/50 text-center text-[10px] text-neutral-100">
                      {img.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

// 为组件添加displayName，有助于调试
AnimationEditor.displayName = 'AnimationEditor';

export default AnimationEditor;
