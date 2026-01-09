import React, { useState, useMemo } from 'react';
import { CoffeeBean } from '@/types/app';
import { getDailyRecommendation, RecommendationResponse } from '@/lib/api/recommendation';
import RandomBox from './RandomBox';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Quote, Calendar, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { db } from '@/lib/core/db';
import { getRandomCoffeeBeanSettings, RandomCoffeeBeanSelector } from '@/lib/utils/randomCoffeeBeanUtils';

interface DailyRecommendationProps {
  beans: CoffeeBean[];
  onSelect: (bean: CoffeeBean) => void;
}

const DailyRecommendation: React.FC<DailyRecommendationProps> = ({ beans, onSelect }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [recommendedBean, setRecommendedBean] = useState<CoffeeBean | null>(null);
  const [excludedBeanIds, setExcludedBeanIds] = useState<string[]>([]);

  const handleDraw = async () => {
    if (status === 'loading') return;
    setStatus('loading');

    try {
      // 1. Fetch recent history (Last 10 brewing notes)
      const recentNotes = await db.brewingNotes
        .orderBy('timestamp')
        .reverse()
        .limit(10)
        .toArray();

      const history = recentNotes.map(note => ({
        beanName: note.coffeeBeanInfo?.name || '未知咖啡豆',
        method: note.method,
        rating: note.rating,
        notes: note.notes,
        // Include usage diff/roasting diff if meaningful? 
        // User mentioned changeRecord, so let's check
        changeType: note.changeRecord?.capacityAdjustment?.changeType,
      }));
      
      // 2. Filter valid beans using the same logic as Random Picker
      const settings = getRandomCoffeeBeanSettings();
      const selector = new RandomCoffeeBeanSelector(settings);
      
      // Filter available beans (checks remaining amount, flavor period settings, etc.)
      let validBeans = selector.filterAvailableBeans(beans);

      // Filter out excluded beans (from previous redraws)
      let availableCandidates = validBeans.filter(b => !excludedBeanIds.includes(b.id));

      // If all beans have been excluded (cycled through everything), reset exclusion list
      if (availableCandidates.length === 0 && validBeans.length > 0) {
        setExcludedBeanIds([]);
        availableCandidates = validBeans;
      }

      if (availableCandidates.length === 0) {
        console.warn("No valid beans available for recommendation");
        setStatus('error');
        return;
      }
      
      // Simplify inventory for AI to save tokens
      const inventory = availableCandidates.map(b => ({
        id: b.id,
        name: b.name,
        roaster: b.roaster,
        process: b.blendComponents?.[0]?.process, // Extract process from blendComponents
        roastLevel: b.roastLevel,
        flavors: b.flavor, // Map flavor to flavors for AI context
        remaining: b.remaining || b.capacity || '未知', // Include remaining/capacity
      }));

      const res = await getDailyRecommendation(history, inventory);
      setRecommendation(res);

      const bean = beans.find(b => b.id === res.beanId);
      if (bean) {
        setRecommendedBean(bean);
        setStatus('success');
      } else {
         // Fallback if AI recommends a bean ID that doesn't exist (unlikely but possible)
         console.warn("Recommended bean not found in inventory");
         setStatus('error');
      }
      
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };
  
  const handleRedraw = () => {
    if (recommendedBean) {
        setExcludedBeanIds(prev => [...prev, recommendedBean.id]);
    }
    setStatus('idle');
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {status === 'success' && recommendedBean && recommendation ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col gap-5 px-1"
          >
            {/* Top Section: Lucky Message & Date */}
            <div className="relative overflow-hidden rounded-2xl bg-amber-50 p-6 dark:bg-amber-900/20">
               {/* Date Badge - Absolute Top Right */}
               <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-white/50 px-3 py-1 text-xs font-medium text-amber-800 backdrop-blur-sm dark:bg-black/20 dark:text-amber-200">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                  </span>
               </div>
               
               <Sparkles className="absolute -left-2 -top-2 h-12 w-12 text-amber-500/10 dark:text-amber-500/20" />
               <Sparkles className="absolute -bottom-4 -right-2 h-16 w-16 text-amber-500/10 dark:text-amber-500/20" />
               
               <div className="mt-4 text-center">
                 <p className="text-xl font-medium leading-relaxed text-amber-900 dark:text-amber-100 font-serif italic">
                   "{recommendation.luckyMessage || '今日宜喝咖啡，享受当下...'}"
                 </p>
               </div>
            </div>

            {/* Bean Card */}
            <div 
              onClick={() => onSelect(recommendedBean)}
              className="cursor-pointer overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-xl shadow-neutral-200/50 transition-all active:scale-95 dark:border-neutral-800 dark:bg-neutral-800 dark:shadow-none"
            >
              <div className="flex gap-4 p-5">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-neutral-100 shadow-inner dark:bg-neutral-700">
                  {recommendedBean.image ? (
                    <Image
                      src={recommendedBean.image}
                      alt={recommendedBean.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">☕</div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                   <h3 className="line-clamp-2 text-lg font-bold leading-tight text-neutral-900 dark:text-white">
                     {recommendedBean.name}
                   </h3>
                   
                   <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                     <span className="font-medium text-neutral-700 dark:text-neutral-300">
                       {recommendedBean.roaster || '自烘焙'}
                     </span>
                     {recommendedBean.blendComponents?.[0]?.process && (
                       <>
                         <span className="text-neutral-300 dark:text-neutral-600">|</span>
                         <span className="shrink-0">{recommendedBean.blendComponents[0].process}</span>
                       </>
                     )}
                     {/* Remaining Stock Badge */}
                     {(recommendedBean.remaining || recommendedBean.capacity) && (
                       <>
                         <span className="text-neutral-300 dark:text-neutral-600">|</span>
                         <span className={`shrink-0 font-medium ${
                           parseFloat(recommendedBean.remaining || recommendedBean.capacity || '0') < 50 
                             ? 'text-red-500 dark:text-red-400' 
                             : 'text-amber-600 dark:text-amber-400'
                         }`}>
                           剩余 {recommendedBean.remaining || recommendedBean.capacity} 克
                         </span>
                       </>
                     )}
                   </div>

                   {recommendedBean.flavor && recommendedBean.flavor.length > 0 && (
                     <div className="flex flex-wrap gap-1.5">
                       {recommendedBean.flavor.slice(0, 3).map((f, i) => (
                         <span key={i} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                           {f}
                         </span>
                       ))}
                     </div>
                   )}
                   
                   <div className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                     去冲煮 <ArrowRight className="h-3 w-3" />
                   </div>
                </div>
              </div>
            </div>

            {/* Recommendation Reason & Theme */}
            <div className="relative rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-800/50">
              <Quote className="absolute left-4 top-4 h-6 w-6 text-neutral-200 dark:text-neutral-700" />
              <div className="relative z-10 space-y-2 pl-8">
                {recommendation.theme && (
                   <h4 className="text-lg font-bold text-amber-900 dark:text-amber-100">
                     {recommendation.theme}
                   </h4>
                )}
                <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                  {recommendation.reason}
                </p>
              </div>
            </div>
            
            <button 
              onClick={handleRedraw}
              className="mt-2 w-full rounded-full py-3 text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            >
              重新抽取
            </button>
          </motion.div>
        ) : (
          <RandomBox 
            state={status === 'loading' ? 'shaking' : 'idle'} 
            onClick={handleDraw} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DailyRecommendation;
