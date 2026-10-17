/**
 * SVG 模块声明
 *
 * 使用 @svgr/webpack 将 SVG 文件转换为 React 组件
 * 参考: https://react-svgr.com/docs/next/#typescript
 */

declare module '*.svg' {
  import { FC, SVGProps } from 'react';
  const content: FC<SVGProps<SVGElement>>;
  export default content;
}

declare module '*.svg?url' {
  const content: string;
  export default content;
}
