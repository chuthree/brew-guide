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
  lines: Array<{
    points: Array<{ x: number; y: number }>;
    strokeWidth: number;
    color: string;
  }>,
  canvasWidth: number,
  canvasHeight: number
): string => {
  // 创建一个SVG路径数组
  const paths: string[] = [];

  // 遍历每条线
  lines.forEach(line => {
    if (line.points.length === 0) return;

    // 创建路径起点 - 确保坐标精度，避免浮点数误差
    let pathData = `M ${Math.round(line.points[0].x * 100) / 100} ${Math.round(line.points[0].y * 100) / 100}`;

    // 添加每个点为线段 - 确保坐标精度
    for (let i = 1; i < line.points.length; i++) {
      pathData += ` L ${Math.round(line.points[i].x * 100) / 100} ${Math.round(line.points[i].y * 100) / 100}`;
    }

    // 使用每条线的实际笔触宽度，而不是固定值
    paths.push(
      `<path d="${pathData}" stroke="var(--custom-shape-color)" stroke-width="${line.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`
    );
  });

  // 组合所有路径为一个SVG字符串，确保viewBox和尺寸设置正确
  // 使用标准化的尺寸设置，避免坐标系统不一致
  return `<svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg" class="custom-cup-shape">
    ${paths.join('\n    ')}
  </svg>`;
};

/**
 * 从SVG字符串中提取路径数据
 * @param svgString SVG字符串
 * @returns 路径数据数组
 */
export const extractPathsFromSvg = (
  svgString: string
): Array<{
  path: string;
  stroke: string;
  strokeWidth: string;
}> => {
  const paths: Array<{ path: string; stroke: string; strokeWidth: string }> =
    [];

  try {
    // 使用DOMParser解析SVG字符串，这种方式更可靠
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');

    // 获取所有path元素
    const pathElements = svgDoc.querySelectorAll('path');

    pathElements.forEach(path => {
      // 提取每个path的属性
      const d = path.getAttribute('d') || '';
      const stroke = path.getAttribute('stroke') || 'var(--custom-shape-color)';
      const strokeWidth = path.getAttribute('stroke-width') || '1.5';

      if (d) {
        paths.push({
          path: d,
          stroke: stroke,
          strokeWidth: strokeWidth,
        });
      }
    });

    // 如果没有找到任何path元素，尝试使用备用的正则表达式方法
    if (paths.length === 0) {
      fallbackExtractPaths(svgString, paths);
    }
  } catch (error) {
    console.error('解析SVG时出错:', error);
    // 出错时使用备用方法
    fallbackExtractPaths(svgString, paths);
  }

  return paths;
};

/**
 * 备用方法：使用正则表达式从SVG字符串中提取路径
 */
const fallbackExtractPaths = (
  svgString: string,
  paths: Array<{ path: string; stroke: string; strokeWidth: string }>
) => {
  // 更灵活的正则表达式，匹配各种格式的path元素
  const pathRegex =
    /<path[^>]*d="([^"]*)"[^>]*(?:stroke="([^"]*)")?[^>]*(?:stroke-width="([^"]*)")?[^>]*>/g;
  let match;

  while ((match = pathRegex.exec(svgString)) !== null) {
    paths.push({
      path: match[1],
      stroke: match[2] || 'var(--custom-shape-color)',
      strokeWidth: match[3] || '1.5',
    });
  }

  // 如果还没找到，尝试不同的属性顺序
  if (paths.length === 0) {
    const altPathRegex =
      /<path[^>]*(?:stroke-width="([^"]*)")?[^>]*(?:stroke="([^"]*)")?[^>]*d="([^"]*)"[^>]*>/g;
    while ((match = altPathRegex.exec(svgString)) !== null) {
      paths.push({
        path: match[3],
        stroke: match[2] || 'var(--custom-shape-color)',
        strokeWidth: match[1] || '1.5',
      });
    }
  }
};

/**
 * 将SVG转换为Canvas上可以使用的线条数据
 * @param svgString SVG字符串
 * @returns 线条数据数组
 */
export const svgToLines = (
  svgString: string
): Array<{
  points: Array<{ x: number; y: number }>;
  strokeWidth: number;
  color: string;
}> => {
  const pathData = extractPathsFromSvg(svgString);
  const lines: Array<{
    points: Array<{ x: number; y: number }>;
    strokeWidth: number;
    color: string;
  }> = [];

  pathData.forEach(({ path, stroke, strokeWidth }) => {
    // 解析路径命令
    const commands = path.match(/[MLZ][^MLZ]*/g) || [];
    const points: Array<{ x: number; y: number }> = [];

    commands.forEach(cmd => {
      const type = cmd[0];
      const coords = cmd.substring(1).trim().split(/\s+/);

      if (type === 'M' || type === 'L') {
        points.push({
          x: parseFloat(coords[0]),
          y: parseFloat(coords[1]),
        });
      }
    });

    lines.push({
      points,
      strokeWidth: parseFloat(strokeWidth),
      color: stroke,
    });
  });

  return lines;
};
