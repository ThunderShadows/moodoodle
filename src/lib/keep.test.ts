import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { keepImage, keepMany, siteOf, type KeepDeps } from './keep';
import { openImageStore } from './db';

const PNG = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
const peachPixels = new Uint8ClampedArray([255, 216, 194, 255, 255, 216, 194, 255]);

function deps(over: Partial<KeepDeps> = {}): KeepDeps {
  return {
    store: openImageStore(`keep-${crypto.randomUUID()}`),
    fetchImage: vi.fn(async () => ({ blob: PNG() })),
    decode: vi.fn(async () => ({ width: 640, height: 480, pixels: peachPixels })),
    ...over,
  };
}
const input = { imageUrl: 'https://cdn.site.com/flower.png', pageUrl: 'https://www.site.com/post', pageTitle: 'Spring doodles' };

describe('keepImage', () => {
  it('keeps an image with palette, family, site and size', async () => {
    const d = deps();
    const r = await keepImage(d, input);
    expect(r.status).toBe('kept');
    if (r.status !== 'kept') return;
    expect(r.image).toMatchObject({
      imageUrl: input.imageUrl, site: 'site.com', pageTitle: 'Spring doodles',
      width: 640, height: 480, mimeType: 'image/png', byteSize: 4,
      palette: ['#FFD8C2'], colorFamily: 'orange', tags: [],
    });
    expect(await d.store.list()).toHaveLength(1);
  });

  it('falls back to the site when the page title is blank', async () => {
    const r = await keepImage(deps(), { ...input, pageTitle: '   ' });
    expect(r.status === 'kept' && r.image.pageTitle).toBe('site.com');
  });

  it('rejects unsupported URLs without fetching', async () => {
    const d = deps();
    expect(await keepImage(d, { ...input, imageUrl: 'blob:https://site.com/1' })).toEqual({ status: 'error', reason: 'unsupported-url' });
    expect(d.fetchImage).not.toHaveBeenCalled();
  });

  it('returns duplicate without fetching again', async () => {
    const d = deps();
    await keepImage(d, input);
    const r = await keepImage(d, input);
    expect(r.status).toBe('duplicate');
    expect(d.fetchImage).toHaveBeenCalledTimes(1);
  });

  it('keeps only one copy when two keeps race', async () => {
    const d = deps();
    const [a, b] = await Promise.all([keepImage(d, input), keepImage(d, input)]);
    expect([a.status, b.status].sort()).toEqual(['duplicate', 'kept']);
    expect(await d.store.list()).toHaveLength(1);
  });

  it('reports a blocked download and saves nothing', async () => {
    const d = deps({ fetchImage: vi.fn(async () => { throw new Error('403'); }) });
    expect(await keepImage(d, input)).toEqual({ status: 'error', reason: 'fetch-failed' });
    expect(await d.store.list()).toEqual([]);
  });

  it('rejects non-image responses', async () => {
    const d = deps({ fetchImage: vi.fn(async () => ({ blob: new Blob(['<html>'], { type: 'text/html' }) })) });
    expect(await keepImage(d, input)).toEqual({ status: 'error', reason: 'not-an-image' });
  });

  it('rejects images over the size limit', async () => {
    const d = deps({ maxBytes: 3 });
    expect(await keepImage(d, input)).toEqual({ status: 'error', reason: 'too-big' });
  });

  it('reports formats it cannot decode', async () => {
    const d = deps({ decode: vi.fn(async () => { throw new Error('svg'); }) });
    expect(await keepImage(d, input)).toEqual({ status: 'error', reason: 'decode-failed' });
    expect(await d.store.list()).toEqual([]);
  });
});

describe('siteOf', () => {
  it('strips www and handles bad URLs', () => {
    expect(siteOf('https://www.dribbble.com/x')).toBe('dribbble.com');
    expect(siteOf('nope')).toBe('');
  });
});

describe('keepMany', () => {
  it('counts kept and skipped, and keeps going when one image hits a storage error', async () => {
    const real = deps();
    const store = {
      ...real.store,
      add: vi.fn(async (input: Parameters<typeof real.store.add>[0], blob: Blob) => {
        if (input.imageUrl.endsWith('/broken.png')) throw new Error('QuotaExceededError');
        return real.store.add(input, blob);
      }),
    };
    const d = { ...real, store };
    const res = await keepMany(d, {
      imageUrls: ['https://a.com/1.png', 'https://a.com/broken.png', 'blob:x', 'https://a.com/1.png', 'https://a.com/2.png'],
      pageUrl: 'https://a.com/p',
      pageTitle: 'P',
    });
    expect(res).toEqual({ kept: 2, skipped: 3 });
  });
});

