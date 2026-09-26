import { coffeeBeanImageRepository } from '@/lib/data/repositories';
import { mergeCoffeeBeanImages } from '@/lib/coffee-beans/imageRecords';
import {
  decodeImageDataUrl,
  decodeRawBase64,
  encodeImageDataUrl,
  encodeRawBase64,
} from '@/lib/data/images/imageBinary';
import {
  classifyPersistentImageString,
  validateExternalImageUrl,
} from '@/lib/data/images/persistentImageSource';
import type { CoffeeBean } from '@/types/app';

const PACKAGE_TYPE = 'brew-guide/coffee-beans-package';
const PACKAGE_VERSION = 2;
const LEGACY_PACKAGE_VERSION = 1;
const MANIFEST_FILE_NAME = 'manifest.json';
const PACKAGE_MIME_TYPE = 'application/zip';
const PACKAGE_EXTENSION = '.brewbeans.zip';

type ImageSide = 'image' | 'backImage';
type ImageDescriptorV2 =
  | { kind: 'file'; path: string; mimeType: string }
  | { kind: 'external'; url: string };

type CoffeeBeanSharePackageManifestBeanFields = Omit<
  Partial<CoffeeBean>,
  'image' | 'backImage'
>;

interface CoffeeBeanSharePackageManifestBeanV1 extends CoffeeBeanSharePackageManifestBeanFields {
  imageFile?: string;
  backImageFile?: string;
}

interface CoffeeBeanSharePackageManifestBeanV2 extends CoffeeBeanSharePackageManifestBeanFields {
  image?: ImageDescriptorV2;
  backImage?: ImageDescriptorV2;
}

interface CoffeeBeanSharePackageManifestV1 {
  type: typeof PACKAGE_TYPE;
  version: typeof LEGACY_PACKAGE_VERSION;
  exportedAt: string;
  beans: CoffeeBeanSharePackageManifestBeanV1[];
}

interface CoffeeBeanSharePackageManifestV2 {
  type: typeof PACKAGE_TYPE;
  version: typeof PACKAGE_VERSION;
  exportedAt: string;
  beans: CoffeeBeanSharePackageManifestBeanV2[];
}

export interface CoffeeBeanSharePackageResult {
  fileName: string;
  blob: Blob;
  beanCount: number;
}

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

const detectLegacyShareImageMimeType = (
  bytes: Uint8Array
): string | undefined => {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  return undefined;
};

const buildPackageFileName = (beanCount: number): string =>
  `brew-guide-beans-${beanCount}-${Date.now()}${PACKAGE_EXTENSION}`;

const toManifestBean = (
  bean: CoffeeBean
): CoffeeBeanSharePackageManifestBeanFields =>
  SHAREABLE_BEAN_FIELDS.reduce<CoffeeBeanSharePackageManifestBeanFields>(
    (result, field) => {
      const value = bean[field];
      if (value !== undefined && value !== null && value !== '') {
        (result as Record<string, unknown>)[field] = value;
      }
      return result;
    },
    {}
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertSafeArchiveImagePath = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !value.startsWith('images/') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value.split('/').some(part => part === '' || part === '.' || part === '..')
  ) {
    throw new Error('压缩包中的图片路径无效');
  }
  return value;
};

const addImageToZip = (
  zip: {
    file: (
      name: string,
      data: string,
      options?: { base64?: boolean }
    ) => unknown;
  },
  bean: CoffeeBean,
  manifestBean: CoffeeBeanSharePackageManifestBeanV2,
  side: ImageSide,
  index: number
): void => {
  const candidate: unknown = bean[side];
  if (candidate === undefined || candidate === null || candidate === '') return;
  if (typeof candidate !== 'string') {
    throw new TypeError(
      `咖啡豆${side === 'image' ? '正面' : '背面'}图片格式无效`
    );
  }

  const source = classifyPersistentImageString(candidate);
  if (source.kind === 'external') {
    manifestBean[side] = { kind: 'external', url: source.url };
    return;
  }

  const suffix = side === 'image' ? 'front' : 'back';
  const imagePath = `images/bean-${index + 1}-${suffix}.${getImageExtension(
    source.binary.mimeType
  )}`;
  zip.file(imagePath, encodeRawBase64(source.binary.bytes), { base64: true });
  manifestBean[side] = {
    kind: 'file',
    path: imagePath,
    mimeType: source.binary.mimeType,
  };
};

const readLegacyImageDataUrl = async (
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
  const extensionMimeType =
    extension === 'jpg'
      ? 'image/jpeg'
      : extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'png'
          ? 'image/png'
          : extension === 'webp'
            ? 'image/webp'
            : extension === 'heic'
              ? 'image/heic'
              : extension === 'heif'
                ? 'image/heif'
                : undefined;

  const bytes = decodeRawBase64(base64);
  const mimeType = extensionMimeType ?? detectLegacyShareImageMimeType(bytes);
  if (!mimeType) {
    throw new Error(
      'Unable to determine image format from legacy share package'
    );
  }
  return encodeImageDataUrl({ mimeType, bytes });
};

