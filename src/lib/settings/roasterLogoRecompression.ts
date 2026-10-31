import { withDataMutation } from '@/lib/data/mutationCoordinator';
import {
  registerCoordinatedAction,
  callStoreActionInMutation,
} from '@/lib/data/storeMutationBoundary';
import {
  ROASTER_LOGO_COMPRESSION_OPTIONS,
  ROASTER_LOGO_MAX_SIZE_BYTES,
} from '@/lib/images/imageProcessing';
import {
  applyImageRecompressionResultToStats,
  createImageRecompressionStats,
  recompressStoredImage,
  type ImageRecompressionStats,
} from '@/lib/images/imageRecompression';
import { getSettingsStore } from '@/lib/stores/settingsStore';
import type { RoasterConfig } from '@/lib/data/models';

export type RecompressRoasterLogosStats = ImageRecompressionStats;

const ROASTER_LOGO_RECOMPRESSION_PROFILE = {
  maxSizeBytes: ROASTER_LOGO_MAX_SIZE_BYTES,
  compression: ROASTER_LOGO_COMPRESSION_OPTIONS,
};

async function recompressRoasterLogosInMutation(): Promise<RecompressRoasterLogosStats> {
  const stats = createImageRecompressionStats();
  const settingsStore = getSettingsStore();
  const roasterConfigs = settingsStore.settings.roasterConfigs || [];
  let changed = false;

  const nextConfigs: RoasterConfig[] = [];
  for (const config of roasterConfigs) {
    if (!config.logoData) {
      nextConfigs.push(config);
      continue;
    }

    stats.scannedCount += 1;
    const result = await recompressStoredImage(
      config.logoData,
      ROASTER_LOGO_RECOMPRESSION_PROFILE
    );
    applyImageRecompressionResultToStats(stats, result);

    if (result.failed) {
      console.error('烘焙商 Logo 补压失败:', {
        roasterName: config.roasterName,
        error: result.error,
      });
    }

    if (result.changed) {
      changed = true;
      nextConfigs.push({
        ...config,
        logoData: result.image,
        logoUpdatedAt: Math.max(Date.now(), (config.logoUpdatedAt ?? 0) + 1),
        updatedAt: Date.now(),
      });
      continue;
    }

    nextConfigs.push(config);
  }

  if (changed) {
    await callStoreActionInMutation(settingsStore.updateSettings, {
      roasterConfigs: nextConfigs,
    });
  }

  return stats;
}

export const recompressOversizedRoasterLogos = registerCoordinatedAction(
  () => withDataMutation(recompressRoasterLogosInMutation),
  recompressRoasterLogosInMutation
);
