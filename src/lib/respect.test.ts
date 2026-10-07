import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { isArtistPlatform, bulkKeepBlocked } from './respect';
import { keepMany, type KeepDeps } from './keep';
import { openImageStore } from './db';

describe('isArtistPlatform', () => {
  it('matches artist platforms and their subdomains', () => {
    for (const u of ['https://www.artstation.com/artwork/x', 'https://cara.app/post/1', 'https://janedoe.deviantart.com/art/1',
      'https://www.behance.net/gallery/1', 'https://dribbble.com/shots/1']) {
      expect(isArtistPlatform(u)).toBe(true);
    }
  });
  it('does not match lookalike domains or other sites', () => {
    expect(isArtistPlatform('https://notcara.app/')).toBe(false);
    expect(isArtistPlatform('https://artstation.com.evil.example/')).toBe(false);
    expect(isArtistPlatform('https://someblog.example/')).toBe(false);
    expect(isArtistPlatform('not a url')).toBe(false);
  });
});

describe('bulkKeepBlocked', () => {
  it('blocks artist platforms and NoAI pages only', () => {
    expect(bulkKeepBlocked('https://cara.app/x', false)).toBe(true);
    expect(bulkKeepBlocked('https://blog.example/x', true)).toBe(true);
    expect(bulkKeepBlocked('https://blog.example/x', false)).toBe(false);
  });
});

describe('keepMany guard', () => {
  it('refuses bulk keeps on blocked pages without fetching anything', async () => {
    const fetchImage = vi.fn();
    const deps = { store: openImageStore(`r-${crypto.randomUUID()}`), fetchImage, decode: vi.fn() } as unknown as KeepDeps;
    const res = await keepMany(deps, { imageUrls: ['https://cdna.artstation.com/1.jpg', 'https://cdna.artstation.com/2.jpg'], pageUrl: 'https://www.artstation.com/artwork/x', pageTitle: 'X' });
    expect(res).toEqual({ kept: 0, skipped: 2, blocked: true });
    expect(fetchImage).not.toHaveBeenCalled();
  });
  it('refuses bulk keeps when the page opts out of AI', async () => {
    const fetchImage = vi.fn();
    const deps = { store: openImageStore(`r-${crypto.randomUUID()}`), fetchImage, decode: vi.fn() } as unknown as KeepDeps;
    const res = await keepMany(deps, { imageUrls: ['https://b.example/1.jpg'], pageUrl: 'https://b.example/', pageTitle: 'B', pageNoAI: true });
    expect(res).toMatchObject({ blocked: true });
  });
});
