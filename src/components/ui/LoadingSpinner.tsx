'use client';

import React from 'react';

interface LoadingSpinnerProps {
  className?: string;
  lines?: number;
}

/**
 * 经典的加载动画组件
 * 由多条线组成，线条依次淡入淡出产生旋转效果
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  className = '',
  lines = 8,
}) => {
  return (
    <div className={`relative ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 h-[30%] w-[8%] origin-[center_170%] rounded-full bg-current"
          style={{
            transform: `translateX(-50%) translateY(-170%) rotate(${i * (360 / lines)}deg)`,
            opacity: 1 - (i / lines) * 0.75,
            animation: `loading-spinner ${lines * 0.1}s linear infinite`,
            animationDelay: `${-i * 0.1}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes loading-spinner {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0.25;
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
