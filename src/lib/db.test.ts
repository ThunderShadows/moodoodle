import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openImageStore, normalizeTags, type NewImage } from './db';

function sample(url: string): NewImage {
  return {
    imageUrl: url, pageUrl: 'https://site.com/p', pageTitle: 'Page', site: 'site.com',
    width: 300, height: 200, mimeType: 'image/png', byteSize: 3,
    palette: ['#FFD8C2'], colorFamily: 'orange', tags: [],
  };
}

function freshStore() {
  let t = Date.parse('2026-10-06T10:00:00.000Z');
  return openImageStore(`test-${crypto.randomUUID()}`, () => new Date((t += 1000)));
}

describe('ImageStore', () => {
  it('adds, finds by URL and lists newest first', async () => {
    const store = freshStore();
    const a = await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    const b = await store.add(sample('https://x.com/b.png'), new Blob([new Uint8Array([4])], { type: 'image/png' }));
    expect(a.id).not.toBe(b.id);
    expect(a.savedAt).toBe('2026-10-06T10:00:01.000Z');
    expect((await store.findByUrl('https://x.com/a.png'))?.id).toBe(a.id);
    expect((await store.list()).map((i) => i.id)).toEqual([b.id, a.id]);
  });

  it('round-trips the image bytes and type', async () => {
    const store = freshStore();
    const img = await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    const blob = await store.getBlob(img.id);
    expect(blob?.type).toBe('image/png');
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rejects a second image with the same URL', async () => {
    const store = freshStore();
    await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1])]));
    await expect(store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1])]))).rejects.toThrow();
    expect(await store.list()).toHaveLength(1);
  });

  it('sets normalized tags', async () => {
    const store = freshStore();
    const img = await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1])]));
    await store.setTags(img.id, [' Cute', 'cat ', 'cute', '']);
    expect((await store.findByUrl('https://x.com/a.png'))?.tags).toEqual(['cute', 'cat']);
  });

  it('removes the record and its bytes', async () => {
    const store = freshStore();
    const img = await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1])]));
    await store.remove(img.id);
    expect(await store.list()).toEqual([]);
    expect(await store.getBlob(img.id)).toBeUndefined();
  });
});

describe('normalizeTags', () => {
  it('trims, lowercases, de-duplicates and drops empties', () => {
    expect(normalizeTags([' A ', 'a', 'B', '  '])).toEqual(['a', 'b']);
  });
});
