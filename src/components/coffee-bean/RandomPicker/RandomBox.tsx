'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Coffee } from 'lucide-react';

interface RandomBoxProps {
  state: 'idle' | 'shaking' | 'opening' | 'revealed';
  onClick: () => void;
}

const RandomBox: React.FC<RandomBoxProps> = ({ state, onClick }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16" onClick={onClick}>
      <div className="relative cursor-pointer">
        {/* Glow Effect Background */}
        <motion.div
           className="absolute inset-0 rounded-full bg-amber-400/30 blur-2xl"
           animate={{
             scale: state === 'shaking' ? [1, 1.5, 1] : [0.8, 1, 0.8],
             opacity: state === 'shaking' ? 0.6 : 0.3,
           }}
           transition={{
             repeat: Infinity,
             duration: state === 'shaking' ? 0.5 : 3,
           }}
        />

        {/* Main Box/Icon Container */}
        <motion.div
          className="relative z-10 flex h-40 w-40 items-center justify-center rounded-3xl bg-neutral-900 shadow-2xl ring-4 ring-neutral-800 dark:bg-neutral-800 dark:ring-neutral-700"
          initial="idle"
          animate={state}
          variants={{
            idle: { 
              y: [0, -10, 0],
              rotate: [0, 2, -2, 0],
              scale: 1,
              transition: { 
                y: { repeat: Infinity, duration: 4, ease: "easeInOut" },
                rotate: { repeat: Infinity, duration: 5, ease: "easeInOut" }
              }
            },
            shaking: {
              x: [-2, 2, -2, 2, 0],
              y: [0, -5, 0],
              rotate: [-5, 5, -5, 5, 0],
              scale: [1, 1.05, 1],
              transition: { repeat: Infinity, duration: 0.3 }
            },
            opening: { scale: 1.1, opacity: 0, transition: { duration: 0.3 } },
            revealed: { scale: 0, opacity: 0 },
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Coffee className="h-20 w-20 text-amber-100" strokeWidth={1.5} />
          
          {/* Question Mark Decoration */}
          <motion.div 
            className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 font-bold text-white shadow-lg"
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ repeat: Infinity, duration: 4, delay: 1 }}
          >
            ?
          </motion.div>

          {/* Sparkles around */}
          {state === 'shaking' && (
            <>
              <motion.div className="absolute -left-4 top-0" animate={{ y: -20, opacity: 0 }} transition={{ repeat: Infinity, duration: 1 }}>
                <Sparkles className="h-6 w-6 text-amber-400" />
              </motion.div>
              <motion.div className="absolute -right-4 bottom-0" animate={{ y: -20, opacity: 0 }} transition={{ repeat: Infinity, duration: 1, delay: 0.5 }}>
                <Sparkles className="h-5 w-5 text-amber-300" />
              </motion.div>
            </>
          )}
        </motion.div>
      </div>

      <motion.div
        className="mt-8 flex flex-col items-center gap-2"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <span className="text-lg font-medium text-neutral-800 dark:text-neutral-200">
          {state === 'shaking' ? 'AI 正在品鉴...' : '开启今日咖啡运势'}
        </span>
        <span className="text-xs text-neutral-400">
          {state === 'shaking' ? '分析您的口味偏好中' : '点击抽取专属推荐'}
        </span>
      </motion.div>
    </div>
  );
};

export default RandomBox;
