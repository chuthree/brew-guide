export interface BeanImportImageOptions<T> {
  autoFillRecognitionImage?: boolean;
  /** Undefined follows the setting; null explicitly chooses no image. */
  explicitImage?: T | null;
  candidates: readonly T[];
  beanCount?: number;
}

/** Resolve before review/save. Undefined means an image choice is ambiguous,
 * not permission to pick the first source or silently change a reviewed plan. */
export function resolveBeanImportImage<T>({
  autoFillRecognitionImage = false,
  explicitImage,
  candidates,
  beanCount = 1,
}: BeanImportImageOptions<T>): T | null | undefined {
  if (explicitImage !== undefined) return explicitImage;
  if (autoFillRecognitionImage !== true || candidates.length === 0) return null;
  if (candidates.length === 1 && beanCount === 1) return candidates[0];
  return undefined;
}

/** OCR image fields are untrusted model output, not an explicit user choice.
 * Bind only the real source before flattening a batch. JSON/share-package imports
 * do not use this wrapper, so their existing images remain untouched. */
export function prepareRecognizedBeanImages(
  data: unknown,
  {
    autoFillRecognitionImage,
    recognitionImage,
  }: {
    autoFillRecognitionImage?: boolean;
    /** Null means a supplied source failed preparation; undefined means no source. */
    recognitionImage?: string | null;
  }
): { data: unknown; needsImageSelection: boolean } {
  if (autoFillRecognitionImage === true && recognitionImage === null)
    throw new Error('图片准备失败，未添加这张图片中的咖啡豆，请重试。');
  const beans = Array.isArray(data) ? data : [data];
  let needsImageSelection = false;
  const prepared = beans.map(bean => {
    if (!bean || typeof bean !== 'object' || Array.isArray(bean)) return bean;
    const fields = { ...(bean as Record<string, unknown>) };
    delete fields.image;
    delete fields.backImage;
    const image = resolveBeanImportImage({
      autoFillRecognitionImage,
      candidates: recognitionImage ? [recognitionImage] : [],
      beanCount: beans.length,
    });
    if (image === undefined) needsImageSelection = true;
    return typeof image === 'string' ? { ...fields, image } : fields;
  });
  return {
    data: Array.isArray(data) ? prepared : prepared[0],
    needsImageSelection,
  };
}
