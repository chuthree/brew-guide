import { db } from '@/lib/core/db';
import { mergeCoffeeBeanImages } from '@/lib/coffee-beans/imageRecords';
import type { CoffeeBean } from '@/types/app';

const PACKAGE_TYPE = 'brew-guide/coffee-beans-package';
const PACKAGE_VERSION = 1;
const MANIFEST_FILE_NAME = 'manifest.json';
const PACKAGE_MIME_TYPE = 'application/zip';
const PACKAGE_EXTENSION = '.brewbeans.zip';

type ImageSide = 'image' | 'backImage';

interface CoffeeBeanSharePackageManifestBean extends Omit<
  Partial<CoffeeBean>,
  'image' | 'backImage'
> {
  imageFile?: string;
  backImageFile?: string;
}

interface CoffeeBeanSharePackageManifest {
  type: typeof PACKAGE_TYPE;
  version: typeof PACKAGE_VERSION;
  exportedAt: string;
  beans: CoffeeBeanSharePackageManifestBean[];
}

export interface CoffeeBeanSharePackageResult {
  fileName: string;
  blob: Blob;
  beanCount: number;
}

const DATA_URL_PATTERN = /^data:([^;,]+);base64,(.+)$/;

const SHAREABLE_BEAN_FIELDS = [
  'name',
  'roaster',
  'capacity',
  'remaining',
  'price',
  'roastLevel',
  'roastDate',
  'flavor',
  'notes',
  'startDay',
  'endDay',
  'isFrozen',
  'isInTransit',
  'beanType',
  'beanState',
  'brand',
  'purchaseDate',
  'overallRating',
  'ratingNotes',
  'blendComponents',
] as const satisfies readonly (keyof CoffeeBean)[];

const getImageExtension = (mimeType: string): string => {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return 'bin';
  }
};

const buildPackageFileName = (beanCount: number): string =>
  `brew-guide-beans-${beanCount}-${Date.now()}${PACKAGE_EXTENSION}`;

const toManifestBean = (bean: CoffeeBean): CoffeeBeanSharePackageManifestBean =>
  SHAREABLE_BEAN_FIELDS.reduce<CoffeeBeanSharePackageManifestBean>(
    (result, field) => {
      const value = bean[field];
      if (value !== undefined && value !== null && value !== '') {
        (result as Record<string, unknown>)[field] = value;
      }
      return result;
    },
    {}
  );

const addImageToZip = (
  zip: {
    file: (
      name: string,
      data: string,
      options?: { base64?: boolean }
    ) => unknown;
  },
  bean: CoffeeBean,
  manifestBean: CoffeeBeanSharePackageManifestBean,
  side: ImageSide,
  index: number
) => {
  const dataUrl = bean[side];
  if (!dataUrl) return;

  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) return;

  const [, mimeType, base64Data] = match;
  const suffix = side === 'image' ? 'front' : 'back';
  const imagePath = `images/bean-${index + 1}-${suffix}.${getImageExtension(
    mimeType
  )}`;

  zip.file(imagePath, base64Data, { base64: true });

  if (side === 'image') {
    manifestBean.imageFile = imagePath;
  } else {
    manifestBean.backImageFile = imagePath;
  }
};

const readImageDataUrl = async (
  zip: {
    file: (
      name: string
    ) => { async: (type: 'base64') => Promise<string> } | null;
  },
  imagePath: string | undefined
): Promise<string | undefined> => {
  if (!imagePath) return undefined;

  const imageFile = zip.file(imagePath);
  if (!imageFile) return undefined;

  const base64 = await imageFile.async('base64');
  const extension = imagePath.split('.').pop()?.toLowerCase() || '';
  const mimeType =
    extension === 'jpg'
      ? 'image/jpeg'
      : extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : extension === 'heic'
            ? 'image/heic'
            : extension === 'heif'
              ? 'image/heif'
              : 'application/octet-stream';

  return `data:${mimeType};base64,${base64}`;
};

export async function createCoffeeBeanSharePackage(
  beans: CoffeeBean[],
  selectedBeanIds: string[]
): Promise<CoffeeBeanSharePackageResult> {
  const selectedBeanIdSet = new Set(selectedBeanIds);
  const selectedBeans = beans.filter(bean => selectedBeanIdSet.has(bean.id));

  if (selectedBeans.length === 0) {
    throw new Error('请选择至少一个咖啡豆');
  }

  const [{ default: JSZip }, imageRecords] = await Promise.all([
    import('jszip'),
    db.coffeeBeanImages.bulkGet(selectedBeans.map(bean => bean.id)),
  ]);

  const zip = new JSZip();
  const manifestBeans: CoffeeBeanSharePackageManifestBean[] = [];

  selectedBeans.forEach((bean, index) => {
    const beanWithImages = mergeCoffeeBeanImages(
      bean,
      imageRecords[index] ?? undefined
    );
    const manifestBean = toManifestBean(beanWithImages);

    addImageToZip(zip, beanWithImages, manifestBean, 'image', index);
    addImageToZip(zip, beanWithImages, manifestBean, 'backImage', index);

    manifestBeans.push(manifestBean);
  });

  const manifest: CoffeeBeanSharePackageManifest = {
    type: PACKAGE_TYPE,
    version: PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    beans: manifestBeans,
  };

  zip.file(MANIFEST_FILE_NAME, JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    mimeType: PACKAGE_MIME_TYPE,
  });

  return {
    blob,
    beanCount: selectedBeans.length,
    fileName: buildPackageFileName(selectedBeans.length),
  };
}

export async function readCoffeeBeanSharePackage(
  file: File
): Promise<CoffeeBean[]> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file(MANIFEST_FILE_NAME);

  if (!manifestFile) {
    throw new Error('压缩包缺少咖啡豆清单');
  }

  const manifest = JSON.parse(
    await manifestFile.async('string')
  ) as CoffeeBeanSharePackageManifest;

  if (
    manifest.type !== PACKAGE_TYPE ||
    manifest.version !== PACKAGE_VERSION ||
    !Array.isArray(manifest.beans)
  ) {
    throw new Error('压缩包格式不受支持');
  }

  const beans = await Promise.all(
    manifest.beans.map(async manifestBean => {
      const { imageFile, backImageFile, ...bean } = manifestBean;
      const [image, backImage] = await Promise.all([
        readImageDataUrl(zip, imageFile),
        readImageDataUrl(zip, backImageFile),
      ]);

      return {
        ...bean,
        ...(image ? { image } : {}),
        ...(backImage ? { backImage } : {}),
      } as CoffeeBean;
    })
  );

  if (
    beans.length === 0 ||
    beans.some(bean => !bean.name || typeof bean.name !== 'string')
  ) {
    throw new Error('压缩包中没有有效的咖啡豆数据');
  }

  return beans;
}
