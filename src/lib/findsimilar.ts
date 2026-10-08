import type { ImageStore } from './db';
import { topSimilar } from './similar';
import { lensUrl } from './urls';
import type { SavedImage } from './types';

export interface SimilarResult {
  center: { imageUrl: string; imageId?: string };
  results: { image: SavedImage; thumb: string; score: number }[];
  /** Some kept images don't have an embedding yet (backfill still running). */
  learning: boolean;
  /** The image itself couldn't be read, so there's nothing to compare. */
  failed?: boolean;
  lensUrl: string | null;
}

export interface FindDeps {
  store: ImageStore;
  /** Embeds an image that isn't in the collection (runs the on-device model). */
  embedUrl(url: string): Promise<Float32Array>;
}

/** Data URL for a blob, without FileReader (not available in service workers). */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

/** Up to 6 look-alikes from the user's own saves, computed on-device. */
export async function findSimilar(deps: FindDeps, imageUrl: string): Promise<SimilarResult> {
  const kept = await deps.store.findByUrl(imageUrl);
  const learning = (await deps.store.missingEmbeddingIds()).length > 0;
  const base = { center: { imageUrl, imageId: kept?.id }, learning, lensUrl: lensUrl(imageUrl) };

  let query: Float32Array | undefined;
  try {
    query = (kept && (await deps.store.getEmbedding(kept.id))) || (await deps.embedUrl(imageUrl));
  } catch {
    return { ...base, results: [], failed: true };
  }

  const scored = topSimilar(query, await deps.store.listEmbeddings(), { exclude: kept?.id });
  const images = new Map((await deps.store.list()).map((i) => [i.id, i]));
  const results: SimilarResult['results'] = [];
  for (const { id, score } of scored) {
    const image = images.get(id);
    const thumb = image && (await deps.store.getThumb(id));
    if (image && thumb) results.push({ image, thumb: await blobToDataUrl(thumb), score });
  }
  return { ...base, results };
}
