'use client';

import { rankBeanCategories } from '../../categoryStats';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ScreenProps } from '../../types';
import type { YearlyReportStats } from '@/lib/api/yearlyReport';
import { generateYearlyReportStream } from '@/lib/api/yearlyReport';
import { Storage } from '@/lib/core/storage';
import { showErrorReport } from '@/lib/feedback/errorReport';
import { getEquipmentNameById } from '@/lib/utils/equipmentUtils';
import { REVIEW_YEAR } from '../../constants';
import { parseNum } from '@/lib/statistics/recordMetrics';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { getRoasterName } from '@/lib/utils/beanVarietyUtils';

// 每日生成次数限制
const DAILY_LIMIT = 5;
const REPORT_KEY = `yearlyReport-${REVIEW_YEAR}`;
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
  const [isExiting, setIsExiting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [username, setUsername] = useState('咖啡爱好者');
  const [reportText, setReportText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  // 新增：今日已使用次数
  const [dailyUsed, setDailyUsed] = useState(0);

  // 计算统计数据
  const stats = useMemo<YearlyReportStats>(() => {
    // 烘焙商统计
    const roasterCount = new Map<string, number>();
    beans.forEach(bean => {
      const roaster = getRoasterName(bean);
      if (roaster) {
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

    // 器具统计
    const equipmentCount = new Map<string, number>();
    let totalRating = 0;
    let ratingCount = 0;
    let earliestTime = '';
    let latestTime = '';
    let earliestMinutes = Infinity;
    let latestMinutes = 0;

    notes.forEach(note => {
      // 器具
      const equipment =
        note.equipmentName ||
        getEquipmentNameById(note.equipmentId || note.equipment);
      if (equipment) {
        equipmentCount.set(equipment, (equipmentCount.get(equipment) || 0) + 1);
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
      (sum, bean) => sum + parseNum(bean.capacity),
      0
    );
    const totalCost = beans.reduce(
      (sum, bean) => sum + parseNum(bean.price),
      0
    );

    return {
      beanCount: beans.length,
      totalWeight,
      totalCost,
      avgPrice: beans.length > 0 ? totalCost / beans.length : 0,
      favoriteRoaster,
      favoriteRoasterCount,
      topOrigins: rankBeanCategories(beans, 'origin')
        .slice(0, 3)
        .map(item => item.name),
      topVarieties: rankBeanCategories(beans, 'variety')
        .slice(0, 3)
        .map(item => item.name),
      topProcesses: rankBeanCategories(beans, 'process')
        .slice(0, 3)
        .map(item => item.name),
      roastPreference:
        roastLightCount + roastMediumCount + roastDarkCount
          ? roastPreference
          : '',
      brewCount: notes.length,
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
    setIsLoading(true);
    setError(null);
    setReportText('');
    setIsComplete(false);

    let fullText = '';

    try {
      await generateYearlyReportStream(
        name,
        REVIEW_YEAR,
        stats,
        // onChunk: 每收到一个文本块就追加
        chunk => {
          fullText += chunk;
          setReportText(prev => prev + chunk);
          setIsLoading(false);
        },
        // onComplete: 保存到本地
        async () => {
          if (!fullText.trim()) throw new Error('未收到报告内容，请重试');
          try {
            await Storage.set(
              REPORT_KEY,
              JSON.stringify({ username: name, content: fullText })
            );
          } catch (error) {
            showErrorReport({
              title: '年度报告保存失败',
              source: 'yearly-review.save',
              error,
            });
          }
          setDailyUsed(await incrementDailyUsage());
          setIsLoading(false);
          setIsComplete(true);
          setIsGenerating(false);
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
        const stored = await Storage.get(REPORT_KEY);
        const existingReport = stored ? JSON.parse(stored) : null;

        if (
          typeof existingReport?.content === 'string' &&
          typeof existingReport.username === 'string'
        ) {
          // 有已保存的报告，直接显示
          setReportText(existingReport.content);
          setUsername(existingReport.username);
          setIsLoading(false);
          setIsComplete(true);
        } else if (used >= DAILY_LIMIT) {
          setError('今日生成次数已用完');
          setIsLoading(false);
        } else {
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
    const tempContainer = document.createElement('div');

    try {
      const { toPng } = await import('html-to-image');
      const { TempFileManager } = await import('@/lib/utils/tempFileManager');
      const { showToast } =
        await import('@/components/common/feedback/LightToast');

      // 创建临时容器用于导出 - 不使用 position 偏移，直接渲染
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
      titleDiv.textContent = `${REVIEW_YEAR} 年度咖啡报告`;
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

      // 分享图片
      const outcome = await TempFileManager.shareImageFile(
        imageData,
        `yearly-report-${REVIEW_YEAR}`,
        {
          title: `${REVIEW_YEAR}年度咖啡报告`,
          text: `我的${REVIEW_YEAR}年度咖啡报告`,
          dialogTitle: '分享年度咖啡报告',
        }
      );

      if (outcome === 'activation-required')
        showToast({ type: 'info', title: '请再次点击分享' });
      if (outcome === 'shared' || outcome === 'downloaded') {
        showToast({
          type: 'success',
          title: outcome === 'shared' ? '分享成功' : '报告图片已下载',
        });
      }
    } catch (error) {
      showErrorReport({
        title: '年度报告分享失败',
        source: 'yearly-review.share',
        error,
      });
    } finally {
      tempContainer.remove();
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
    if (dailyUsed >= DAILY_LIMIT) return;
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
          {REVIEW_YEAR} 年度咖啡报告
        </h1>
      </div>

      {/* 报告内容区域 */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto"
        style={{ willChange: 'transform, opacity' }}
      >
        {isLoading && !error && <p role="status">正在准备年度报告…</p>}
        {error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={handleRegenerate}
              disabled={dailyUsed >= DAILY_LIMIT || isGenerating}
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
