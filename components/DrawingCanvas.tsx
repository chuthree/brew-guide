'use client'

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { linesToSvgPath, svgToLines } from '@/lib/svgUtils';
import hapticsUtils from '@/lib/haptics';

interface Point {
  x: number;
  y: number;
}

interface Line {
  points: Point[];
  strokeWidth: number;
  color: string;
}

interface DrawingCanvasProps {
  width?: number;
  height?: number;
  defaultSvg?: string;
  onDrawingComplete?: (svgString: string) => void;
  referenceSvgUrl?: string;
  referenceSvg?: string;
  strokeColor?: string;
  showReference?: boolean;
  _customReferenceSvg?: string;
}

// 定义暴露给父组件的API接口
export interface DrawingCanvasRef {
  clear: () => void;
  undo: () => void;
  save: () => string;
  setStrokeWidth: React.Dispatch<React.SetStateAction<number>>;
  setColor: React.Dispatch<React.SetStateAction<string>>;
}

// 修改主题检测辅助函数
function isDarkMode(): boolean {
  // 只检查 HTML 元素是否有 dark 类
  return document.documentElement.classList.contains('dark');
}

// 使用forwardRef改造组件，使其能够接收父组件的ref
const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  width = 300,
  height = 300,
  defaultSvg,
  onDrawingComplete,
  referenceSvgUrl = '/images/v60-base.svg',
  referenceSvg,
  strokeColor,
  showReference = true,
  _customReferenceSvg,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<Line[]>([]);
  const blobUrlRef = useRef<string | null>(null);
  
  // 状态
  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [currentLine, setCurrentLine] = useState<Line | null>(null);
  const [strokeWidth, setStrokeWidth] = useState(3);
  // 强制使用纯黑色(#000000)作为默认颜色，以便在暗黑模式下可以正确转换为白色
  const [_color, _setColor] = useState(strokeColor || '#000000');
  const [isReady, setIsReady] = useState(false);
  const [isDark, setIsDark] = useState(false); // 追踪深色模式状态
  
  // 绘图参考图像是否加载
  const [referenceLoaded, setReferenceLoaded] = useState(false);
  const referenceImageRef = useRef<HTMLImageElement | null>(null);
  
  // 添加状态跟踪URL参考图像
  const [urlReferenceLoaded, setUrlReferenceLoaded] = useState(false);
  const urlReferenceImageRef = useRef<HTMLImageElement | null>(null);
  
  // 检测并更新当前主题模式
  const updateThemeMode = useCallback(() => {
    setIsDark(isDarkMode());
  }, []);
  
  // 初始化并监听主题变化
  useEffect(() => {
    // 初始检测
    updateThemeMode();
    
    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => updateThemeMode();
    
    // 添加媒体查询监听器（兼容不同浏览器）
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else if ('addListener' in mediaQuery) {
      // 旧版API支持 - 使用更具体的类型断言
      (mediaQuery as { addListener: (fn: () => void) => void }).addListener(handleChange);
    }
    
    // 创建一个MutationObserver来监听HTML元素上的类变化（主题切换）
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.attributeName === 'class' &&
          mutation.target === document.documentElement
        ) {
          updateThemeMode();
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    
    return () => {
      // 清理媒体查询监听器
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else if ('removeListener' in mediaQuery) {
        // 旧版API支持 - 使用更具体的类型断言
        (mediaQuery as { removeListener: (fn: () => void) => void }).removeListener(handleChange);
      }
      
      // 清理MutationObserver
      observer.disconnect();
    };
  }, [updateThemeMode]);

  // 初始化默认SVG
  useEffect(() => {
    if (defaultSvg && defaultSvg.trim() !== '') {
      try {
        const importedLines = svgToLines(defaultSvg);
        setLines(importedLines);
      } catch (error) {
        console.error('无法导入SVG:', error);
      }
    }
  }, [defaultSvg]);

  // 清理函数
  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // 加载SVG字符串作为参考图像
  useEffect(() => {
    let mounted = true;
    let currentBlobUrl: string | null = null;

    // 清理上一个引用
    setReferenceLoaded(false);
    referenceImageRef.current = null;
    cleanupBlobUrl();

    // 优先使用自定义杯型SVG
    const svgToUse = referenceSvg;
    
    if (!svgToUse || !svgToUse.trim()) {
      console.log('[SVG加载] 没有SVG数据');
      return () => {
        mounted = false;
      };
    }

    try {
      console.log('[SVG加载] 开始处理SVG数据，长度:', svgToUse.length);
      
      // 处理SVG颜色 - 根据当前主题模式设置颜色
      let processedSvg = svgToUse;
      const themeColor = isDark ? '#FFFFFF' : '#000000';
      
      // 统一替换所有颜色为当前主题色
      processedSvg = processedSvg
        .replace(/stroke="var\(--custom-shape-color\)"/g, `stroke="${themeColor}"`)
        .replace(/stroke="#000000"/g, `stroke="${themeColor}"`)
        .replace(/stroke="#FFFFFF"/g, `stroke="${themeColor}"`)
        .replace(/stroke="black"/g, `stroke="${themeColor}"`)
        .replace(/stroke="white"/g, `stroke="${themeColor}"`);

      const svgBlob = new Blob([processedSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);
      currentBlobUrl = url;
      blobUrlRef.current = url;

      const img = new Image();
      img.src = url;

      img.onload = () => {
        if (mounted) {
          console.log('[SVG加载] 图像加载完成');
          referenceImageRef.current = img;
          setReferenceLoaded(true);
        }
      };

      // 添加错误处理
      img.onerror = (error) => {
        if (mounted) {
          console.error('[SVG加载] 图像加载出错:', error);
        }
      };

      return () => {
        mounted = false;
        // 组件卸载时清理资源
        img.onload = null;
        img.onerror = null;
        if (currentBlobUrl) {
          URL.revokeObjectURL(currentBlobUrl);
        }
      };
    } catch (error) {
      console.error('[SVG加载] 处理SVG时出错:', error);
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    }
  }, [referenceSvg, isDark, cleanupBlobUrl]);

  // 加载URL参考图像（杯型等）
  useEffect(() => {
    let mounted = true;

    // 如果有自定义杯型，就不加载默认杯型
    if (_customReferenceSvg) {
      console.log('[杯型加载] 使用自定义杯型');
      setUrlReferenceLoaded(false);
      urlReferenceImageRef.current = null;
      return () => {
        mounted = false;
      };
    }

    if (!referenceSvgUrl) {
      setUrlReferenceLoaded(false);
      urlReferenceImageRef.current = null;
      return () => {
        mounted = false;
      };
    }
    
    console.log('[杯型加载] 开始加载默认杯型图像:', referenceSvgUrl);
    
    const img = new Image();
    img.src = referenceSvgUrl;
    
    img.onload = () => {
      if (mounted) {
        console.log('[杯型加载] 默认杯型图像加载完成');
        urlReferenceImageRef.current = img;
        setUrlReferenceLoaded(true);
      }
    };

    img.onerror = (error) => {
      if (mounted) {
        console.error('[杯型加载] 默认杯型图像加载失败:', error);
      }
    };
    
    return () => {
      mounted = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [referenceSvgUrl, _customReferenceSvg]);

  // 加载自定义杯型SVG
  useEffect(() => {
    let mounted = true;
    let currentBlobUrl: string | null = null;

    if (!_customReferenceSvg) {
      return () => {
        mounted = false;
      };
    }

    try {
      console.log('[自定义杯型] 开始处理SVG数据，长度:', _customReferenceSvg.length);
      
      // 处理SVG颜色 - 根据当前主题模式设置颜色
      let processedSvg = _customReferenceSvg;
      const themeColor = isDark ? '#FFFFFF' : '#000000';
      
      // 统一替换所有颜色为当前主题色
      processedSvg = processedSvg
        .replace(/stroke="var\(--custom-shape-color\)"/g, `stroke="${themeColor}"`)
        .replace(/stroke="#000000"/g, `stroke="${themeColor}"`)
        .replace(/stroke="#FFFFFF"/g, `stroke="${themeColor}"`)
        .replace(/stroke="black"/g, `stroke="${themeColor}"`)
        .replace(/stroke="white"/g, `stroke="${themeColor}"`);

      const svgBlob = new Blob([processedSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);
      currentBlobUrl = url;
      blobUrlRef.current = url;

      const img = new Image();
      img.src = url;

      img.onload = () => {
        if (mounted) {
          console.log('[自定义杯型] 图像加载完成');
          urlReferenceImageRef.current = img;
          setUrlReferenceLoaded(true);
        }
      };

      img.onerror = (error) => {
        if (mounted) {
          console.error('[自定义杯型] 图像加载失败:', error);
        }
      };

      return () => {
        mounted = false;
        img.onload = null;
        img.onerror = null;
        if (currentBlobUrl) {
          URL.revokeObjectURL(currentBlobUrl);
        }
      };
    } catch (error) {
      console.error('[自定义杯型] 处理SVG时出错:', error);
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    }
  }, [_customReferenceSvg, isDark]);

  // 设置画布偏移 - 优化版本，添加更多时机更新位置
  const updateCanvasOffset = useCallback(() => {
    setTimeout(() => {
      if (canvasRef.current) {
        // 获取矩形但不用于任何地方，只设置ready状态
        setIsReady(true);
      }
    }, 100); // 添加短暂延迟确保元素已完全渲染
  }, []);

  // 组件挂载和窗口调整时更新画布偏移
  useEffect(() => {
    // 初始延迟更长以确保模态框动画完成
    const initialTimer = setTimeout(updateCanvasOffset, 300);
    
    // 监听窗口大小变化
    window.addEventListener('resize', updateCanvasOffset);
    
    // 额外添加滚动监听，因为滚动也会改变相对位置
    window.addEventListener('scroll', updateCanvasOffset);
    
    // 每500ms更新一次位置，确保位置始终正确
    const intervalTimer = setInterval(updateCanvasOffset, 500);
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      window.removeEventListener('resize', updateCanvasOffset);
      window.removeEventListener('scroll', updateCanvasOffset);
    };
  }, [updateCanvasOffset]);

  // 获取实际的绘图颜色值
  const getCurrentDrawingColor = useCallback(() => {
    // 获取实际的 CSS 变量值
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--custom-shape-color')
      .trim();
    
    // 如果获取失败，根据当前模式返回默认值
    return color || (isDark ? '#FFFFFF' : '#000000');
  }, [isDark]);

  // 重绘画布
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    
    if (!context || !canvas) return;
    
    // 清空画布
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // 首先绘制SVG参考图像（前帧）
    if (showReference && referenceLoaded && referenceImageRef.current) {
      context.save();
      context.globalAlpha = isDark ? 0.6 : 0.4;
      
      if (isDark) {
        context.filter = 'brightness(1.2)';
      }
      
      context.drawImage(
        referenceImageRef.current, 
        0, 
        0, 
        canvas.width, 
        canvas.height
      );
      
      context.restore();
    }
    
    // 然后绘制URL参考图像（杯型等）
    if (urlReferenceLoaded && urlReferenceImageRef.current) {
      context.save();
      
      // 设置透明度 - 深色模式下进一步提高透明度使图像更清晰
      context.globalAlpha = isDark ? 0.8 : 0.2;
      
      if (isDark) {
        // 在深色模式下强化反转和对比度
        context.filter = 'invert(1) contrast(2) brightness(2.5)';
        
        // 先绘制一次增强的图像
        context.drawImage(
          urlReferenceImageRef.current, 
          0, 
          0, 
          canvas.width, 
          canvas.height
        );
        
        // 再绘制一次轮廓加强效果
        context.globalAlpha = 0.7;
        context.filter = 'invert(1) contrast(3) brightness(3) saturate(0)';
        context.drawImage(
          urlReferenceImageRef.current, 
          0, 
          0, 
          canvas.width, 
          canvas.height
        );
        
        // 添加第三次绘制，专注于轮廓
        context.globalAlpha = 0.5;
        context.filter = 'invert(1) brightness(5) contrast(5) saturate(0)';
        context.drawImage(
          urlReferenceImageRef.current, 
          0, 
          0, 
          canvas.width, 
          canvas.height
        );
      } else {
        // 浅色模式正常绘制
        context.drawImage(
          urlReferenceImageRef.current, 
          0, 
          0, 
          canvas.width, 
          canvas.height
        );
      }
      
      context.restore();
    }
    
    // 获取当前实际的绘图颜色
    const drawingColor = getCurrentDrawingColor();
    
    // 绘制所有已保存的线条
    lines.forEach(line => {
      if (line.points.length < 2) return;
      
      context.beginPath();
      context.moveTo(line.points[0].x, line.points[0].y);
      
      for (let i = 1; i < line.points.length; i++) {
        context.lineTo(line.points[i].x, line.points[i].y);
      }
      
      context.strokeStyle = drawingColor;
      context.lineWidth = line.strokeWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
    });
    
    // 绘制当前正在绘制的线条
    if (currentLine && currentLine.points.length > 1) {
      context.beginPath();
      context.moveTo(currentLine.points[0].x, currentLine.points[0].y);
      
      for (let i = 1; i < currentLine.points.length; i++) {
        context.lineTo(currentLine.points[i].x, currentLine.points[i].y);
      }
      
      context.strokeStyle = drawingColor;
      context.lineWidth = currentLine.strokeWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
    }
  }, [lines, currentLine, referenceLoaded, urlReferenceLoaded, showReference, isDark, getCurrentDrawingColor]);

  // 每次状态更新时重绘画布
  useEffect(() => {
    if (isReady) {
      redrawCanvas();
    }
  }, [redrawCanvas, isReady]);

  // 更新linesRef当lines状态改变时
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  // 保存绘图为SVG并通知父组件
  const saveDrawing = useCallback(() => {
    // 使用linesRef.current以确保获取最新的lines
    const svgString = linesToSvgPath(linesRef.current, width, height);
    if (onDrawingComplete) {
      onDrawingComplete(svgString);
    }
    return svgString;
  }, [width, height, onDrawingComplete]);

  // 修改处理触摸/鼠标开始事件
  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current || !isReady) return;
    
    hapticsUtils.light();
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) return;
    
    // 获取实际的颜色值
    const drawingColor = getCurrentDrawingColor();
    
    setIsDrawing(true);
    setCurrentLine({
      points: [{ x, y }],
      strokeWidth,
      color: drawingColor // 使用实际的颜色值
    });
  }, [strokeWidth, isReady, getCurrentDrawingColor]);

  // 处理触摸/鼠标移动事件 - 直接处理相对于画布的坐标
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDrawing || !currentLine || !canvasRef.current) return;
    
    // 计算相对于画布左上角的坐标
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // 确保坐标在画布范围内
    if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) return;
    
    setCurrentLine(prev => {
      if (!prev) return null;
      return {
        ...prev,
        points: [...prev.points, { x, y }]
      };
    });
  }, [isDrawing, currentLine]);

  // 处理触摸/鼠标结束事件
  const handleEnd = useCallback(() => {
    if (!isDrawing || !currentLine) return;
    
    hapticsUtils.medium();
    
    // 只有当线条有足够的点时才保存
    if (currentLine.points.length > 1) {
      // 同步更新lines数组
      const updatedLines = [...linesRef.current, currentLine];
      setLines(updatedLines);
      
      // 立即更新ref，以便saveDrawing可以访问
      linesRef.current = updatedLines;
      
      // 确保状态更新后再调用保存
      // 移除setTimeout，直接调用saveDrawing
      saveDrawing();
    }
    
    setIsDrawing(false);
    setCurrentLine(null);
    
    // 更新画布偏移以防止动画或滚动后的位置变化
    updateCanvasOffset();
  }, [isDrawing, currentLine, saveDrawing, updateCanvasOffset]);

  // 在 useEffect 之前添加新的事件处理设置
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const touchStartHandler = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    };

    const touchMoveHandler = (e: TouchEvent) => {
      if (!isDrawing || e.touches.length !== 1) return;
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
      e.preventDefault();
    };

    const touchEndHandler = () => {
      if (!isDrawing) return;
      handleEnd();
    };

    canvas.addEventListener('touchstart', touchStartHandler, { passive: true });
    canvas.addEventListener('touchmove', touchMoveHandler, { passive: false });
    canvas.addEventListener('touchend', touchEndHandler, { passive: true });

    return () => {
      canvas.removeEventListener('touchstart', touchStartHandler);
      canvas.removeEventListener('touchmove', touchMoveHandler);
      canvas.removeEventListener('touchend', touchEndHandler);
    };
  }, [isDrawing, handleStart, handleMove, handleEnd]);

  // 鼠标事件处理（用于桌面测试）- 优化版本
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY);
  }, [handleStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing) return;
    handleMove(e.clientX, e.clientY);
  }, [isDrawing, handleMove]);

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // 清除画布
  const clearCanvas = useCallback(() => {
    hapticsUtils.light();
    setLines([]);
    setCurrentLine(null);
  }, []);

  // 撤销最后一条线
  const undoLastLine = useCallback(() => {
    hapticsUtils.light();
    setLines(prev => prev.slice(0, -1));
  }, []);

  // 公开API - 使用useImperativeHandle向父组件暴露功能
  useImperativeHandle(ref, () => ({
    clear: clearCanvas,
    undo: undoLastLine,
    save: saveDrawing,
    setStrokeWidth,
    setColor: _setColor
  }), [clearCanvas, undoLastLine, saveDrawing, setStrokeWidth, _setColor]);

  // 渲染函数
  const draw = useCallback(() => {
    if (!canvasRef.current || !isReady) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 如果需要显示参考图像
    if (showReference) {
      // 优先显示前帧底图（referenceSvg）
      if (referenceLoaded && referenceImageRef.current) {
        ctx.save();
        ctx.globalAlpha = isDark ? 0.4 : 0.3; // 调整前帧底图的透明度
        
        // 在深色模式下可以增加一些滤镜提高可见性
        if (isDark) {
          ctx.filter = 'brightness(1.2)';
        }
        
        ctx.drawImage(referenceImageRef.current, 0, 0, width, height);
        ctx.restore();
      }
      
      // 然后显示杯型参考图像
      if (urlReferenceLoaded && urlReferenceImageRef.current) {
        ctx.save();
        ctx.globalAlpha = isDark ? 0.8 : 0.2;
        
        if (isDark) {
          // 在深色模式下强化反转和对比度
          ctx.filter = 'invert(1) contrast(2) brightness(2.5)';
          
          // 先绘制一次增强的图像
          ctx.drawImage(
            urlReferenceImageRef.current, 
            0, 
            0, 
            width, 
            height
          );
          
          // 再绘制一次轮廓加强效果
          ctx.globalAlpha = 0.7;
          ctx.filter = 'invert(1) contrast(3) brightness(3) saturate(0)';
          ctx.drawImage(
            urlReferenceImageRef.current, 
            0, 
            0, 
            width, 
            height
          );
          
          // 添加第三次绘制，专注于轮廓
          ctx.globalAlpha = 0.5;
          ctx.filter = 'invert(1) brightness(5) contrast(5) saturate(0)';
          ctx.drawImage(
            urlReferenceImageRef.current, 
            0, 
            0, 
            width, 
            height
          );
        } else {
          // 浅色模式正常绘制
          ctx.drawImage(
            urlReferenceImageRef.current, 
            0, 
            0, 
            width, 
            height
          );
        }
        
        ctx.restore();
      }
    }

    // 获取当前实际的绘图颜色
    const drawingColor = getCurrentDrawingColor();
    
    // 绘制所有已保存的线条
    lines.forEach(line => {
      if (line.points.length < 2) return;
      
      ctx.beginPath();
      ctx.moveTo(line.points[0].x, line.points[0].y);
      
      for (let i = 1; i < line.points.length; i++) {
        ctx.lineTo(line.points[i].x, line.points[i].y);
      }
      
      ctx.strokeStyle = drawingColor;
      ctx.lineWidth = line.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
    
    // 绘制当前正在绘制的线条
    if (currentLine && currentLine.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(currentLine.points[0].x, currentLine.points[0].y);
      
      for (let i = 1; i < currentLine.points.length; i++) {
        ctx.lineTo(currentLine.points[i].x, currentLine.points[i].y);
      }
      
      ctx.strokeStyle = drawingColor;
      ctx.lineWidth = currentLine.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }, [width, height, lines, currentLine, isReady, showReference, isDark, urlReferenceLoaded, referenceLoaded, getCurrentDrawingColor]);

  // 当任何相关状态改变时重新绘制
  useEffect(() => {
    if (isReady) {
      draw();
    }
  }, [draw, isReady]);

  return (
    <div 
      ref={containerRef} 
      className="relative overflow-hidden border border-neutral-200 dark:border-neutral-700 rounded-lg"
      style={{ touchAction: 'none' }} // 防止触摸手势引起的页面滚动
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
});

// 为组件添加displayName，有助于调试
DrawingCanvas.displayName = "DrawingCanvas";

export default DrawingCanvas; 