import { describe, it, expect } from 'vitest';
import { filterImages } from './search';
import type { SavedImage } from './types';

const img = (id: string, over: Partial<SavedImage>): SavedImage => ({
  id, imageUrl: `https://x.com/${id}.png`, pageUrl: 'https://x.com', pageTitle: 'Untitled', site: 'x.com',
  savedAt: '2026-10-06T10:00:00.000Z', width: 1, height: 1, mimeType: 'image/png', byteSize: 1,
  palette: [], colorFamily: 'neutral', tags: [], ...over,
});

const all = [
  img('1', { pageTitle: 'Spring Doodles', site: 'dribbble.com', colorFamily: 'orange', tags: ['floral'] }),
  img('2', { pageTitle: 'Cat sketches', site: 'behance.net', colorFamily: 'purple', tags: ['cat', 'cute'] }),
  img('3', { pageTitle: 'Sun', site: 'etsy.com', colorFamily: 'yellow', tags: [] }),
];

describe('filterImages', () => {
  it('returns everything for an empty query and "all"', () => {
    expect(filterImages(all, { query: '', family: 'all' })).toHaveLength(3);
  });
  it('filters by color family', () => {
    expect(filterImages(all, { query: '', family: 'purple' }).map((i) => i.id)).toEqual(['2']);
  });
  it('matches title, site, tags and color name, case-insensitively', () => {
    expect(filterImages(all, { query: 'DOODLES', family: 'all' }).map((i) => i.id)).toEqual(['1']);
    expect(filterImages(all, { query: 'etsy', family: 'all' }).map((i) => i.id)).toEqual(['3']);
    expect(filterImages(all, { query: 'cute', family: 'all' }).map((i) => i.id)).toEqual(['2']);
    expect(filterImages(all, { query: 'yellow', family: 'all' }).map((i) => i.id)).toEqual(['3']);
  });
  it('requires every word to match', () => {
    expect(filterImages(all, { query: 'cat floral', family: 'all' })).toEqual([]);
    expect(filterImages(all, { query: '  cat   cute ', family: 'all' }).map((i) => i.id)).toEqual(['2']);
  });
});
