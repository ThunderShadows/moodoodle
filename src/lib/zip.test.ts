import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildZip, buildCreditsMd, fileNameFor, slugify } from './zip';
import { emptyCredit, type SavedImage } from './types';

const img = (over: Partial<SavedImage>): SavedImage => ({
  id: 'a', imageUrl: 'https://x.com/a.png', pageUrl: 'https://x.com/p', pageTitle: 'Spring Doodles',
  site: 'x.com', savedAt: '2026-10-06T10:00:00.000Z', width: 1, height: 1, mimeType: 'image/png',
  byteSize: 1, palette: [], colorFamily: 'neutral', tags: [], boardIds: [], credit: emptyCredit(), ...over,
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

describe('buildCreditsMd', () => {
  it('writes a TASL entry per file, with an honest default when nothing is stated', () => {
    const known = img({
      pageTitle: 'Page', imageUrl: 'https://x.com/flower.png', pageUrl: 'https://x.com/post',
      credit: { ...emptyCredit(), title: 'Flower study', creator: 'Jane Doe', creatorUrl: 'https://x.com/jane',
        license: { kind: 'cc', code: 'by', version: '4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }, confidence: 'stated' },
    });
    const unknown = img({ pageTitle: 'Ocean', pageUrl: 'https://x.com/ocean' });
    expect(buildCreditsMd([{ name: 'flower-study.png', image: known }, { name: 'ocean.png', image: unknown }])).toBe([
      '# Credits',
      '',
      '## flower-study.png',
      '- **Title:** Flower study',
      '- **Creator:** Jane Doe (https://x.com/jane)',
      '- **Source:** https://x.com/post',
      '- **License:** CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)',
      '- **Credit line:** “Flower study” by Jane Doe, CC BY 4.0',
      '',
      '## ocean.png',
      '- **Title:** Ocean',
      '- **Creator:** unknown',
      '- **Source:** https://x.com/ocean',
      '- **License:** not stated, treat as all rights reserved (reference only)',
      '',
    ].join('\n'));
  });
});

describe('buildZip', () => {
  it('contains every image and a CREDITS.md when asked', async () => {
    const zipBlob = await buildZip(
      [
        { image: img({}), blob: new Blob([new Uint8Array([1])], { type: 'image/png' }) },
        { image: img({ imageUrl: 'https://x.com/b.png' }), blob: new Blob([new Uint8Array([2])], { type: 'image/png' }) },
      ],
      true,
    );
    expect(zipBlob.type).toBe('application/zip');
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(['CREDITS.md', 'spring-doodles-2.png', 'spring-doodles.png']);
    const credits = await zip.file('CREDITS.md')!.async('string');
    expect(credits).toContain('## spring-doodles.png');
    expect(credits).toContain('## spring-doodles-2.png');
  });
  it('omits CREDITS.md when not asked', async () => {
    const zipBlob = await buildZip([{ image: img({}), blob: new Blob([new Uint8Array([1])]) }], false);
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(Object.keys(zip.files)).toEqual(['spring-doodles.png']);
  });
});
