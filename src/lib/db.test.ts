import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openImageStore, normalizeTags, type NewImage } from './db';
import { emptyCredit } from './types';

function sample(url: string): NewImage {
  return {
    imageUrl: url, pageUrl: 'https://site.com/p', pageTitle: 'Page', site: 'site.com',
    width: 300, height: 200, mimeType: 'image/png', byteSize: 3,
    palette: ['#FFD8C2'], colorFamily: 'orange', tags: [], boardIds: [], credit: emptyCredit(),
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

describe('thumbnails', () => {
  it('returns the stored thumbnail, and falls back to the full image when there is none', async () => {
    const store = freshStore();
    const full = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
    const thumb = new Blob([new Uint8Array([9])], { type: 'image/webp' });
    const withThumb = await store.add(sample('https://x.com/a.png'), full, thumb);
    const without = await store.add(sample('https://x.com/b.png'), full);
    expect((await store.getThumb(withThumb.id))?.type).toBe('image/webp');
    expect((await store.getThumb(without.id))?.type).toBe('image/png');
  });
  it('removes the thumbnail with the image', async () => {
    const store = freshStore();
    const img = await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1])]), new Blob([new Uint8Array([2])]));
    await store.remove(img.id);
    expect(await store.getThumb(img.id)).toBeUndefined();
  });
  it('opens a collection saved by v1.0 (no thumbnail store) without losing images', async () => {
    const name = `upgrade-${crypto.randomUUID()}`;
    const { openDB } = await import('idb');
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        const images = db.createObjectStore('images', { keyPath: 'id' });
        images.createIndex('byUrl', 'imageUrl', { unique: true });
        images.createIndex('bySavedAt', 'savedAt');
        db.createObjectStore('blobs');
      },
    });
    await v1.put('images', { ...sample('https://x.com/old.png'), id: 'old', savedAt: '2026-10-06T10:00:00.000Z' });
    await v1.put('blobs', { bytes: new Uint8Array([7]).buffer, type: 'image/png' }, 'old');
    v1.close();
    const store = openImageStore(name);
    expect((await store.list()).map((i) => i.id)).toEqual(['old']);
    expect((await store.getThumb('old'))?.type).toBe('image/png');
  });
});

describe('database v3', () => {
  it('upgrades a v1.1 (v2) collection: keeps images, thumbnails and tags, adds boards and empty credits', async () => {
    const name = `v2-${crypto.randomUUID()}`;
    const { openDB } = await import('idb');
    const v2 = await openDB(name, 2, {
      upgrade(db) {
        const images = db.createObjectStore('images', { keyPath: 'id' });
        images.createIndex('byUrl', 'imageUrl', { unique: true });
        images.createIndex('bySavedAt', 'savedAt');
        db.createObjectStore('blobs');
        db.createObjectStore('thumbs');
      },
    });
    const { boardIds: _b, credit: _c, ...legacy } = sample('https://x.com/old.png');
    await v2.put('images', { ...legacy, id: 'old', savedAt: '2026-10-06T10:00:00.000Z', tags: ['cat'] });
    await v2.put('thumbs', { bytes: new Uint8Array([9]).buffer, type: 'image/webp' }, 'old');
    v2.close();

    const store = openImageStore(name);
    const [img] = await store.list();
    expect(img).toMatchObject({ id: 'old', tags: ['cat'], boardIds: [], credit: emptyCredit() });
    expect((await store.getThumb('old'))?.type).toBe('image/webp');
    expect(await store.listBoards()).toEqual([]);
  });
});

describe('boards in the store', () => {
  it('creates, renames, recolors and lists boards in creation order', async () => {
    const store = freshStore();
    const a = await store.createBoard('Ocean study', 'sky');
    const b = await store.createBoard('Plants', 'mint');
    await store.updateBoard(a.id, { name: 'Ocean refs', color: 'lilac' });
    expect((await store.listBoards()).map((x) => [x.name, x.color])).toEqual([['Ocean refs', 'lilac'], ['Plants', 'mint']]);
    expect((await store.getBoard(b.id))?.name).toBe('Plants');
  });
  it('refuses duplicate names on create and rename', async () => {
    const store = freshStore();
    const a = await store.createBoard('Ocean', 'sky');
    await store.createBoard('Plants', 'mint');
    await expect(store.createBoard(' ocean ', 'peach')).rejects.toMatchObject({ reason: 'duplicate' });
    await expect(store.updateBoard(a.id, { name: 'PLANTS' })).rejects.toMatchObject({ reason: 'duplicate' });
  });
  it('adds to and removes from boards; one image can be in several', async () => {
    const store = freshStore();
    const img = await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1])]));
    const a = await store.createBoard('A', 'peach');
    const b = await store.createBoard('B', 'mint');
    await store.addToBoard([img.id], a.id);
    await store.addToBoard([img.id], a.id);
    await store.addToBoard([img.id], b.id);
    expect((await store.findByUrl('https://x.com/a.png'))?.boardIds).toEqual([a.id, b.id]);
    await store.removeFromBoard([img.id], a.id);
    expect((await store.findByUrl('https://x.com/a.png'))?.boardIds).toEqual([b.id]);
  });
  it('deleting a board keeps its images and removes the board from them', async () => {
    const store = freshStore();
    const img = await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1])]));
    const a = await store.createBoard('A', 'peach');
    await store.addToBoard([img.id], a.id);
    await store.deleteBoard(a.id);
    expect(await store.listBoards()).toEqual([]);
    const after = await store.list();
    expect(after).toHaveLength(1);
    expect(after[0]?.boardIds).toEqual([]);
  });
});
