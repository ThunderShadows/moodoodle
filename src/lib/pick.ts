import { MIN_IMAGE_SIDE } from './types';
import { isKeepableUrl } from './urls';

export function pickBestSrc(img: HTMLImageElement): string | null {
  const src = img.currentSrc || img.src;
  return src && isKeepableUrl(src) ? src : null;
}

export function isBigEnough(img: HTMLImageElement): boolean {
  const r = img.getBoundingClientRect();
  return r.width >= MIN_IMAGE_SIDE && r.height >= MIN_IMAGE_SIDE;
}

export function collectImageUrls(doc: Document): string[] {
  const out = new Set<string>();
  for (const img of Array.from(doc.images)) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const src = pickBestSrc(img);
    if (src && w >= MIN_IMAGE_SIDE && h >= MIN_IMAGE_SIDE) out.add(src);
  }
  return [...out];
}
