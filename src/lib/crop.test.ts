import { describe, it, expect } from 'vitest';
import { selectionToFraction, toPixelRect, cropUrl, parseCropUrl, baseImageUrl } from './crop';

const box = { left: 100, top: 50, width: 400, height: 200 };

describe('selectionToFraction', () => {
  it('turns a drag inside the image into fractions of the image, in any drag direction', () => {
    expect(selectionToFraction({ x: 300, y: 150 }, { x: 100, y: 50 }, box)).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5 });
  });
  it('clamps drags that leave the image', () => {
    expect(selectionToFraction({ x: 50, y: 0 }, { x: 900, y: 400 }, box)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
  it('ignores tiny accidental drags', () => {
    expect(selectionToFraction({ x: 200, y: 100 }, { x: 203, y: 102 }, box)).toBeUndefined();
  });
});

describe('toPixelRect', () => {
  it('maps fractions to whole pixels of the real image size', () => {
    expect(toPixelRect({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 1000, 800)).toEqual({ sx: 250, sy: 400, sw: 500, sh: 200 });
  });
  it('never goes past the image edge and keeps at least 1 px', () => {
    expect(toPixelRect({ x: 0.999, y: 0.999, w: 0.5, h: 0.5 }, 100, 100)).toEqual({ sx: 99, sy: 99, sw: 1, sh: 1 });
  });
});

describe('cropUrl', () => {
  it('gives each crop its own stable address, and can be read back', () => {
    const url = cropUrl('https://x.com/a.png?w=1', { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
    expect(url).toBe('https://x.com/a.png?w=1#moodoodle-crop=0.1,0.2,0.3,0.4');
    expect(parseCropUrl(url)).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
    expect(baseImageUrl(url)).toBe('https://x.com/a.png?w=1');
  });
  it('treats ordinary addresses as uncropped', () => {
    expect(parseCropUrl('https://x.com/a.png#top')).toBeUndefined();
    expect(baseImageUrl('https://x.com/a.png')).toBe('https://x.com/a.png');
  });
});
