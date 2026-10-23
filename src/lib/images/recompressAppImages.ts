import { withDataMutation } from '@/lib/data/mutationCoordinator';
import {
  registerCoordinatedAction,
  callStoreActionInMutation,
} from '@/lib/data/storeMutationBoundary';
import { imageMaintenance } from '@/lib/data/repositories';
import {
  mergeImageRecompressionStats,
  type ImageRecompressionStats,
} from '@/lib/images/imageRecompression';
import { recompressOversizedRoasterLogos } from '@/lib/settings/roasterLogoRecompression';

export interface RecompressAppImagesStats extends ImageRecompressionStats {
  scopes: {
    brewingNotes: ImageRecompressionStats;
    coffeeBeans: ImageRecompressionStats;
    roasterLogos: ImageRecompressionStats;
  };
}

async function recompressAppImagesInMutation(): Promise<RecompressAppImagesStats> {
  const brewingNotes = await imageMaintenance.recompressBrewingNoteImages();
  const coffeeBeans = await imageMaintenance.recompressCoffeeBeanImages();
  const roasterLogos = await callStoreActionInMutation(
    recompressOversizedRoasterLogos
  );
  const total = mergeImageRecompressionStats([
    brewingNotes,
    coffeeBeans,
    roasterLogos,
  ]);

  return {
    ...total,
    scopes: {
      brewingNotes,
      coffeeBeans,
      roasterLogos,
    },
  };
}

export const recompressOversizedAppImages = registerCoordinatedAction(
  () => withDataMutation(recompressAppImagesInMutation),
  recompressAppImagesInMutation
);
