/**
 * SVG工具函数
 * 用于处理Canvas绘图和SVG路径的转换
 */

/**
 * 将画布上的线条转换为SVG路径
 * @param lines 线条数组，每条线包含点坐标
 * @param canvasWidth 画布宽度
 * @param canvasHeight 画布高度
 * @returns SVG路径字符串
 */
export const linesToSvgPath = (
  lines: Array<{points: Array<{x: number; y: number}>; strokeWidth: number; color: string}>,
  canvasWidth: number,
  canvasHeight: number
): string => {
  // 创建一个SVG路径数组
  const paths: string[] = [];
  
  // 遍历每条线
  lines.forEach(line => {
    if (line.points.length === 0) return;
    
    // 创建路径起点
    let pathData = `M ${line.points[0].x} ${line.points[0].y}`;
    
    // 添加每个点为线段
    for (let i = 1; i < line.points.length; i++) {
      pathData += ` L ${line.points[i].x} ${line.points[i].y}`;
    }
    
    // 对于黑色线条，使用特殊的类名，以便在深色模式下可以反转颜色
    // 对于其他颜色，保持原样
    const isBlackColor = line.color.toLowerCase() === '#000000' || line.color.toLowerCase() === 'black';
    
    // 将路径添加到数组中，包括线条样式
    if (isBlackColor) {
      // 黑色线条使用特殊的stroke属性引用CSS变量
      paths.push(`<path d="${pathData}" stroke="var(--custom-shape-color)" stroke-width="${line.strokeWidth}" fill="none" />`);
    } else {
      // 非黑色线条保持原色
      paths.push(`<path d="${pathData}" stroke="${line.color}" stroke-width="${line.strokeWidth}" fill="none" />`);
    }
  });
  
  // 组合所有路径为一个SVG字符串，添加CSS定义支持深色模式
  return `<svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
    <style>
      :root {
        --custom-shape-color: #000000;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --custom-shape-color: #ffffff;
        }
      }
      /* 也为class选择器添加支持，适配Tailwind暗黑模式类 */
      .dark {
        --custom-shape-color: #ffffff;
      }
    </style>
    ${paths.join('\n    ')}
  </svg>`;
};

/**
 * 从SVG字符串中提取路径数据
 * @param svgString SVG字符串
 * @returns 路径数据数组
 */
export const extractPathsFromSvg = (svgString: string): Array<{
  path: string;
  stroke: string;
  strokeWidth: string;
}> => {
  const paths: Array<{path: string; stroke: string; strokeWidth: string}> = [];
  
  // 使用正则表达式提取path元素
  const pathRegex = /<path[^>]*d="([^"]*)"[^>]*stroke="([^"]*)"[^>]*stroke-width="([^"]*)"[^>]*\/>/g;
  let match;
  
  while ((match = pathRegex.exec(svgString)) !== null) {
    paths.push({
      path: match[1],
      stroke: match[2],
      strokeWidth: match[3]
    });
  }
  
  return paths;
};

/**
 * 将SVG转换为Canvas上可以使用的线条数据
 * @param svgString SVG字符串
 * @returns 线条数据数组
 */
export const svgToLines = (
  svgString: string
): Array<{points: Array<{x: number; y: number}>; strokeWidth: number; color: string}> => {
  const pathData = extractPathsFromSvg(svgString);
  const lines: Array<{points: Array<{x: number; y: number}>; strokeWidth: number; color: string}> = [];
  
  pathData.forEach(({path, stroke, strokeWidth}) => {
    // 解析路径命令
    const commands = path.match(/[MLZ][^MLZ]*/g) || [];
    const points: Array<{x: number; y: number}> = [];
    
    commands.forEach(cmd => {
      const type = cmd[0];
      const coords = cmd.substring(1).trim().split(/\s+/);
      
      if (type === 'M' || type === 'L') {
        points.push({
          x: parseFloat(coords[0]),
          y: parseFloat(coords[1])
        });
      }
    });
    
    lines.push({
      points,
      strokeWidth: parseFloat(strokeWidth),
      color: stroke
    });
  });
  
  return lines;
}; 