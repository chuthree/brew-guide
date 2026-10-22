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

export const setSvgDimensions = (
  svgString: string,
  width: string,
  height: string
): string =>
  svgString.replace(/<svg\b[^>]*>/i, svgTag => {
    const setAttribute = (tag: string, name: string, value: string) => {
      const attributePattern = new RegExp(
        `\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`,
        'i'
      );

      if (attributePattern.test(tag)) {
        return tag.replace(attributePattern, ` ${name}="${value}"`);
      }

      return tag.replace(/(\/?)>$/, ` ${name}="${value}"$1>`);
    };

    return setAttribute(setAttribute(svgTag, 'width', width), 'height', height);
  });

const parseSafeSvg = (svgString: string): Document | null => {
  if (
    typeof DOMParser === 'undefined' ||
    typeof XMLSerializer === 'undefined'
  ) {
    return null;
  }

  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;

  doc
    .querySelectorAll('script, foreignObject, iframe, object, embed')
    .forEach(node => node.remove());

  doc.querySelectorAll('*').forEach(element => {
    Array.from(element.attributes).forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (
        name.startsWith('on') ||
        value.startsWith('javascript:') ||
        value.startsWith('data:text/html') ||
        ((name === 'href' || name === 'xlink:href') &&
          (value.startsWith('javascript:') || value.startsWith('data:'))) ||
        (name === 'style' && /(?:expression|url\s*\()/i.test(value))
      ) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return doc;
};

export const sanitizeSvgMarkup = (svgString: string): string => {
  const doc = parseSafeSvg(svgString);
  return doc ? new XMLSerializer().serializeToString(doc.documentElement) : '';
};

/** All equipment previews and canvas references use the same theme-colored outlines. */
export const prepareOutlineSvg = (
  svgString: string,
  color = 'var(--custom-shape-color)'
): string => {
  const doc = parseSafeSvg(svgString);
  if (!doc) return '';
  const svg = doc.documentElement;
  if (svg.localName !== 'svg') return '';
  if (!svg.hasAttribute('viewBox')) {
    const width = parseFloat(svg.getAttribute('width') || '') || 300;
    const height = parseFloat(svg.getAttribute('height') || '') || 300;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  for (const element of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    element.removeAttribute('style');
    element.removeAttribute('color');
    for (const attribute of [
      'opacity',
      'fill-opacity',
      'stroke-opacity',
      'stroke-dasharray',
      'stroke-dashoffset',
    ]) {
      element.removeAttribute(attribute);
    }
    element.setAttribute('stroke-linecap', 'round');
    element.setAttribute('stroke-linejoin', 'round');
    element.setAttribute('fill', 'none');
    element.setAttribute('stroke', color);
  }
  svg.setAttribute('stroke-width', svg.getAttribute('stroke-width') || '3');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  return new XMLSerializer().serializeToString(svg);
};

/** Import old curves, transforms and viewBoxes without silently dropping geometry. */
export const svgToLines = (
  svgString: string,
  width = 300,
  height = 300
): Array<{
  points: Array<{ x: number; y: number }>;
  strokeWidth: number;
  color: string;
}> => {
  const markup = prepareOutlineSvg(svgString);
  if (!markup) return [];
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none';
  host.innerHTML = setSvgDimensions(markup, String(width), String(height));
  const svg = host.querySelector('svg')!;
  document.body.appendChild(host);
  const lines: ReturnType<typeof svgToLines> = [];
  try {
    // Separate subpaths before sampling so pen lifts never become connecting lines.
    svg.querySelectorAll('path').forEach(path => {
      const parts = path.getAttribute('d')?.match(/[Mm][^Mm]*/g) || [];
      if (parts.length <= 1) return;
      let endpoint = { x: 0, y: 0 };
      for (const d of parts) {
        const part = path.cloneNode() as SVGPathElement;
        const absoluteStart = d.replace(
          /^m\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)[\s,]*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/,
          (match, x, y) => {
            const rest = d.slice(match.length).trimStart();
            const implicitLine = /^[+\-.\d]/.test(rest) ? 'l ' : '';
            return `M ${Number(x) + endpoint.x} ${Number(y) + endpoint.y} ${implicitLine}`;
          }
        );
        part.setAttribute('d', absoluteStart);
        path.before(part);
        endpoint = part.getPointAtLength(part.getTotalLength());
      }
      path.remove();
    });
    svg
      .querySelectorAll<SVGGeometryElement>(
        'path, line, polyline, polygon, rect, circle, ellipse'
      )
      .forEach(shape => {
        if (shape.closest('defs, clipPath, mask')) return;
        const matrix = shape.getCTM();
        if (!matrix) return;
        const length = shape.getTotalLength();
        if (!Number.isFinite(length) || length <= 0) return;
        const count = Math.min(10000, Math.max(1, Math.ceil(length / 2)));
        const d = shape.getAttribute('d') || '';
        const linear =
          shape.localName === 'path' &&
          /^M/.test(d) &&
          !/[a-df-km-y]/i.test(d.slice(1)) &&
          !/[lz]/.test(d);
        const coordinates = linear
          ? (d.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || []).map(
              Number
            )
          : [];
        const points = linear
          ? Array.from({ length: coordinates.length / 2 }, (_, index) => {
              const point = new DOMPoint(
                coordinates[index * 2],
                coordinates[index * 2 + 1]
              ).matrixTransform(matrix);
              return { x: point.x, y: point.y };
            })
          : Array.from({ length: count + 1 }, (_, index) => {
              const point = shape
                .getPointAtLength((length * index) / count)
                .matrixTransform(matrix);
              return { x: point.x, y: point.y };
            });
        if (linear && /Z\s*$/.test(d) && points.length)
          points.push({ ...points[0] });
        const scale = Math.sqrt(
          Math.abs(matrix.a * matrix.d - matrix.b * matrix.c)
        );
        lines.push({
          points,
          strokeWidth:
            (parseFloat(getComputedStyle(shape).strokeWidth) || 3) * scale,
          color: 'var(--custom-shape-color)',
        });
      });
    return lines;
  } finally {
    host.remove();
  }
};
