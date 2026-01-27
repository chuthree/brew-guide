// 扩展 Window 接口以支持自定义属性
interface Window {
  __modalHandlingBack?: boolean;
  visualViewport?: VisualViewport;
}

// Visual Viewport API 类型定义
interface VisualViewport extends EventTarget {
  readonly offsetLeft: number;
  readonly offsetTop: number;
  readonly pageLeft: number;
  readonly pageTop: number;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}
