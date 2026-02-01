'use client';

import React, { useState, useEffect } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { Calendar } from '@/components/common/ui/Calendar';

interface DatePickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  onDateChange: (date: Date) => void;
}

/**
 * 日期选择抽屉组件
 * 基于 ActionDrawer + Calendar 实现
 */
const DatePickerDrawer: React.FC<DatePickerDrawerProps> = ({
  isOpen,
  onClose,
  date,
  onDateChange,
}) => {
  // 内部临时日期状态，用于在抽屉内编辑
  const [tempDate, setTempDate] = useState<Date>(date);

  // 当抽屉打开时，同步外部日期到内部状态
  useEffect(() => {
    if (isOpen) {
      setTempDate(date);
    }
  }, [isOpen, date]);

  const handleSelect = (selectedDate: Date) => {
    // 保留原始时间（时/分/秒）
    const newDate = new Date(selectedDate);
    newDate.setHours(date.getHours());
    newDate.setMinutes(date.getMinutes());
    newDate.setSeconds(date.getSeconds());
    setTempDate(newDate);
  };

  const handleConfirm = () => {
    onDateChange(tempDate);
    onClose();
  };

  return (
    <ActionDrawer isOpen={isOpen} onClose={onClose} historyId="date-picker">
      <ActionDrawer.Content>
        <Calendar
          selected={tempDate}
          onSelect={handleSelect}
          locale="zh-CN"
          initialFocus
        />
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={onClose}>
          取消
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton onClick={handleConfirm}>
          确定
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default DatePickerDrawer;
