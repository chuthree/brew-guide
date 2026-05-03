'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { SettingPage } from './atomic';

const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div>
      <p
        onClick={() => setIsOpen(!isOpen)}
        className="flex cursor-pointer items-center gap-1 select-none"
      >
        {isOpen ? <Minus size={16} /> : <Plus size={16} />}
        {title}
      </p>
      <AnimatePresence>
        {isOpen && (
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

  React.useEffect(() => {
    fetch('https://gitee.com/api/v5/repos/chu3/brew-guide/contributors')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then((data: { contributions: number }[]) => {
        setCommitCount(data.reduce((sum, c) => sum + c.contributions, 0));
      })
      .catch(() => {
        fetch(
          'https://api.github.com/repos/chuthree/brew-guide/commits?per_page=1',
          { method: 'HEAD' }
        )
          .then(res => {
            const match = res.headers
              .get('link')
              ?.match(/page=(\d+)>; rel="last"/);
            if (match) setCommitCount(parseInt(match[1], 10));
          })
          .catch(() => {});
      });
  }, []);

  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  useModalHistory({
    id: 'about-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
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
              本应用使用百度统计收集匿名使用数据，包括页面访问、设备类型等基本信息，用于改进产品体验。
            </p>
            <p>
              所有咖啡豆和冲煮记录均存储在您的设备本地。如启用云同步，数据将同步至您自行配置的服务器（WebDAV/S3/Supabase），我们不会访问或存储这些数据。
            </p>
            <p>
              使用图片识别功能（咖啡豆/冲煮方案）时，图片会上传至服务器进行 AI
              分析，处理完成后立即删除，不会保存。
            </p>
          </CollapsibleSection>
          <CollapsibleSection title="开源致谢">
            <p>
              本项目使用了{' '}
              <a
                href="https://www.isocons.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-800 underline dark:text-neutral-200"
              >
                Isometric Icons
              </a>{' '}
              图标库，采用{' '}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
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
                className="text-neutral-800 underline dark:text-neutral-200"
              >
                官网
              </a>
              <a
                href="https://chu3.top/projects/brew-guide-app/changelog"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-800 underline dark:text-neutral-200"
              >
                更新日志
              </a>
              <a
                href="https://chu3.top/"
                target="_blank"
                rel="noopener noreferrer"
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
