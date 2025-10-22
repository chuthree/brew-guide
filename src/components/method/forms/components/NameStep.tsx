import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface NameStepProps {
  name: string;
  onChange: (name: string) => void;
  isEdit: boolean;
}

// 添加动画变体
const pageVariants = {
  initial: {
    opacity: 0,
  },
  in: {
    opacity: 1,
  },
  out: {
    opacity: 0,
  },
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.26,
};

const NameStep: React.FC<NameStepProps> = ({ name, onChange, isEdit }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <motion.div
      key="name-step"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="flex flex-col items-center pt-10 pb-20"
    >
      <div className="max-w-sm space-y-8 text-center">
        <h2 className="text-xl font-medium text-neutral-800 dark:text-neutral-200">
          {isEdit ? '编辑你的冲煮方案名称' : '给你的冲煮方案起个名字'}
        </h2>
        <div className="relative flex justify-center">
          <div className="relative inline-block">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => onChange(e.target.value)}
              placeholder="叫做..."
              autoFocus={true}
              className={`bg-transparent py-2 text-center text-lg outline-hidden focus:border-neutral-800 dark:focus:border-neutral-400`}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default NameStep;
