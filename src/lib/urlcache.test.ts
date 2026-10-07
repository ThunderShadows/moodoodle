import { describe, it, expect, vi } from 'vitest';
import { createUrlCache } from './urlcache';

describe('createUrlCache', () => {
  it('loads and creates one URL per id even when asked twice at once', async () => {
    const load = vi.fn(async (id: string) => new Blob([id]));
    const makeUrl = vi.fn((b: Blob) => `blob:${b.size}-${makeUrl.mock.calls.length}`);
    const cache = createUrlCache(load, makeUrl, () => {});
    const [a, b] = await Promise.all([cache.get('x'), cache.get('x')]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
    expect(makeUrl).toHaveBeenCalledTimes(1);
  });
  it('returns undefined when there is nothing to load', async () => {
    const cache = createUrlCache(async () => undefined, () => 'blob:never', () => {});
    expect(await cache.get('missing')).toBeUndefined();
  });
  it('revokes the URL when an id is dropped', async () => {
    const revoke = vi.fn();
    const cache = createUrlCache(async () => new Blob(['a']), () => 'blob:1', revoke);
    await cache.get('x');
    cache.drop('x');
    expect(revoke).toHaveBeenCalledWith('blob:1');
    expect(cache.peek('x')).toBeUndefined();
  });
});
