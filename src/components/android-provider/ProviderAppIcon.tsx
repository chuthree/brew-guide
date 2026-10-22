import { AppWindow } from 'lucide-react';
import { verifiedProviderIcon } from '@/lib/android-provider/permissionPresentation';

export default function ProviderAppIcon({
  iconDataUrl,
  label,
  size = 44,
  className = '',
}: {
  iconDataUrl?: string;
  label: string;
  size?: number;
  className?: string;
}) {
  const source = verifiedProviderIcon(iconDataUrl);
  return source ? (
    // PackageManager-owned data URL, not a remote/request-provided image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={source}
      alt={label}
      width={size}
      height={size}
      className={`shrink-0 rounded-xl object-contain ${className}`}
    />
  ) : (
    <AppWindow
      aria-label={label}
      width={size}
      height={size}
      className={`shrink-0 rounded-xl text-neutral-400 ${className}`}
    />
  );
}
