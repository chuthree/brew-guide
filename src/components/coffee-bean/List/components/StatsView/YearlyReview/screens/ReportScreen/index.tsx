'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ScreenProps } from '../../types';
import type { YearlyReportStats } from '@/lib/api/yearlyReport';
import { generateYearlyReportStream } from '@/lib/api/yearlyReport';
import { Storage } from '@/lib/core/storage';
import {
  useYearlyReportStore,
  type YearlyReport,
} from '@/lib/stores/yearlyReportStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { extractRoasterFromName } from '@/lib/utils/beanVarietyUtils';

// 每日生成次数限制
const DAILY_LIMIT = 5;
const USAGE_STORAGE_KEY = 'yearlyReportDailyUsage';

interface DailyUsage {
  date: string; // YYYY-MM-DD
  count: number;
}

// 获取今日日期字符串
const getTodayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// 获取今日已使用次数
const getDailyUsage = async (): Promise<number> => {
  try {
    const data = await Storage.get(USAGE_STORAGE_KEY);
    if (!data) return 0;
    const usage: DailyUsage = JSON.parse(data);
    if (usage.date !== getTodayString()) return 0;
    return usage.count;
  } catch {
    return 0;
  }
};

// 增加今日使用次数
const incrementDailyUsage = async (): Promise<number> => {
  const today = getTodayString();
  let count = 1;
  try {
    const data = await Storage.get(USAGE_STORAGE_KEY);
    if (data) {
      const usage: DailyUsage = JSON.parse(data);
      if (usage.date === today) {
        count = usage.count + 1;
      }
    }
    await Storage.set(
      USAGE_STORAGE_KEY,
      JSON.stringify({ date: today, count })
    );
  } catch {
    // ignore
  }
  return count;
};

interface ReportScreenProps extends ScreenProps {
  beans: CoffeeBean[];
  notes: BrewingNote[];
  onReplay?: () => void;
}

/**
 * 年度报告屏幕 - 简洁纯文本风格，支持流式显示
 */
