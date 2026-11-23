'use client';

import type { ReactNode } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import ArrowUpIcon from '@public/images/icons/ui/arrow-up.svg';

interface Props {
  isOpen: boolean;
  title: string;
  message?: string;
  action: string;
  onAction?: () => void;
  onCancel?: () => void;
  children?: ReactNode;
}

export default function DataProgressDrawer({
  isOpen,
  title,
  message,
  action,
  onAction,
  onCancel,
  children,
}: Props) {
  return (
    <ActionDrawer
      isOpen={isOpen}
      title={title}
      dismissible={Boolean(onCancel)}
      onClose={onCancel ?? (() => {})}
    >
      <ActionDrawer.Icon icon={ArrowUpIcon} />
      <ActionDrawer.Content>
        <p
          role="status"
          aria-live="polite"
          className="text-neutral-500 dark:text-neutral-400"
        >
          {message}
        </p>
        {children}
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        {onCancel && (
          <ActionDrawer.SecondaryButton onClick={onCancel}>
            取消
          </ActionDrawer.SecondaryButton>
        )}
        <ActionDrawer.PrimaryButton disabled={!onAction} onClick={onAction}>
          {action}
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
}
