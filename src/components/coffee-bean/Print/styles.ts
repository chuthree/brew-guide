// 打印样式注入
let injected = false;

export function injectPrintStyles(): void {
  if (injected) return;
  injected = true;

  const style = document.createElement('style');
  style.id = 'bean-print-styles';
  style.textContent = `
    /* 打印预览滑块样式 */
    .slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #404040;
      cursor: pointer;
    }
    .slider::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #404040;
      cursor: pointer;
      border: none;
    }
    @media (prefers-color-scheme: dark) {
      .slider::-webkit-slider-thumb {
        background: #a3a3a3;
      }
      .slider::-moz-range-thumb {
        background: #a3a3a3;
      }
    }
  `;
  document.head.appendChild(style);
}