describe('keepImage thumbnails', () => {
  it('stores the thumbnail the decoder produced', async () => {
    const thumb = new Blob([new Uint8Array([5])], { type: 'image/webp' });
    const d = deps({ decode: vi.fn(async () => ({ width: 640, height: 480, pixels: peachPixels, thumb })) });
    const r = await keepImage(d, input);
    expect(r.status).toBe('kept');
    if (r.status !== 'kept') return;
    expect((await d.store.getThumb(r.image.id))?.type).toBe('image/webp');
  });
});

describe('keeping into a board', () => {
  it('puts a new keep into the board and reports its name', async () => {
    const d = deps();
    const board = await d.store.createBoard('Ocean', 'sky');
    const r = await keepImage(d, { ...input, board });
    expect(r).toMatchObject({ status: 'kept', boardName: 'Ocean' });
    expect(r.status === 'kept' && r.image.boardIds).toEqual([board.id]);
  });
  it('adds an already-kept image to the board instead of failing', async () => {
    const d = deps();
    await keepImage(d, input);
    const board = await d.store.createBoard('Ocean', 'sky');
    const r = await keepImage(d, { ...input, board });
    expect(r).toMatchObject({ status: 'duplicate', boardName: 'Ocean', addedToBoard: true });
    expect((await d.store.findByUrl(input.imageUrl))?.boardIds).toEqual([board.id]);
    expect(await keepImage(d, { ...input, board })).toMatchObject({ status: 'duplicate', addedToBoard: false });
  });
  it('keepMany files every new keep into the board', async () => {
    const d = deps();
    const board = await d.store.createBoard('Ocean', 'sky');
    await keepMany(d, { imageUrls: ['https://a.com/1.png', 'https://a.com/2.png'], pageUrl: 'https://a.com', pageTitle: 'A', board });
    expect((await d.store.list()).every((i) => i.boardIds[0] === board.id)).toBe(true);
  });
});

describe('keeping with credit', () => {
  const xmpPng = () => new Blob([
    new Uint8Array([137, 80, 78, 71]),
    '<x:xmpmeta><rdf:RDF><rdf:Description><dc:rights><rdf:Alt><rdf:li>© Jane</rdf:li></rdf:Alt></dc:rights>'
      + '<cc:license rdf:resource="https://creativecommons.org/licenses/by-nc/4.0/"/></rdf:Description></rdf:RDF></x:xmpmeta>',
  ], { type: 'image/png' });

  it('stores credit merged from the page and the file', async () => {
    const d = deps({ fetchImage: vi.fn(async () => ({ blob: xmpPng() })) });
    const r = await keepImage(d, { ...input, pageCredit: { jsonLd: { creator: 'Jane Doe', creatorUrl: 'https://x.com/jane' }, noAI: false } });
    expect(r.status === 'kept' && r.image.credit).toMatchObject({
      creator: 'Jane Doe', creatorUrl: 'https://x.com/jane', copyrightNotice: '© Jane',
      license: { kind: 'cc', code: 'by-nc' }, confidence: 'stated',
      fieldSources: { creator: 'json-ld', license: 'xmp' },
    });
    expect((await d.store.findByUrl(input.imageUrl))?.credit.creator).toBe('Jane Doe');
  });

  it('marks the image NoAI when the image response says so', async () => {
    const d = deps({ fetchImage: vi.fn(async () => ({ blob: PNG(), robots: 'noindex, noai' })) });
    const r = await keepImage(d, input);
    expect(r.status === 'kept' && r.image.credit.noAI).toBe(true);
  });

  it('keepMany uses each image\'s own page credit', async () => {
    const d = deps();
    await keepMany(d, {
      imageUrls: ['https://a.com/1.png', 'https://a.com/2.png'], pageUrl: 'https://a.com', pageTitle: 'A',
      pageCredits: { 'https://a.com/2.png': { jsonLd: { creator: 'Two' }, noAI: false } },
    });
    const byUrl = Object.fromEntries((await d.store.list()).map((i) => [i.imageUrl, i.credit.creator]));
    expect(byUrl).toEqual({ 'https://a.com/1.png': undefined, 'https://a.com/2.png': 'Two' });
  });
});
