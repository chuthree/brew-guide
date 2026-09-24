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

export async function recompressOversizedAppImages(): Promise<RecompressAppImagesStats> {
  const brewingNotes = await imageMaintenance.recompressBrewingNoteImages();
  const coffeeBeans = await imageMaintenance.recompressCoffeeBeanImages();
  const roasterLogos = await recompressOversizedRoasterLogos();
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
