import { describe, expect, it } from 'vitest';
import { autoThresholds, byValue, gridLines, luminance, notan, posterize, toGpl, toValues, tones } from './study';

const px = (...rgb: [number, number, number][]) => new Uint8ClampedArray(rgb.flatMap(([r, g, b]) => [r, g, b, 255]));
const greys = (p: Uint8ClampedArray) => Array.from({ length: p.length / 4 }, (_, i) => p[i * 4]!);

describe('study tools', () => {
  it('green reads lighter than blue (perceived lightness)', () => {
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(0, 0, 255));
    expect(luminance(255, 255, 255)).toBeCloseTo(255);
  });

  it('values turns colours into matching greys', () => {
    const p = px([255, 0, 0], [255, 255, 255]);
    toValues(p);
    expect(p[0]).toBe(p[1]);
    expect(p[1]).toBe(p[2]);
    expect(greys(p)[1]).toBe(255);
  });

  it('notan splits into 2 or 3 flat values', () => {
    const two = px([20, 20, 20], [200, 200, 200]);
    notan(two, [128]);
    expect(greys(two)).toEqual([0, 255]);
    const three = px([10, 10, 10], [120, 120, 120], [240, 240, 240]);
    notan(three, [170, 80]);
    expect(greys(three)).toEqual([0, 128, 255]);
    expect(tones(3)).toEqual([0, 128, 255]);
  });

  it('auto thresholds split between the lights and darks, even when one mass is much bigger', () => {
    // A light background with a thin dark ring: the split must keep the background white.
    const p = px(...Array.from({ length: 90 }, () => [207, 230, 251] as [number, number, number]), ...Array.from({ length: 10 }, () => [46, 107, 168] as [number, number, number]));
    const [t] = autoThresholds(p, 2);
    expect(t).toBeGreaterThan(luminance(46, 107, 168));
    expect(t).toBeLessThanOrEqual(luminance(207, 230, 251));
    const three = autoThresholds(px([0, 0, 0], [0, 0, 0], [128, 128, 128], [128, 128, 128], [250, 250, 250], [250, 250, 250]), 3);
    expect(three[0]).toBeGreaterThan(0);
    expect(three[0]).toBeLessThanOrEqual(128);
    expect(three[1]).toBeGreaterThan(128);
    expect(three[1]).toBeLessThanOrEqual(250);
    expect(autoThresholds(new Uint8ClampedArray(0), 2)).toEqual([128]);
  });

  it('posterize snaps colours to a few steps', () => {
    const p = px([100, 140, 250]);
    posterize(p, 2);
    expect(Array.from(p.slice(0, 3))).toEqual([0, 255, 255]);
    const v = px([100, 140, 250]);
    posterize(v, 3, true);
    expect(v[0]).toBe(128);
    expect(v[0]).toBe(v[2]);
  });

  it('grid lines', () => {
    expect(gridLines('thirds').lines).toEqual([1 / 3, 2 / 3]);
    expect(gridLines('4').lines).toHaveLength(3);
    expect(gridLines('diagonal').diagonals).toBe(true);
    expect(gridLines('off').lines).toEqual([]);
  });

  it('palette by value and as a .gpl file', () => {
    expect(byValue(['#FFFFFF', '#000000', '#FF0000'])).toEqual(['#000000', '#FF0000', '#FFFFFF']);
    const gpl = toGpl(['#F08A4B', '#3B2A20'], 'Cat\nstudy');
    expect(gpl.startsWith('GIMP Palette\nName: Cat study\n')).toBe(true);
    expect(gpl).toContain('240 138  75\t#F08A4B');
  });
});