const readV2ImageSource = async (
  zip: {
    file: (
      name: string
    ) => { async: (type: 'base64') => Promise<string> } | null;
  },
  value: unknown,
  usedEmbeddedPaths: Set<string>
): Promise<string | undefined> => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error('压缩包中的图片来源无效');

  if (value.kind === 'external') {
    if (
      Object.keys(value).some(key => key !== 'kind' && key !== 'url') ||
      typeof value.url !== 'string'
    ) {
      throw new Error('压缩包中的外部图片引用无效');
    }
    return validateExternalImageUrl(value.url);
  }

  if (value.kind !== 'file') {
    throw new Error('压缩包中的图片来源类型不受支持');
  }
  if (
    Object.keys(value).some(
      key => key !== 'kind' && key !== 'path' && key !== 'mimeType'
    ) ||
    typeof value.mimeType !== 'string'
  ) {
    throw new Error('压缩包中的图片文件描述无效');
  }

  const imagePath = assertSafeArchiveImagePath(value.path);
  if (usedEmbeddedPaths.has(imagePath)) {
    throw new Error('压缩包中的图片文件路径重复');
  }
  usedEmbeddedPaths.add(imagePath);
  const imageFile = zip.file(imagePath);
  if (!imageFile) throw new Error('压缩包缺少清单中引用的图片文件');

  const dataUrl = `data:${value.mimeType};base64,${await imageFile.async('base64')}`;
  return encodeImageDataUrl(decodeImageDataUrl(dataUrl));
};

const readV1Bean = async (
  zip: Parameters<typeof readLegacyImageDataUrl>[0],
  value: unknown
): Promise<CoffeeBean> => {
  if (!isRecord(value)) throw new Error('压缩包中的咖啡豆数据无效');
  const { imageFile, backImageFile, ...bean } =
    value as CoffeeBeanSharePackageManifestBeanV1;
  const [image, backImage] = await Promise.all([
    readLegacyImageDataUrl(zip, imageFile),
    readLegacyImageDataUrl(zip, backImageFile),
  ]);

  return {
    ...bean,
    ...(image ? { image } : {}),
    ...(backImage ? { backImage } : {}),
  } as CoffeeBean;
};

const readV2Bean = async (
  zip: Parameters<typeof readV2ImageSource>[0],
  value: unknown,
  usedEmbeddedPaths: Set<string>
): Promise<CoffeeBean> => {
  if (!isRecord(value)) throw new Error('压缩包中的咖啡豆数据无效');
  const { image, backImage, ...bean } =
    value as CoffeeBeanSharePackageManifestBeanV2;
  const [front, back] = await Promise.all([
    readV2ImageSource(zip, image, usedEmbeddedPaths),
    readV2ImageSource(zip, backImage, usedEmbeddedPaths),
  ]);

  return {
    ...bean,
    ...(front !== undefined ? { image: front } : {}),
    ...(back !== undefined ? { backImage: back } : {}),
  } as CoffeeBean;
};

const validateImportedBeans = (beans: CoffeeBean[]): CoffeeBean[] => {
  if (
    beans.length === 0 ||
    beans.some(bean => !bean.name || typeof bean.name !== 'string')
  ) {
    throw new Error('压缩包中没有有效的咖啡豆数据');
  }
  return beans;
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
    coffeeBeanImageRepository.getRecords(selectedBeans.map(bean => bean.id)),
  ]);

  const zip = new JSZip();
  const manifestBeans: CoffeeBeanSharePackageManifestBeanV2[] = [];
  const imageRecordByBeanId = new Map(
    imageRecords.map(record => [record.beanId, record])
  );

  selectedBeans.forEach((bean, index) => {
    const beanWithImages = mergeCoffeeBeanImages(
      bean,
      imageRecordByBeanId.get(bean.id)
    );
    const manifestBean: CoffeeBeanSharePackageManifestBeanV2 =
      toManifestBean(beanWithImages);

    addImageToZip(zip, beanWithImages, manifestBean, 'image', index);
    addImageToZip(zip, beanWithImages, manifestBean, 'backImage', index);
    manifestBeans.push(manifestBean);
  });

  const manifest: CoffeeBeanSharePackageManifestV2 = {
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
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manifestFile = zip.file(MANIFEST_FILE_NAME);

  if (!manifestFile) {
    throw new Error('压缩包缺少咖啡豆清单');
  }

  const parsed: unknown = JSON.parse(await manifestFile.async('string'));
  if (
    !isRecord(parsed) ||
    parsed.type !== PACKAGE_TYPE ||
    !Array.isArray(parsed.beans)
  ) {
    throw new Error('压缩包格式不受支持');
  }

  let beans: CoffeeBean[];
  if (parsed.version === LEGACY_PACKAGE_VERSION) {
    const manifest = parsed as unknown as CoffeeBeanSharePackageManifestV1;
    beans = await Promise.all(
      manifest.beans.map(bean => readV1Bean(zip, bean))
    );
  } else if (parsed.version === PACKAGE_VERSION) {
    const manifest = parsed as unknown as CoffeeBeanSharePackageManifestV2;
    const usedEmbeddedPaths = new Set<string>();
    beans = await Promise.all(
      manifest.beans.map(bean => readV2Bean(zip, bean, usedEmbeddedPaths))
    );
  } else {
    throw new Error('压缩包格式不受支持');
  }

  return validateImportedBeans(beans);
}
