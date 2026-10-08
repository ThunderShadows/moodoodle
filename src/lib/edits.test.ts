import { describe, it, expect } from 'vitest';
import { NO_EDITS, cssFilter, cssTransform, outputSize, rotateBy, isUnedited, clampEdits } from './edits';

describe('edits', () => {
  it('starts unedited', () => {
    expect(isUnedited(NO_EDITS)).toBe(true);
    expect(cssFilter(NO_EDITS)).toBe('none');
    expect(cssTransform(NO_EDITS)).toBe('none');
  });
  it('builds the canvas/CSS filter from the sliders', () => {
    expect(cssFilter({ ...NO_EDITS, brightness: 120, contrast: 90, saturation: 0, grayscale: true }))
      .toBe('brightness(1.2) contrast(0.9) saturate(0) grayscale(1)');
  });
  it('rotates in quarter turns both ways', () => {
    expect(rotateBy(NO_EDITS, 90).rotate).toBe(90);
    expect(rotateBy(NO_EDITS, -90).rotate).toBe(270);
    expect(rotateBy(rotateBy(NO_EDITS, 90), 270).rotate).toBe(0);
  });
  it('swaps width and height for quarter turns', () => {
    expect(outputSize(400, 200, 90)).toEqual({ width: 200, height: 400 });
    expect(outputSize(400, 200, 180)).toEqual({ width: 400, height: 200 });
  });
  it('describes rotation and flips for the preview', () => {
    expect(cssTransform({ ...NO_EDITS, rotate: 90, flipH: true })).toBe('rotate(90deg) scaleX(-1)');
  });
  it('keeps slider values in a sensible range', () => {
    expect(clampEdits({ ...NO_EDITS, brightness: 999, contrast: -5, saturation: 150 })).toMatchObject({ brightness: 200, contrast: 0, saturation: 150 });
  });
});
