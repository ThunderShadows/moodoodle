import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildZip, fileNameFor, slugify } from './zip';
import type { SavedImage } from './types';

const img = (over: Partial<SavedImage>): SavedImage => ({
  id: 'a', imageUrl: 'https://x.com/a.png', pageUrl: 'https://x.com/p', pageTitle: 'Spring Doodles',
  site: 'x.com', savedAt: '2026-10-06T10:00:00.000Z', width: 1, height: 1, mimeType: 'image/png',
  byteSize: 1, palette: [], colorFamily: 'neutral', tags: [], ...over,
});

describe('slugify', () => {
  it('makes safe, readable names', () => {
    expect(slugify('Spring Doodles!')).toBe('spring-doodles');
    expect(slugify('Café / Crème 🌸 art')).toBe('cafe-creme-art');
    expect(slugify('x'.repeat(200))).toHaveLength(60);
    expect(slugify('🌸🌸')).toBe('');
  });
});

describe('fileNameFor', () => {
  it('uses title, extension from mime type, and numbers collisions', () => {
    const used = new Set<string>();
    expect(fileNameFor(img({}), used)).toBe('spring-doodles.png');
    expect(fileNameFor(img({}), used)).toBe('spring-doodles-2.png');
    expect(fileNameFor(img({ mimeType: 'image/jpeg' }), used)).toBe('spring-doodles.jpg');
  });
  it('falls back to site, then "image", and to .img for unknown types', () => {
    const used = new Set<string>();
    expect(fileNameFor(img({ pageTitle: '🌸' }), used)).toBe('x-com.png');
    expect(fileNameFor(img({ pageTitle: '', site: '', mimeType: 'image/x-weird' }), used)).toBe('image.img');
  });
});

describe('buildZip', () => {
  it('contains every image and a sources.txt when asked', async () => {
    const zipBlob = await buildZip(
      [
        { image: img({}), blob: new Blob([new Uint8Array([1])], { type: 'image/png' }) },
        { image: img({ imageUrl: 'https://x.com/b.png' }), blob: new Blob([new Uint8Array([2])], { type: 'image/png' }) },
      ],
      true,
    );
    expect(zipBlob.type).toBe('application/zip');
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(['sources.txt', 'spring-doodles-2.png', 'spring-doodles.png']);
    const sources = await zip.file('sources.txt')!.async('string');
    expect(sources.split('\n')).toEqual([
      'file\tpage\timage',
      'spring-doodles.png\thttps://x.com/p\thttps://x.com/a.png',
      'spring-doodles-2.png\thttps://x.com/p\thttps://x.com/b.png',
    ]);
  });
  it('omits sources.txt when not asked', async () => {
    const zipBlob = await buildZip([{ image: img({}), blob: new Blob([new Uint8Array([1])]) }], false);
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(Object.keys(zip.files)).toEqual(['spring-doodles.png']);
  });
});
