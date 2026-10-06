// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { pickBestSrc, isBigEnough, collectImageUrls } from './pick';

function makeImg(src: string, opts: { natural?: number; shown?: number; currentSrc?: string } = {}) {
  const img = document.createElement('img');
  img.src = src;
  const natural = opts.natural ?? 300;
  const shown = opts.shown ?? 300;
  Object.defineProperty(img, 'naturalWidth', { value: natural });
  Object.defineProperty(img, 'naturalHeight', { value: natural });
  if (opts.currentSrc) Object.defineProperty(img, 'currentSrc', { value: opts.currentSrc });
  img.getBoundingClientRect = () => ({ width: shown, height: shown } as DOMRect);
  document.body.append(img);
  return img;
}

describe('pickBestSrc', () => {
  it('prefers the displayed currentSrc (srcset / lazy-load) over src', () => {
    const img = makeImg('https://x.com/placeholder.gif', { currentSrc: 'https://x.com/big@2x.png' });
    expect(pickBestSrc(img)).toBe('https://x.com/big@2x.png');
  });
  it('falls back to src and rejects unkeepable URLs', () => {
    expect(pickBestSrc(makeImg('https://x.com/a.png'))).toBe('https://x.com/a.png');
    expect(pickBestSrc(makeImg('blob:https://x.com/1'))).toBeNull();
  });
});

describe('isBigEnough', () => {
  it('hides the pill on icons and avatars', () => {
    expect(isBigEnough(makeImg('https://x.com/a.png', { shown: 300 }))).toBe(true);
    expect(isBigEnough(makeImg('https://x.com/icon.png', { shown: 32 }))).toBe(false);
  });
});

describe('collectImageUrls', () => {
  it('returns unique, large, keepable images only', () => {
    document.body.innerHTML = '';
    makeImg('https://x.com/a.png');
    makeImg('https://x.com/a.png');
    makeImg('https://x.com/pixel.gif', { natural: 1 });
    makeImg('https://x.com/b.png');
    makeImg('blob:https://x.com/1');
    expect(collectImageUrls(document)).toEqual(['https://x.com/a.png', 'https://x.com/b.png']);
  });
});
