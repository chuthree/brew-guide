'use client';

import Image from 'next/image';
import { useGroupQr } from '@/lib/groupQr/useGroupQr';

export function SettingsQrCode({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}) {
  return (
    <div className="flex flex-col items-start justify-center pb-3.5 pl-10.5">
      <div className="overflow-hidden rounded-lg border border-neutral-400/10 bg-white p-2">
        <Image
          src={src}
          alt={alt}
          width={200}
          height={200}
          className="h-auto w-50"
        />
      </div>
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {caption}
      </p>
    </div>
  );
}

export function GroupQrContent({ active }: { active: boolean }) {
  const groupQr = useGroupQr(active);
  return (
    <SettingsQrCode
      src={groupQr?.imageDataUrl ?? '/images/content/group-code.jpg'}
      alt={groupQr ? '交流群二维码' : '开发者小号二维码'}
      caption={groupQr ? '交流群，欢迎加入～～～' : '群满 200 人了，加开发者小号拉你进群吧'}
    />
  );
}
