'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'

interface ImageBoundaryEditorProps {
    image: string;
    onSave: (processedImage: string) => void;
    onCancel: () => void;
}

const ImageBoundaryEditor: React.FC<ImageBoundaryEditorProps> = ({ 
    image, 
    onSave, 
    onCancel 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef<HTMLCanvasElement>(null);
    const previewRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [path, setPath] = useState<Array<{x: number, y: number}>>([]);
    const [imageSize, setImageSize] = useState<{width: number, height: number}>({width: 0, height: 0});
    const [drawingContext, setDrawingContext] = useState<CanvasRenderingContext2D | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    
    // 初始化画布
    useEffect(() => {
        const img = document.createElement('img');
        img.onload = () => {
            if (canvasRef.current && drawingRef.current) {
                const canvas = canvasRef.current;
                const drawCanvas = drawingRef.current;
                
                // 设置更合理的画布尺寸 - 减小最大尺寸限制
                const maxWidth = 320; // 进一步减小尺寸
                const maxHeight = 320; // 进一步减小尺寸
                let width = img.width;
                let height = img.height;
                
                // 计算保持纵横比的尺寸
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = width * ratio;
                height = height * ratio;
                
                canvas.width = width;
                canvas.height = height;
                drawCanvas.width = width;
                drawCanvas.height = height;
                setImageSize({width, height});
                
                // 绘制原始图片
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // 绘制图片边框，让用户知道图片边界
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(0, 0, width, height);
                    
                    // 添加边框阴影效果
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                    ctx.shadowBlur = 5;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                    ctx.strokeRect(0, 0, width, height);
                    
                    // 重置阴影设置
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                }
                
                // 初始化绘图画布
                const drawCtx = drawCanvas.getContext('2d');
                if (drawCtx) {
                    drawCtx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                    drawCtx.lineWidth = 2;
                    drawCtx.lineCap = 'round';
                    drawCtx.lineJoin = 'round';
                    setDrawingContext(drawCtx);
                }
                
                setImageLoaded(true);
            }
        };
        img.src = image;
    }, [image]);
    
    // 绘制路径
    const drawPath = useCallback(() => {
        if (!drawingContext || path.length === 0) return;
        
        drawingContext.clearRect(0, 0, imageSize.width, imageSize.height);
        
        // 先绘制实际的图片边界指示 - 使用实线
        drawingContext.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        drawingContext.lineWidth = 2;
        drawingContext.strokeRect(0, 0, imageSize.width, imageSize.height);
        
        // 绘制最终生成图片边界的参考区域（考虑边框和阴影） - 使用虚线
        const borderWidth = 10; // 与应用边框时相同
        const padding = borderWidth + 5; // 与应用边框时相同
        
        // 内部区域边界 - 表示实际内容区域
        drawingContext.setLineDash([4, 2]);
        drawingContext.strokeStyle = 'rgba(255, 200, 50, 0.6)';
        drawingContext.lineWidth = 1;
        drawingContext.strokeRect(
            padding, 
            padding, 
            imageSize.width - padding * 2, 
            imageSize.height - padding * 2
        );
        
        // 重置虚线设置
        drawingContext.setLineDash([]);
        
        // 绘制路径提示文字
        drawingContext.font = '10px sans-serif';
        drawingContext.fillStyle = 'rgba(255, 255, 255, 0.8)';
        drawingContext.fillText('边框和阴影区域', padding + 2, padding - 2);
        
        // 再绘制用户的路径
        drawingContext.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        drawingContext.lineWidth = 2;
        drawingContext.beginPath();
        drawingContext.moveTo(path[0].x, path[0].y);
        
        for (let i = 1; i < path.length; i++) {
            drawingContext.lineTo(path[i].x, path[i].y);
        }
        
        // 如果路径长度超过2，连接回起点形成闭合路径
        if (path.length > 2) {
            drawingContext.lineTo(path[0].x, path[0].y);
        }
        
        drawingContext.stroke();
        
        // 在路径的顶点上绘制小圆点，增强视觉反馈
        drawingContext.fillStyle = 'rgba(255, 0, 0, 0.6)';
        path.forEach(point => {
            drawingContext.beginPath();
            drawingContext.arc(point.x, point.y, 3, 0, Math.PI * 2);
            drawingContext.fill();
        });
    }, [drawingContext, path, imageSize]);
    
    // 监听路径变化时重绘
    useEffect(() => {
        drawPath();
        
        // 自动生成预览图
        if (path.length > 2 && imageLoaded) {
            updatePreview();
        } else {
            setShowPreview(false);
        }
    }, [path, drawPath, imageLoaded]);
    
    // 更新预览图
    const updatePreview = useCallback(() => {
        if (!canvasRef.current || !previewRef.current || path.length < 3) return;
        
        const previewCanvas = previewRef.current;
        const previewCtx = previewCanvas.getContext('2d');
        if (!previewCtx) return;
        
        // 清空预览画布
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        
        // 使用类似的逻辑生成预览
        const canvas = canvasRef.current;
        
        // 计算裁剪区域边界
        let minX = path[0].x;
        let minY = path[0].y;
        let maxX = path[0].x;
        let maxY = path[0].y;
        
        for (let i = 1; i < path.length; i++) {
            minX = Math.min(minX, path[i].x);
            minY = Math.min(minY, path[i].y);
            maxX = Math.max(maxX, path[i].x);
            maxY = Math.max(maxY, path[i].y);
        }
        
        // 边框宽度和边距设置
        const borderWidth = 10;
        const padding = borderWidth + 5;
        
        // 确保边界合理
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(canvas.width, maxX + padding);
        maxY = Math.min(canvas.height, maxY + padding);
        
        // 最小尺寸检查
        const minSize = Math.max(borderWidth * 4, 60);
        if (maxX - minX < minSize) {
            const center = (minX + maxX) / 2;
            minX = Math.max(0, center - minSize / 2);
            maxX = Math.min(canvas.width, center + minSize / 2);
        }
        
        if (maxY - minY < minSize) {
            const center = (minY + maxY) / 2;
            minY = Math.max(0, center - minSize / 2);
            maxY = Math.min(canvas.height, center + minSize / 2);
        }
        
        // 计算预览尺寸
        const clipWidth = maxX - minX;
        const clipHeight = maxY - minY;
        
        // 设置预览画布大小（保持合理比例）
        const maxPreviewWidth = 150; // 预览最大宽度
        const scale = Math.min(1, maxPreviewWidth / clipWidth);
        
        previewCanvas.width = clipWidth * scale;
        previewCanvas.height = clipHeight * scale;
        
        // 绘制路径
        previewCtx.save();
        
        // 缩放画布以适应预览尺寸
        previewCtx.scale(scale, scale);
        
        // 绘制裁剪路径
        previewCtx.beginPath();
        previewCtx.moveTo(path[0].x - minX, path[0].y - minY);
        for (let i = 1; i < path.length; i++) {
            previewCtx.lineTo(path[i].x - minX, path[i].y - minY);
        }
        previewCtx.closePath();
        
        // 设置阴影
        previewCtx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        previewCtx.shadowBlur = 8 * scale;
        previewCtx.shadowOffsetX = 0;
        previewCtx.shadowOffsetY = 3 * scale;
        
        // 绘制边框
        previewCtx.lineWidth = borderWidth;
        previewCtx.strokeStyle = 'white';
        previewCtx.stroke();
        
        // 移除阴影用于裁剪
        previewCtx.shadowColor = 'transparent';
        previewCtx.shadowBlur = 0;
        previewCtx.shadowOffsetX = 0;
        previewCtx.shadowOffsetY = 0;
        
        // 重新裁剪
        previewCtx.beginPath();
        previewCtx.moveTo(path[0].x - minX, path[0].y - minY);
        for (let i = 1; i < path.length; i++) {
            previewCtx.lineTo(path[i].x - minX, path[i].y - minY);
        }
        previewCtx.closePath();
        previewCtx.clip();
        
        // 绘制原始图像
        previewCtx.drawImage(
            canvas,
            minX, minY, clipWidth, clipHeight,
            0, 0, clipWidth, clipHeight
        );
        
        previewCtx.restore();
        
        // 显示预览
        setShowPreview(true);
    }, [path, imageLoaded]);
    
    // 确保点位于图片边界内
    const constrainPointToImage = (x: number, y: number) => {
        return {
            x: Math.max(0, Math.min(imageSize.width, x)),
            y: Math.max(0, Math.min(imageSize.height, y))
        };
    };
    
    // 处理鼠标/触摸事件
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!drawingRef.current || !imageLoaded) return;
        
        const rect = drawingRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 确保点在图片边界内
        const point = constrainPointToImage(x, y);
        
        setIsDrawing(true);
        setPath([point]);
        
        drawingRef.current.setPointerCapture(e.pointerId);
        
        // 阻止默认行为，防止可能的滚动或其他干扰
        e.preventDefault();
    };
    
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawing || !drawingRef.current || !imageLoaded) return;
        
        const rect = drawingRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 确保点在图片边界内
        const point = constrainPointToImage(x, y);
        
        setPath(prev => [...prev, point]);
        
        // 阻止默认行为
        e.preventDefault();
    };
    
    const handlePointerUp = (e: React.PointerEvent) => {
        if (drawingRef.current) {
            drawingRef.current.releasePointerCapture(e.pointerId);
        }
        setIsDrawing(false);
        
        // 闭合路径 - 如果有足够的点，添加起点作为终点
        if (path.length > 2) {
            setPath(prev => [...prev, prev[0]]);
        }
        
        // 阻止默认行为
        e.preventDefault();
    };
    
    // 应用边界处理
    const applyBoundary = () => {
        if (!canvasRef.current || path.length < 3) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // 计算裁剪区域的边界 - 找出路径的最小和最大x、y坐标
        let minX = path[0].x;
        let minY = path[0].y;
        let maxX = path[0].x;
        let maxY = path[0].y;
        
        for (let i = 1; i < path.length; i++) {
            minX = Math.min(minX, path[i].x);
            minY = Math.min(minY, path[i].y);
            maxX = Math.max(maxX, path[i].x);
            maxY = Math.max(maxY, path[i].y);
        }
        
        // 边框宽度和边距设置
        const borderWidth = 10;
        const padding = borderWidth + 5; // 额外边距，用于阴影
        
        // 确保有足够空间添加边框和阴影
        // 如果用户绘制的边界太靠近图片边缘，自动扩展区域
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(canvas.width, maxX + padding);
        maxY = Math.min(canvas.height, maxY + padding);
        
        // 计算最小合理尺寸，确保结果图片不会太小
        const minSize = Math.max(borderWidth * 4, 60); // 至少60px或边框宽度的4倍
        
        // 确保裁剪区域至少有最小尺寸
        if (maxX - minX < minSize) {
            const center = (minX + maxX) / 2;
            minX = Math.max(0, center - minSize / 2);
            maxX = Math.min(canvas.width, center + minSize / 2);
        }
        
        if (maxY - minY < minSize) {
            const center = (minY + maxY) / 2;
            minY = Math.max(0, center - minSize / 2);
            maxY = Math.min(canvas.height, center + minSize / 2);
        }
        
        // 计算裁剪区域的宽度和高度
        const clipWidth = maxX - minX;
        const clipHeight = maxY - minY;
        
        // 创建结果画布 - 尺寸等于裁剪区域
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = clipWidth;
        resultCanvas.height = clipHeight;
        
        const resultCtx = resultCanvas.getContext('2d');
        if (!resultCtx) return;
        
        // 绘制路径
        resultCtx.save();
        
        // 调整路径坐标，使其相对于裁剪区域
        resultCtx.beginPath();
        resultCtx.moveTo(path[0].x - minX, path[0].y - minY);
        for (let i = 1; i < path.length; i++) {
            resultCtx.lineTo(path[i].x - minX, path[i].y - minY);
        }
        resultCtx.closePath();
        
        // 优化边框和阴影效果
        // 设置阴影效果
        resultCtx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        resultCtx.shadowBlur = 8;
        resultCtx.shadowOffsetX = 0;
        resultCtx.shadowOffsetY = 3;
        
        // 绘制粗白色边框 - 使用更好看的颜色
        resultCtx.lineWidth = borderWidth;
        resultCtx.strokeStyle = 'white';
        resultCtx.stroke();
        
        // 再次绘制路径用于裁剪（没有阴影）
        resultCtx.shadowColor = 'transparent';
        resultCtx.shadowBlur = 0;
        resultCtx.shadowOffsetX = 0;
        resultCtx.shadowOffsetY = 0;
        
        // 新的裁剪路径
        resultCtx.beginPath();
        resultCtx.moveTo(path[0].x - minX, path[0].y - minY);
        for (let i = 1; i < path.length; i++) {
            resultCtx.lineTo(path[i].x - minX, path[i].y - minY);
        }
        resultCtx.closePath();
        
        // 剪切路径
        resultCtx.clip();
        
        // 绘制原始图像剪切部分
        resultCtx.drawImage(
            canvas, 
            minX, minY, clipWidth, clipHeight,  // 源图像的剪切区域
            0, 0, clipWidth, clipHeight         // 目标区域（从0,0开始）
        );
        
        resultCtx.restore();
        
        // 创建最终透明画布
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = resultCanvas.width;
        finalCanvas.height = resultCanvas.height;
        
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) return;
        
        // 默认是透明的
        finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
        
        // 复制结果画布内容到最终画布
        finalCtx.drawImage(resultCanvas, 0, 0);
        
        // 转换为PNG格式以保留透明度
        const processedImage = finalCanvas.toDataURL('image/png');
        
        onSave(processedImage);
    };
    
    // 重置绘图
    const handleReset = () => {
        setPath([]);
        if (drawingContext) {
            drawingContext.clearRect(0, 0, imageSize.width, imageSize.height);
            // 重新绘制边界指示
            drawPath();
        }
    };
    
    return (
        <div className="flex flex-col space-y-4 px-4 py-2">
            <div className="text-center">
                <h3 className="text-lg font-medium">绘制图片边界</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    围绕咖啡豆等要保留的内容画一个闭合轮廓
                </p>
                <p className="text-xs text-amber-500 mt-1">
                    提示：预留足够边距，边框和阴影会自动添加
                </p>
            </div>
            
            <div className="flex items-start">
                <div ref={containerRef} className="relative flex-1 flex justify-center overflow-hidden rounded-lg shadow-md">
                    <canvas 
                        ref={canvasRef} 
                        className="absolute top-0 left-0 right-0 mx-auto border border-neutral-200 dark:border-neutral-700"
                    />
                    <canvas 
                        ref={drawingRef} 
                        className="absolute top-0 left-0 right-0 mx-auto z-10 cursor-crosshair"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        style={{ touchAction: 'none' }}
                    />
                    {/* 占位div，设置了高度和宽度，确保内容区域不会塌陷 */}
                    <div style={{ width: imageSize.width, height: imageSize.height }} />
                </div>
                
                {/* 预览区域 */}
                {showPreview && (
                    <div className="ml-4 flex flex-col items-center border rounded-lg p-2 bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">预览效果</div>
                        <canvas 
                            ref={previewRef}
                            className="border border-neutral-300 dark:border-neutral-700 rounded"
                        />
                    </div>
                )}
            </div>
            
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                    重新绘制
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-2 text-xs border border-neutral-300 dark:border-neutral-700 rounded-lg transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                    取消
                </button>
                <button
                    type="button"
                    onClick={applyBoundary}
                    className="flex-1 py-2 text-xs bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 rounded-lg disabled:opacity-50 transition-colors hover:bg-neutral-700 dark:hover:bg-neutral-300"
                    disabled={path.length < 3}
                >
                    应用边框
                </button>
            </div>
            
            <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                {!imageLoaded ? "正在加载图片..." : 
                    path.length < 3 
                    ? "请围绕咖啡豆等内容绘制一个闭合轮廓"
                    : "准备就绪，查看预览并确认效果"}
            </div>
        </div>
    );
};

export default ImageBoundaryEditor; 