const ReportScreen: React.FC<ReportScreenProps> = ({
  beans,
  notes,
  onReplay,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const shareContentRef = useRef<HTMLDivElement>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [username, setUsername] = useState('咖啡爱好者');
  const [reportText, setReportText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 新增：已保存的报告和是否查看历史
  const [savedReport, setSavedReport] = useState<YearlyReport | null>(null);
  const [isViewingSaved, setIsViewingSaved] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  // 新增：今日已使用次数
  const [dailyUsed, setDailyUsed] = useState(0);

  // 计算统计数据
  const stats = useMemo<YearlyReportStats>(() => {
    const currentYear = new Date().getFullYear();

    // 烘焙商统计
    const roasterCount = new Map<string, number>();
    beans.forEach(bean => {
      const roaster = extractRoasterFromName(bean.name);
      if (roaster !== '未知烘焙商') {
        roasterCount.set(roaster, (roasterCount.get(roaster) || 0) + 1);
      }
    });

    // 找出最喜欢的烘焙商
    let favoriteRoaster = '未知';
    let favoriteRoasterCount = 0;
    roasterCount.forEach((count, name) => {
      if (count > favoriteRoasterCount) {
        favoriteRoaster = name;
        favoriteRoasterCount = count;
      }
    });

    // 产地、品种、处理法统计
    const originCount = new Map<string, number>();
    const varietyCount = new Map<string, number>();
    const processCount = new Map<string, number>();
    let roastLightCount = 0;
    let roastMediumCount = 0;
    let roastDarkCount = 0;

    beans.forEach(bean => {
      // 烘焙度
      if (bean.roastLevel) {
        if (bean.roastLevel.includes('浅')) roastLightCount++;
        else if (bean.roastLevel.includes('深')) roastDarkCount++;
        else roastMediumCount++;
      }

      if (bean.blendComponents && bean.blendComponents.length > 0) {
        bean.blendComponents.forEach(comp => {
          if (comp.origin) {
            originCount.set(
              comp.origin,
              (originCount.get(comp.origin) || 0) + 1
            );
          }
          if (comp.variety) {
            varietyCount.set(
              comp.variety,
              (varietyCount.get(comp.variety) || 0) + 1
            );
          }
          if (comp.process) {
            processCount.set(
              comp.process,
              (processCount.get(comp.process) || 0) + 1
            );
          }
        });
      }
    });

    // 获取 Top 3
    const getTopItems = (map: Map<string, number>, count: number = 3) => {
      return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([name]) => name);
    };

    // 计算烘焙偏好
    const roastPreference =
      roastLightCount >= roastMediumCount && roastLightCount >= roastDarkCount
        ? '浅烘焙'
        : roastDarkCount >= roastMediumCount
          ? '深烘焙'
          : '中烘焙';

    // 冲煮笔记统计
    const thisYearNotes = notes.filter(note => {
      const date = new Date(note.timestamp);
      return date.getFullYear() === currentYear;
    });

    // 器具统计
    const equipmentCount = new Map<string, number>();
    let totalRating = 0;
    let ratingCount = 0;
    let earliestTime = '06:00';
    let latestTime = '22:00';
    let earliestMinutes = 24 * 60;
    let latestMinutes = 0;

    thisYearNotes.forEach(note => {
      // 器具
      if (note.method) {
        equipmentCount.set(
          note.method,
          (equipmentCount.get(note.method) || 0) + 1
        );
      }
      // 评分
      if (note.rating) {
        totalRating += note.rating;
        ratingCount++;
      }
      // 时间
      const date = new Date(note.timestamp);
      const hour = date.getHours();
      const minute = date.getMinutes();
      let minutes = hour * 60 + minute;
      // 凌晨6点前算作前一天晚上
      if (hour < 6) {
        minutes += 24 * 60;
      }
      if (minutes < earliestMinutes) {
        earliestMinutes = minutes;
        earliestTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }
      if (minutes > latestMinutes) {
        latestMinutes = minutes;
        latestTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }
    });

    // 计算总重量和总价
    const totalWeight = beans.reduce(
      (sum, bean) => sum + (Number(bean.capacity) || 0),
      0
    );
    const totalCost = beans.reduce(
      (sum, bean) => sum + (Number(bean.price) || 0),
      0
    );

    return {
      beanCount: beans.length,
      totalWeight,
      totalCost,
      avgPrice: beans.length > 0 ? totalCost / beans.length : 0,
      favoriteRoaster,
      favoriteRoasterCount,
      topOrigins: getTopItems(originCount),
      topVarieties: getTopItems(varietyCount),
      topProcesses: getTopItems(processCount),
      roastPreference,
      brewCount: thisYearNotes.length,
      topEquipments: getTopItems(equipmentCount),
      earliestBrewTime: earliestTime,
      latestBrewTime: latestTime,
      avgRating: ratingCount > 0 ? totalRating / ratingCount : 0,
    };
  }, [beans, notes]);

  // 防止重复请求
  const hasRequestedRef = useRef(false);

  // 生成新报告的函数
  const generateNewReport = async (name: string) => {
    setIsGenerating(true);
    setError(null);
    setReportText('');
    setIsComplete(false);
    setIsViewingSaved(false);

    let fullText = '';

    try {
      const currentYear = new Date().getFullYear();
      await generateYearlyReportStream(
        name,
        currentYear,
        stats,
        // onChunk: 每收到一个文本块就追加
        chunk => {
          fullText += chunk;
          setReportText(prev => prev + chunk);
          setIsLoading(false);
        },
        // onComplete: 保存到本地
        async () => {
          setIsLoading(false);
          setIsComplete(true);
          setIsGenerating(false);

          // 增加使用次数
          const newCount = await incrementDailyUsage();
          setDailyUsed(newCount);

          // 保存到本地
          if (fullText.trim()) {
            const currentYear = new Date().getFullYear();
            const saved = await useYearlyReportStore
              .getState()
              .saveReport(currentYear, name, fullText);
            setSavedReport(saved);
            console.log('✅ 报告已自动保存');
          }
        },
        // onError
        err => {
          setError(err.message);
          setIsLoading(false);
          setIsGenerating(false);
        }
      );
    } catch (e) {
      console.error('生成年度报告失败:', e);
      setError(e instanceof Error ? e.message : '生成报告失败，请稍后重试');
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  // 获取用户名并加载报告
  useEffect(() => {
    // 防止重复请求（React Strict Mode 会执行两次）
    if (hasRequestedRef.current) return;
    hasRequestedRef.current = true;

    const loadReportData = async () => {
      setIsLoading(true);
      setError(null);
      setReportText('');

      try {
        // 从 settingsStore 获取用户名
        let name = '咖啡爱好者';
        const settings = useSettingsStore.getState().settings;
        const userName = settings.username?.trim();
        if (userName) {
          name = userName;
          setUsername(name);
        }

        // 获取今日已使用次数
        const used = await getDailyUsage();
        setDailyUsed(used);

        // 先检查本地是否有已保存的报告
        const currentYear = new Date().getFullYear();
        const existingReport = useYearlyReportStore
          .getState()
          .getReportByYear(currentYear);

        if (existingReport) {
          // 有已保存的报告，直接显示
          setSavedReport(existingReport);
          setReportText(existingReport.content);
          setUsername(existingReport.username);
          setIsLoading(false);
          setIsComplete(true);
          setIsViewingSaved(true);
          console.log('📖 加载已保存的报告');
        } else {
          // 没有保存的报告，生成新的
          await generateNewReport(name);
        }
      } catch (e) {
        console.error('加载报告失败:', e);
        setError(e instanceof Error ? e.message : '加载报告失败，请稍后重试');
        setIsLoading(false);
      }
    };

    loadReportData();
  }, [stats]);

  // 处理分享按钮点击
  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      const { toPng } = await import('html-to-image');
      const { TempFileManager } = await import('@/lib/utils/tempFileManager');
      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );

      // 创建临时容器用于导出 - 不使用 position 偏移，直接渲染
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = `
        width: 375px;
        padding: 32px 24px;
        background-color: #EEEDE6;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      `;

      // 头部
      const header = document.createElement('div');
      header.style.cssText = 'margin-bottom: 24px;';

      const usernameDiv = document.createElement('div');
      usernameDiv.style.cssText =
        'font-size: 14px; color: #737373; margin-bottom: 4px;';
      usernameDiv.textContent = `@${username}`;
      header.appendChild(usernameDiv);

      const titleDiv = document.createElement('div');
      titleDiv.style.cssText =
        'font-size: 20px; font-weight: 500; color: #262626;';
      titleDiv.textContent = '2025 年度咖啡报告';
      header.appendChild(titleDiv);

      tempContainer.appendChild(header);

      // 内容
      const content = document.createElement('div');
      content.style.cssText =
        'display: flex; flex-direction: column; gap: 20px; color: #404040;';

      reportText
        .split('\n\n')
        .filter(Boolean)
        .forEach(text => {
          const p = document.createElement('p');
          p.style.cssText = 'font-size: 16px; line-height: 1.6; margin: 0;';
          p.textContent = text.trim();
          content.appendChild(p);
        });
      tempContainer.appendChild(content);

      // 底部标识 - 和正文一样的样式，左对齐，带横线
      const footer = document.createElement('div');
      footer.style.cssText = `
        margin-top: 32px;
        padding-top: 16px;
        border-top: 1px solid #d4d4d4;
        text-align: left;
        font-size: 16px;
        line-height: 1.6;
        color: #404040;
      `;
      footer.textContent = 'Brew Guide APP 年度报告';
      tempContainer.appendChild(footer);

      // 添加到 body
      document.body.appendChild(tempContainer);

      // 等待渲染完成
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 200);
        });
      });

      // 生成图片 - 不指定固定宽高，让它自动计算
      const imageData = await toPng(tempContainer, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: '#EEEDE6',
        filter: node => {
          if (node instanceof HTMLElement) {
            const style = getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return false;
            }
          }
          return true;
        },
      });

      document.body.removeChild(tempContainer);

      // 分享图片
      await TempFileManager.shareImageFile(imageData, 'yearly-report-2025', {
        title: '2025年度咖啡报告',
        text: '我的2025年度咖啡报告',
        dialogTitle: '分享年度咖啡报告',
      });

      showToast({
        type: 'success',
        title: '分享成功',
      });
    } catch (error) {
      console.error('分享失败:', error);
      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );
      showToast({
        type: 'error',
        title: '分享失败，请重试',
      });
    } finally {
      setIsSharing(false);
    }
  };

  // 处理重播按钮点击
  const handleReplay = () => {
    if (isExiting) return;
    setIsExiting(true);

    if (headerRef.current && contentRef.current && footerRef.current) {
      const tl = gsap.timeline({
        onComplete: () => {
          onReplay?.();
        },
      });

      tl.to([headerRef.current, contentRef.current, footerRef.current], {
        opacity: 0,
        y: -20,
        duration: 0.4,
        ease: 'power2.in',
        stagger: 0.05,
      });
    } else {
      onReplay?.();
    }
  };

  // 处理重新生成报告
  const handleRegenerate = async () => {
    if (isGenerating) return;
    hasRequestedRef.current = false; // 重置请求标记
    await generateNewReport(username);
  };

  // 入场动画 - 只对 header 和 content
  useGSAP(
    () => {
      if (!headerRef.current || !contentRef.current) return;

      gsap.set([headerRef.current, contentRef.current], {
        opacity: 0,
        y: 30,
      });

      const tl = gsap.timeline();

      tl.to(headerRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: 'power2.out',
      }).to(
        contentRef.current,
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power2.out',
        },
        '-=0.3'
      );
    },
    { scope: containerRef }
  );

  // 按钮入场动画 - 报告完成后触发
  useEffect(() => {
    if (isComplete && footerRef.current) {
      gsap.fromTo(
        footerRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, [isComplete]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex flex-col overflow-hidden px-6 pt-8"
    >
      {/* 头部标题区域 */}
      <div
        ref={headerRef}
        className="mb-6 flex flex-col"
        style={{ willChange: 'transform, opacity' }}
      >
        <div className="text-sm text-neutral-500">@{username}</div>
        <h1 className="text-xl font-medium tracking-tight text-neutral-800">
          2025 年度咖啡报告
        </h1>
      </div>

      {/* 报告内容区域 */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto"
        style={{ willChange: 'transform, opacity' }}
      >
        {error && !reportText ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-neutral-200 px-4 py-2 text-sm text-neutral-700 active:scale-95"
            >
              重试
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5 text-neutral-700">
            {reportText
              .split('\n\n')
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index} className="text-base leading-relaxed">
                  {paragraph.trim()}
                </p>
              ))}
          </div>
        )}
      </div>

      {/* 底部区域 - 报告生成完成后显示 */}
      {isComplete && (
        <div
          ref={footerRef}
          className="flex flex-col items-center gap-3 py-4 opacity-0"
          style={{ willChange: 'transform, opacity' }}
        >
          {/* 分享按钮 */}
          <button
            onClick={handleShare}
            disabled={isSharing}
            className="flex items-center justify-center rounded-full bg-neutral-800 px-6 py-3 text-base text-white active:scale-95 disabled:opacity-50"
          >
            {isSharing ? '生成中...' : '分享年度报告'}
          </button>
          {/* 次要操作区域 */}
          <div className="flex items-center gap-2">
            {/* 重新生成按钮 - 始终显示，带剩余次数 */}
            <button
              onClick={handleRegenerate}
              disabled={isGenerating || dailyUsed >= DAILY_LIMIT}
              className="text-sm text-neutral-500 active:scale-95 disabled:opacity-50"
            >
              {isGenerating
                ? '生成中...'
                : `重新生成（${DAILY_LIMIT - dailyUsed}/${DAILY_LIMIT}）`}
            </button>
            <span className="text-sm text-neutral-400">/</span>
            {/* 重播按钮 */}
            <button
              onClick={handleReplay}
              className="text-sm text-neutral-500 active:scale-95"
            >
              重新播放
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportScreen;
