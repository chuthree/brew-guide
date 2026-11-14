// 扩展阶段类型
export type ExpandedStage = {
  type: 'pour' | 'wait';
  label: string;
  startTime: number;
  endTime: number;
  time: number;
  pourTime?: number;
  water: string;
  detail: string;
  pourType?: string;
  valveStatus?: 'open' | 'closed';
  originalIndex: number;
};
