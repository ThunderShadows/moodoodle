import { describe, it, expect } from 'vitest';
import { extractPalette, familyOf, dominantFamily, toHex } from './color';

function pixels(...colors: [number, number, number, number, number][]): Uint8ClampedArray {
  // each entry: r, g, b, a, count
  const out: number[] = [];
  for (const [r, g, b, a, n] of colors) for (let i = 0; i < n; i++) out.push(r, g, b, a);
  return new Uint8ClampedArray(out);
}

describe('extractPalette', () => {
  it('returns the single color of a solid image', () => {
    expect(extractPalette(pixels([255, 0, 0, 255, 10]))).toEqual(['#FF0000']);
  });
  it('orders colors by how often they appear', () => {
    const p = extractPalette(pixels([0, 0, 255, 255, 3], [255, 255, 255, 255, 9]));
    expect(p).toEqual(['#FFFFFF', '#0000FF']);
  });
  it('ignores transparent pixels', () => {
    expect(extractPalette(pixels([255, 0, 0, 0, 50]))).toEqual([]);
  });
  it('returns at most maxColors', () => {
    const p = extractPalette(
      pixels([255, 0, 0, 255, 6], [0, 255, 0, 255, 5], [0, 0, 255, 255, 4], [255, 255, 0, 255, 3]),
      2,
    );
    expect(p).toHaveLength(2);
  });
});

describe('toHex', () => {
  it('pads and uppercases', () => {
    expect(toHex(1, 171, 255)).toBe('#01ABFF');
  });
});

describe('familyOf', () => {
  it.each([
    ['#FF0000', 'red'],
    ['#FFA500', 'orange'],
    ['#FFD8C2', 'orange'],
    ['#FFE27A', 'yellow'],
    ['#2F7D55', 'green'],
    ['#2E6BA8', 'blue'],
    ['#8A2BE2', 'purple'],
    ['#FF69B4', 'pink'],
    ['#FFFFFF', 'neutral'],
    ['#808080', 'neutral'],
    ['#111111', 'neutral'],
  ])('%s is %s', (hex, family) => {
    expect(familyOf(hex)).toBe(family);
  });
});

describe('dominantFamily', () => {
  it('skips neutral backgrounds and uses the first colorful swatch', () => {
    expect(dominantFamily(['#FFFFFF', '#FFA500'])).toBe('orange');
  });
  it('is neutral when everything is neutral or empty', () => {
    expect(dominantFamily(['#FFFFFF', '#000000'])).toBe('neutral');
    expect(dominantFamily([])).toBe('neutral');
  });
});
