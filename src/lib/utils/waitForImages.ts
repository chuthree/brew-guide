/** 等待导出区域的图片加载、失败或超时，每张图片只完成一次。 */
export async function waitForImages(element: HTMLElement): Promise<void> {
  await Promise.all(
    Array.from(element.querySelectorAll('img'), image => {
      if (image.complete) return Promise.resolve();

      return new Promise<void>(resolve => {
        const finish = () => {
          clearTimeout(timeout);
          image.removeEventListener('load', finish);
          image.removeEventListener('error', finish);
          resolve();
        };
        const timeout = setTimeout(finish, 3000);
        image.addEventListener('load', finish);
        image.addEventListener('error', finish);
      });
    })
  );
}
