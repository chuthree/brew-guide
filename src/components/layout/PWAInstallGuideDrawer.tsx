'use client';

import React from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { SquarePlus, X } from 'lucide-react';

interface PWAInstallGuideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const IOSShareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <clipPath id="share_svg__a">
        <path d="M0 0h24v24H0Z" />
      </clipPath>
    </defs>
    <g fill="currentColor" fillOpacity="0.85" clipPath="url(#share_svg__a)">
      <path d="M21.092 9.722v10.101c0 2.111-1.076 3.177-3.217 3.177H6.124c-2.141 0-3.217-1.056-3.217-3.177V9.722c0-2.121 1.076-3.176 3.217-3.176h3.135v1.649H6.145c-1.025 0-1.588.543-1.588 1.609v9.938c0 1.065.563 1.608 1.588 1.608h11.699c1.015 0 1.599-.543 1.599-1.608V9.804c0-1.066-.584-1.609-1.599-1.609H14.73V6.546h3.145c2.141 0 3.217 1.065 3.217 3.176" />
      <path d="M11.995 14.978c.44 0 .819-.359.819-.789V3.77l-.061-1.527.574.605 1.578 1.69a.75.75 0 0 0 .553.246c.43 0 .748-.307.748-.717a.72.72 0 0 0-.236-.543L12.589.266C12.384.061 12.21 0 11.995 0c-.205 0-.379.061-.594.266L8.03 3.524c-.154.153-.246.317-.246.543 0 .41.308.717.738.717.194 0 .42-.082.563-.246l1.588-1.69.574-.605-.061 1.527v10.419c0 .43.368.789.809.789" />
    </g>
  </svg>
);

const PWAInstallGuideDrawer: React.FC<PWAInstallGuideDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
      historyId="pwa-install-guide-drawer"
    >
      <ActionDrawer.Content className="mb-0! space-y-6">
        <div className="flex items-center justify-between gap-3">
            <p className="text-2xl font-medium text-neutral-900 dark:text-neutral-100">
              安装 iOS PWA 应用
            </p>

        </div>

        <div className="space-y-7">
          <div className="flex">
            <span className="text-4xl ml-3 mr-6 leading-none font-medium text-neutral-500 dark:text-neutral-400">
              1
            </span>
            <div className="space-y-2">
              <div className="inline-flex items-center rounded-full bg-neutral-900 -mt-1 p-3.5 dark:bg-neutral-100">
                <IOSShareIcon className="h-5 w-5 text-neutral-100 dark:text-neutral-800" />
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-200">
                按下屏幕底部的这个按钮
              </p>
            </div>
          </div>

          <div className="flex">
            <span className="text-4xl ml-3 mr-6 leading-none font-medium text-neutral-500 dark:text-neutral-400">
              2
            </span>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 -mt-1 p-3.5 text-sm font-semibold text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900">
                <SquarePlus className="h-5 w-5 text-neutral-100 stroke-[1.5] dark:text-neutral-800" />
                <span className="text-neutral-100 dark:text-neutral-900">添加到主屏幕</span>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-200">
                从菜单中按下此按钮
              </p>
            </div>
          </div>

          <div className="flex">
            <span className="text-4xl ml-3 mr-6 leading-none font-medium text-neutral-500 dark:text-neutral-400">
              3
            </span>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 h-12 rounded-full bg-neutral-900 -mt-1 p-3.5 text-sm leading-none font-semibold text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900">
                <span className="text-neutral-100 dark:text-neutral-900 ">添加</span>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-200">
                按下右上角的这个按钮
              </p>
            </div>
          </div>
        </div>
      </ActionDrawer.Content>
    </ActionDrawer>
  );
};

export default PWAInstallGuideDrawer;
