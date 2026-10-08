import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { findSimilar } from './findsimilar';
import { openImageStore, type NewImage } from './db';
import { normalize } from './similar';
import { emptyCredit } from './types';

const sample = (url: string): NewImage => ({
  imageUrl: url, pageUrl: 'https://site.com/p', pageTitle: 'P', site: 'site.com', width: 1, height: 1,
  mimeType: 'image/png', byteSize: 1, palette: [], colorFamily: 'orange', tags: [], boardIds: [], credit: emptyCredit(),
});
const vec = (...xs: number[]) => normalize(Float32Array.from(xs));
const png = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });

async function setup() {
  const store = openImageStore(`fs-${crypto.randomUUID()}`);
  const ids: Record<string, string> = {};
  for (const [name, v] of [['query', vec(1, 0, 0)], ['near', vec(0.9, 0.1, 0)], ['mid', vec(0.6, 0.6, 0)], ['far', vec(0, 0, 1)]] as const) {
    const img = await store.add(sample(`https://site.com/${name}.png`), png());
    ids[name] = img.id;
    await store.setEmbedding(img.id, v);
  }
  return { store, ids };
}

describe('findSimilar', () => {
  it('ranks your other saves for a kept image, with thumbnails, and never returns the image itself', async () => {
    const { store, ids } = await setup();
    const embedUrl = vi.fn();
    const r = await findSimilar({ store, embedUrl }, 'https://site.com/query.png');
    expect(r.results.map((x) => x.image.id)).toEqual([ids.near, ids.mid]);
    expect(r.results[0]!.thumb.startsWith('data:image/png;base64,')).toBe(true);
    expect(r.center).toMatchObject({ imageId: ids.query });
    expect(r.learning).toBe(false);
    expect(r.lensUrl).toContain('lens.google.com');
    expect(embedUrl).not.toHaveBeenCalled();
  });

  it('embeds an image you have not kept, on the fly, without saving it', async () => {
    const { store, ids } = await setup();
    const embedUrl = vi.fn(async () => vec(0, 0.1, 1));
    const r = await findSimilar({ store, embedUrl }, 'https://other.com/new.png');
    expect(embedUrl).toHaveBeenCalledWith('https://other.com/new.png');
    expect(r.results.map((x) => x.image.id)).toEqual([ids.far]);
    expect(await store.findByUrl('https://other.com/new.png')).toBeUndefined();
  });

  it('says it is still learning while some images have no embedding yet', async () => {
    const { store } = await setup();
    await store.add(sample('https://site.com/unlearned.png'), png());
    const r = await findSimilar({ store, embedUrl: vi.fn() }, 'https://site.com/query.png');
    expect(r.learning).toBe(true);
  });

  it('returns an empty result instead of failing when the image cannot be read', async () => {
    const { store } = await setup();
    const r = await findSimilar({ store, embedUrl: vi.fn(async () => { throw new Error('blocked'); }) }, 'https://other.com/x.png');
    expect(r.results).toEqual([]);
    expect(r.failed).toBe(true);
  });
});
