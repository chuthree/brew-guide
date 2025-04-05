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
  customReferenceSvg?: string;
}

// 定义暴露给父组件的API接口
export interface DrawingCanvasRef {
  clear: () => void;
  undo: () => void;
  save: () => string;
  setStrokeWidth: React.Dispatch<React.SetStateAction<number>>;
  setColor: React.Dispatch<React.SetStateAction<string>>;
}

// 添加主题检测辅助函数
function isDarkMode(): boolean {
  // 检查是否支持document（仅在客户端执行）
  if (typeof document === 'undefined') return false;
  
  // 首先检查HTML元素是否有dark类
  const isDarkClass = document.documentElement.classList.contains('dark');
  
  // 如果没有dark类，检查系统偏好
  if (!isDarkClass && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  return isDarkClass;
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
  customReferenceSvg,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<Line[]>([]);
  
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

  // 加载URL参考图像（杯型等）
  useEffect(() => {
    if (!referenceSvgUrl) {
      setUrlReferenceLoaded(false);
      urlReferenceImageRef.current = null;
      return;
    }
    
    const img = new Image();
    img.src = referenceSvgUrl;
    img.onload = () => {
      urlReferenceImageRef.current = img;
      setUrlReferenceLoaded(true);
    };
    
    return () => {
      img.onload = null;
    };
  }, [referenceSvgUrl]);

  // 加载SVG字符串作为参考图像（前帧）
  useEffect(() => {
    // 清理上一个引用
    setReferenceLoaded(false);
    referenceImageRef.current = null;

    // 使用referenceSvg（直接的SVG字符串）
    if (referenceSvg && referenceSvg.trim() !== '') {
      // 处理SVG颜色 - 在深色模式下将黑色线条转换为白色
      let processedSvg = referenceSvg;
      if (isDark) {
        // 简单替换黑色为白色（对于var(--custom-shape-color)和#000000两种情况）
        processedSvg = processedSvg
          .replace(/stroke="var\(--custom-shape-color\)"/g, 'stroke="#FFFFFF"')
          .replace(/stroke="#000000"/g, 'stroke="#FFFFFF"')
          .replace(/stroke="black"/g, 'stroke="#FFFFFF"');
      }
      
      const svgBlob = new Blob([processedSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);
      
      const img = new Image();
      img.src = url;
      img.onload = () => {
        referenceImageRef.current = img;
        setReferenceLoaded(true);
        URL.revokeObjectURL(url); // 释放URL对象
      };
      
      return () => {
        img.onload = null;
        URL.revokeObjectURL(url);
      };
    }
  }, [referenceSvg, isDark]);

  // 加载自定义杯型SVG作为参考图像
  useEffect(() => {
    if (!customReferenceSvg) return;
    
    // 处理SVG颜色 - 在深色模式下将黑色线条转换为白色
    let processedSvg = customReferenceSvg;
    if (isDark) {
      processedSvg = processedSvg
        .replace(/stroke="var\(--custom-shape-color\)"/g, 'stroke="#FFFFFF"')
        .replace(/stroke="#000000"/g, 'stroke="#FFFFFF"')
        .replace(/stroke="black"/g, 'stroke="#FFFFFF"');
    }
    
    const svgBlob = new Blob([processedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.src = url;
    img.onload = () => {
      urlReferenceImageRef.current = img;
      setUrlReferenceLoaded(true);
      URL.revokeObjectURL(url);
    };
    
    return () => {
      img.onload = null;
    };
  }, [customReferenceSvg, isDark]);

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

  // 获取绘图当前颜色 - 根据主题模式调整
  const getCurrentDrawingColor = useCallback(() => {
    // 如果提供了strokeColor，则使用它
    if (strokeColor) {
      return strokeColor;
    }
    // 否则，在深色模式下使用白色，浅色模式下使用黑色
    return isDark ? '#ffffff' : '#000000';
  }, [isDark, strokeColor]);

  // 重绘画布
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    
    if (!context || !canvas) return;
    
    // 清空画布
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制URL参考图像（杯型等）
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
    
    // 绘制SVG参考图像（前帧）
    if (referenceLoaded && referenceImageRef.current) {
      context.save();
      
      // 设置透明度 - 前帧底图在深色模式下使用更高的不透明度以增强可见性
      context.globalAlpha = isDark ? 0.6 : 0.4;
      
      // 不需要反转色彩，我们已经在加载SVG时处理过了
      // 但在深色模式下可以增加一些滤镜提高可见性
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
    
    // 获取当前绘图颜色
    const drawingColor = getCurrentDrawingColor();
    
    // 绘制所有已保存的线条
    lines.forEach(line => {
      if (line.points.length < 2) return;
      
      context.beginPath();
      context.moveTo(line.points[0].x, line.points[0].y);
      
      for (let i = 1; i < line.points.length; i++) {
        context.lineTo(line.points[i].x, line.points[i].y);
      }
      
      // 在深色模式下对黑色线条使用白色
      const lineColor = 
        (isDark && (line.color === '#000000' || line.color === 'black')) 
          ? drawingColor 
          : line.color;
      
      context.strokeStyle = lineColor;
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
      
      // 在深色模式下对黑色线条使用白色
      const lineColor = 
        (isDark && (currentLine.color === '#000000' || currentLine.color === 'black')) 
          ? drawingColor 
          : currentLine.color;
      
      context.strokeStyle = lineColor;
      context.lineWidth = currentLine.strokeWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
    }
    
    // 在画布未就绪时，绘制提示
    if (!isReady) {
      // 在深色模式下使用白色文本
      context.fillStyle = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '14px sans-serif';
      context.fillText('加载中...', canvas.width / 2, canvas.height / 2);
    }
  }, [lines, currentLine, referenceLoaded, urlReferenceLoaded, isReady, isDark, getCurrentDrawingColor]);

  // 每次状态更新时重绘画布
  useEffect(() => {
    redrawCanvas();
  }, [lines, currentLine, redrawCanvas, isReady, referenceLoaded, urlReferenceLoaded, isDark]);

  // 更新linesRef当lines状态改变时
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  // 保存绘图为SVG并通知父组件
  const saveDrawing = useCallback(() => {
    // 使用linesRef.current以确保获取最新的lines
    const svgString = linesToSvgPath(linesRef.current, width, height);
    console.log("保存SVG绘图数据:", svgString.length, "字符");
    if (onDrawingComplete) {
      onDrawingComplete(svgString);
    }
    return svgString;
  }, [width, height, onDrawingComplete]);

  // 处理触摸/鼠标开始事件 - 直接处理相对于画布的坐标
  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current || !isReady) return;
    
    hapticsUtils.light();
    
    // 计算相对于画布左上角的坐标
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // 确保坐标在画布范围内
    if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) return;
    
    // 固定使用黑色作为存储颜色（在保存SVG时会用到），但在深色模式下显示为白色
    const drawColor = '#000000';
    
    setIsDrawing(true);
    setCurrentLine({
      points: [{ x, y }],
      strokeWidth,
      color: drawColor
    });
  }, [strokeWidth, isReady]);

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

  // 触摸事件处理 - 优化版本
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // 避免使用preventDefault，以免阻止其他正常交互
    if (e.touches.length !== 1) return; // 只处理单点触摸
    
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
    
    // 防止触摸事件传播导致页面滚动
    e.stopPropagation();
  }, [handleStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDrawing) return;
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
    
    // 防止触摸移动引起页面滚动
    e.stopPropagation();
    e.preventDefault(); // 只在移动时阻止默认行为，防止页面滚动
  }, [isDrawing, handleMove]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    if (!isDrawing) return;
    handleEnd();
  }, [isDrawing, handleEnd]);

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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 如果启用了底图显示，则绘制参考图像
    if (showReference) {
      // 优先使用自定义杯型SVG
      if (customReferenceSvg && urlReferenceImageRef.current) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.drawImage(
          urlReferenceImageRef.current,
          0,
          0,
          canvas.width,
          canvas.height
        );
        ctx.restore();
      }
      // 如果没有自定义杯型，则使用默认参考图像
      else if (urlReferenceLoaded && urlReferenceImageRef.current) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.drawImage(
          urlReferenceImageRef.current,
          0,
          0,
          canvas.width,
          canvas.height
        );
        ctx.restore();
      }

      // 绘制SVG参考图像（如果有）
      if (referenceLoaded && referenceImageRef.current) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.drawImage(
          referenceImageRef.current,
          0,
          0,
          canvas.width,
          canvas.height
        );
        ctx.restore();
      }
    }

    // 绘制所有已完成的线条
    lines.forEach(line => {
      if (line.points.length < 2) return;
      
      ctx.beginPath();
      ctx.strokeStyle = isDark ? '#FFFFFF' : line.color;
      ctx.lineWidth = line.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const [first, ...rest] = line.points;
      ctx.moveTo(first.x, first.y);
      
      rest.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      
      ctx.stroke();
    });
    
    // 绘制当前正在绘制的线条
    if (currentLine?.points.length) {
      ctx.beginPath();
      ctx.strokeStyle = isDark ? '#FFFFFF' : currentLine.color;
      ctx.lineWidth = currentLine.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const [first, ...rest] = currentLine.points;
      ctx.moveTo(first.x, first.y);
      
      rest.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      
      ctx.stroke();
    }
  }, [lines, currentLine, isDark, urlReferenceLoaded, referenceLoaded, showReference, customReferenceSvg]);

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
        className=" bg-white dark:bg-neutral-900"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ touchAction: 'none' }} // 防止触摸手势引起的页面滚动
      />
    </div>
  );
});

// 为组件添加displayName，有助于调试
DrawingCanvas.displayName = "DrawingCanvas";

export default DrawingCanvas; 