'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import SettingPage from './atomic/SettingPage';
import {
  useSettingSearchHighlight,
  useScrollToHighlightedSetting,
} from './atomic';
import { makeSettingRowSearchId } from './settingsSearch';
import { handleExternalUrlClick } from '@/lib/utils/openExternalUrl';

const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const { highlightedSettingId } = useSettingSearchHighlight();
  const settingId = makeSettingRowSearchId(title);
  const isHighlighted = highlightedSettingId === settingId;
  const shouldShowContent = isOpen || isHighlighted;

  return (
    <div
      data-settings-search-id={settingId}
      className={`rounded transition-colors ${
        isHighlighted ? 'bg-neutral-200/70 dark:bg-neutral-700/45' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex cursor-pointer items-center gap-1 select-none"
      >
        {shouldShowContent ? <Minus size={16} /> : <Plus size={16} />}
        {title}
      </button>
      <AnimatePresence>
        {shouldShowContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 ml-4 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface AboutSettingsProps {
  onClose: () => void;
}

const AboutSettings: React.FC<AboutSettingsProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [commitCount, setCommitCount] = React.useState<number | null>(null);
  useScrollToHighlightedSetting(commitCount);

  React.useEffect(() => {
    fetch('https://api.github.com/repos/chuthree/brew-guide/commits?per_page=1', {
      method: 'HEAD',
    })
      .then(res => {
        const match = res.headers.get('link')?.match(/page=(\d+)>; rel="last"/);
        if (match) setCommitCount(parseInt(match[1], 10));
      })
      .catch(() => {});
  }, []);

  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onClose();
    }, 350);
  }, [onClose]);

  useModalHistory({
    id: 'about-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
    skipPageExitTransitionOnHistory: true,
  });

  const handleClose = () => {
    modalHistory.back();
  };

  React.useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  return (
    <SettingPage title="关于" isVisible={isVisible} onClose={handleClose}>
      <div className="px-6 pt-4 pb-6">
        <div className="space-y-4 text-base leading-relaxed font-medium">
          <p>
            Hi，很高兴你能看到这里，这是一个因个人需求而生，在群友支持下持续维护的
            <span className="underline decoration-pink-500 decoration-wavy">
              用爱发电项目
            </span>
            。
          </p>
          {commitCount ? (
            <p>
              通过
              <a
                href="https://github.com/chuthree/brew-guide/commits/main"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleExternalUrlClick}
                className="mx-0.5 text-neutral-800 underline dark:text-neutral-200"
              >
                {commitCount}
              </a>
              次代码提交，最终变为了你现在看到的样子。
            </p>
          ) : (
            <p>
              通过
              <span className="mx-0.5 inline-block h-4 w-8 animate-pulse rounded bg-neutral-200 align-middle dark:bg-neutral-700" />
              次代码提交，最终变为了你现在看到的样子。
            </p>
          )}
          <hr className="my-6" />
          <CollapsibleSection title="隐私政策">
            <p>
              本应用不接入广告或行为分析服务，不自动上传用于产品分析的使用数据或崩溃报告。咖啡豆和冲煮记录默认保存在您的设备本地。
            </p>
            <p>
              图片识别、云同步等可选功能会按需传输相关数据，联网请求也可能产生必要的运行与安全日志。
            </p>
            <p>
              <a
                href="https://chu3.top/brewguide/privacy"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleExternalUrlClick}
                className="text-neutral-800 underline dark:text-neutral-200"
              >
                查看完整隐私政策
              </a>
            </p>
          </CollapsibleSection>
          <CollapsibleSection title="开源致谢">
            <p>
              本项目使用了{' '}
              <a
                href="https://www.isocons.app/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleExternalUrlClick}
                className="text-neutral-800 underline dark:text-neutral-200"
              >
                Isometric Icons
              </a>{' '}
              图标库，采用{' '}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleExternalUrlClick}
                className="text-neutral-800 underline dark:text-neutral-200"
              >
                CC BY 4.0
              </a>{' '}
              协议授权。
            </p>
          </CollapsibleSection>
          <CollapsibleSection title="相关链接">
            <p className="flex flex-col gap-1.5">
              <a
                href="https://chu3.top/brewguide"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleExternalUrlClick}
                className="text-neutral-800 underline dark:text-neutral-200"
              >
                官网
              </a>
              <a
                href="https://chu3.top/brewguide/changelog"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleExternalUrlClick}
                className="text-neutral-800 underline dark:text-neutral-200"
              >
                更新日志
              </a>
              <a
                href="https://chu3.top/brew2"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleExternalUrlClick}
                className="text-neutral-800 underline dark:text-neutral-200"
              >
                brew2
              </a>
              <a
                href="https://chu3.top/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleExternalUrlClick}
                className="text-neutral-800 underline dark:text-neutral-200"
              >
                开发者
              </a>
            </p>
          </CollapsibleSection>
        </div>
      </div>
    </SettingPage>
  );
};

export default AboutSettings;
