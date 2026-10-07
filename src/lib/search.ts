import { BADGE_LABEL, badgeFor, licenseLabel } from './license';
import type { ColorFamily, SavedImage } from './types';

export interface Filter {
  query: string;
  family: ColorFamily | 'all';
  /** 'all' (default), 'unsorted' (in no board), or a board id. */
  board?: 'all' | 'unsorted' | string;
}

function inBoard(img: SavedImage, board: Filter['board']): boolean {
  if (!board || board === 'all') return true;
  if (board === 'unsorted') return img.boardIds.length === 0;
  return img.boardIds.includes(board);
}

function haystack(img: SavedImage): string {
  const c = img.credit;
  return [img.pageTitle, img.site, img.colorFamily, ...img.tags, c.creator ?? '', c.title ?? '', licenseLabel(c.license), BADGE_LABEL[badgeFor(c.license)]]
    .join(' ')
    .toLowerCase();
}

export function filterImages(images: SavedImage[], f: Filter): SavedImage[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return images.filter(
    (img) =>
      inBoard(img, f.board) &&
      (f.family === 'all' || img.colorFamily === f.family) &&
      words.every((w) => haystack(img).includes(w)),
  );
}
