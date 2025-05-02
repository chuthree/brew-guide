import React, { useMemo } from 'react';

interface CapacityCircleProps {
  remainingPercentage: number;
  size?: number;
}

const CapacityCircle: React.FC<CapacityCircleProps> = ({ 
  remainingPercentage, 
  size = 200 
}) => {
  // 将百分比限制在0-100范围内
  const safeRemainingPercentage = useMemo(() => {
    return Math.max(0, Math.min(100, remainingPercentage));
  }, [remainingPercentage]);
  
  // 计算消耗百分比
  const consumedPercentage = 100 - safeRemainingPercentage;
  
  // 圆的属性
  const radius = size / 2 - 10; // 减去10是为了给边框和装饰留出空间
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  
  // 计算起始点（顶部中间）
  const startAngle = -Math.PI / 2; // -90度，即顶部中间
  
  // 计算消耗部分的结束角度
  const endAngle = startAngle + (2 * Math.PI * consumedPercentage / 100);
  
  // 计算虚线路径的坐标
  const startX = center + radius * Math.cos(startAngle);
  const startY = center + radius * Math.sin(startAngle);
  const endX = center + radius * Math.cos(endAngle);
  const endY = center + radius * Math.sin(endAngle);
  
  // 确定是大弧还是小弧
  const largeArcFlag = consumedPercentage > 50 ? 1 : 0;
  
  // 构建虚线路径
  const dashedPath = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
  
  // 构建实线路径（剩余部分）
  const solidPath = `M ${endX} ${endY} A ${radius} ${radius} 0 ${1 - largeArcFlag} 1 ${startX} ${startY}`;
  
  return (
    <div className="flex flex-col items-center justify-center">
      <svg 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`}
        className="relative"
        style={{
          animation: 'rotateIn 1.2s ease-out forwards',
        }}
      >
        {/* 实线部分（剩余容量） */}
        <path
          d={solidPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-neutral-800 dark:text-neutral-200"
          style={{
            animation: 'drawPath 1.5s ease-in-out forwards',
            strokeDasharray: circumference * (safeRemainingPercentage / 100),
            strokeDashoffset: circumference * (safeRemainingPercentage / 100),
          }}
        />
        
        {/* 虚线部分（已消耗） */}
        <path
          d={dashedPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3,3"
          className="text-neutral-500 dark:text-neutral-500"
          style={{
            animation: 'drawPath 1.5s ease-in-out forwards',
            strokeDasharray: `3,3`,
            opacity: 0.7,
          }}
        />
      </svg>
      
      <div 
        className="text-[10px] mt-2 text-neutral-500 dark:text-neutral-400 tracking-wider"
        style={{
          animation: 'fadeIn 1.2s ease-out forwards',
        }}
      >
        容量剩余 {safeRemainingPercentage.toFixed(0)}%
      </div>
      
      {/* 添加CSS动画 */}
      <style jsx>{`
        @keyframes rotateIn {
          from {
            transform: rotate(-90deg) scale(0.8);
            opacity: 0;
          }
          to {
            transform: rotate(0deg) scale(1);
            opacity: 1;
          }
        }
        
        @keyframes drawPath {
          from {
            stroke-dashoffset: ${circumference};
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default CapacityCircle; 