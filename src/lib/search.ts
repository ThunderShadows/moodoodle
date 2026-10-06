import type { ColorFamily, SavedImage } from './types';

export interface Filter {
  query: string;
  family: ColorFamily | 'all';
}

function haystack(img: SavedImage): string {
  return [img.pageTitle, img.site, img.colorFamily, ...img.tags].join(' ').toLowerCase();
}

export function filterImages(images: SavedImage[], f: Filter): SavedImage[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return images.filter(
    (img) =>
      (f.family === 'all' || img.colorFamily === f.family) &&
      words.every((w) => haystack(img).includes(w)),
  );
}
