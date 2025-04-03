'use client'

import React, { useState, useEffect, useRef } from 'react';
import DrawingCanvas, { DrawingCanvasRef } from './DrawingCanvas';
import hapticsUtils from '@/lib/haptics';
import { motion } from 'framer-motion';

interface DrawingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (svgString: string) => void;
  defaultSvg?: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size: 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}

// 简单的Modal组件实现
const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  className = ''
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div 
        className={`bg-white dark:bg-neutral-900 rounded-lg shadow-xl overflow-hidden w-full mx-4 ${
          size === 'lg' ? 'max-w-2xl' : 'max-w-md'
        } ${className}`}
      >
        <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 flex justify-between items-center">
          <h3 className="font-medium">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div>
          {children}
        </div>
      </div>
    </div>
  );
};

// 简单的Button组件实现
const Button: React.FC<{
  children: React.ReactNode;
  variant: 'primary' | 'secondary';
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}> = ({ 
  children, 
  variant, 
  onClick, 
  className = '',
  disabled = false
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-md font-medium transition-colors ${
        variant === 'primary' 
          ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300' 
          : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 disabled:opacity-50'
      } ${className}`}
    >
      {children}
    </button>
  );
};

const DrawingModal: React.FC<DrawingModalProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultSvg,
}) => {
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<DrawingCanvasRef>(null);
  const [currentSvg, setCurrentSvg] = useState<string>('');
  
  // 当模态框打开后，重置状态
  useEffect(() => {
    if (isOpen) {
      // 如果有默认SVG，则认为已经有绘图
      setHasDrawn(!!defaultSvg);
      setCurrentSvg(defaultSvg || '');
      
      return () => {
        setHasDrawn(false);
        setCurrentSvg('');
      };
    }
  }, [isOpen, defaultSvg]);
  
  const handleDrawingComplete = (svgString: string) => {
    // 标记已绘制
    setHasDrawn(true);
    // 保存当前的SVG数据
    setCurrentSvg(svgString);
    console.log('绘图完成，得到SVG数据:', svgString.length, '字符');
  };
  
  const handleSave = () => {
    hapticsUtils.medium();
    
    let svgToSave = currentSvg;
    
    // 如果当前没有SVG数据但有绘图，尝试从画布直接获取
    if (canvasRef.current) {
      try {
        // 始终尝试获取最新的SVG数据
        svgToSave = canvasRef.current.save();
        console.log('从画布API直接获取SVG:', svgToSave.length, '字符');
      } catch (error) {
        console.error('无法从画布获取SVG:', error);
        
        // 如果直接获取失败，使用已缓存的SVG数据
        if (currentSvg && currentSvg.trim() !== '') {
          svgToSave = currentSvg;
          console.log('使用已缓存的SVG数据:', svgToSave.length, '字符');
        }
      }
    }
    
    // 如果仍然没有SVG数据，但有默认SVG，使用默认SVG
    if ((!svgToSave || svgToSave.trim() === '') && defaultSvg) {
      svgToSave = defaultSvg;
      console.log('使用默认SVG:', svgToSave.length, '字符');
    }
    
    // 如果有SVG数据，保存并关闭模态框
    if (svgToSave && svgToSave.trim() !== '') {
      console.log('保存SVG数据，长度:', svgToSave.length);
      onSave(svgToSave);
      onClose();
    } else {
      console.error('没有找到可保存的SVG数据');
      alert('保存失败，请重新绘制');
    }
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="绘制自定义杯型"
      size="lg"
      className="bg-white dark:bg-neutral-900"
    >
      <div className="p-4 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-4 text-center"
        >
          <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
            绘制您的自定义咖啡杯形状。您可以参考底部的V60模型作为绘图参考。
          </p>
          
          <div className="w-full max-w-sm mx-auto bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl">
            {isOpen && (
              <DrawingCanvas
                ref={canvasRef}
                width={300}
                height={300}
                defaultSvg={defaultSvg}
                onDrawingComplete={handleDrawingComplete}
                referenceSvgUrl="/images/v60-base.svg"
              />
            )}
          </div>
          
          <div className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            <ul className="list-disc list-inside space-y-1">
              <li>用指尖或鼠标绘制杯子轮廓</li>
              <li>使用底部的 + 和 - 调整线条粗细</li>
              <li>点击撤销按钮移除最后一条线</li>
              <li>点击清除按钮重新开始</li>
            </ul>
          </div>
        </motion.div>
        
        <div className="flex justify-between w-full mt-4">
          <Button 
            variant="secondary" 
            onClick={onClose}
            className="w-1/2 mr-2"
          >
            取消
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave}
            className="w-1/2 ml-2"
            disabled={!hasDrawn && !defaultSvg}
          >
            保存杯型
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DrawingModal; 