/** Simple, lossless-to-describe edits applied to a crop before it's saved. */
export interface Edits {
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  /** Percent; 100 = unchanged. */
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: boolean;
}

export const NO_EDITS: Edits = { rotate: 0, flipH: false, flipV: false, brightness: 100, contrast: 100, saturation: 100, grayscale: false };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export function clampEdits(e: Edits): Edits {
  return { ...e, brightness: clamp(e.brightness, 0, 200), contrast: clamp(e.contrast, 0, 200), saturation: clamp(e.saturation, 0, 200) };
}

export function isUnedited(e: Edits): boolean {
  return (Object.keys(NO_EDITS) as (keyof Edits)[]).every((k) => e[k] === NO_EDITS[k]);
}

/** Same string works for CSS `filter` (preview) and canvas `ctx.filter` (saved file). */
export function cssFilter(e: Edits): string {
  const parts: string[] = [];
  if (e.brightness !== 100) parts.push(`brightness(${e.brightness / 100})`);
  if (e.contrast !== 100) parts.push(`contrast(${e.contrast / 100})`);
  if (e.saturation !== 100) parts.push(`saturate(${e.saturation / 100})`);
  if (e.grayscale) parts.push('grayscale(1)');
  return parts.length ? parts.join(' ') : 'none';
}

export function cssTransform(e: Edits): string {
  const parts: string[] = [];
  if (e.rotate) parts.push(`rotate(${e.rotate}deg)`);
  if (e.flipH) parts.push('scaleX(-1)');
  if (e.flipV) parts.push('scaleY(-1)');
  return parts.length ? parts.join(' ') : 'none';
}

export function rotateBy(e: Edits, degrees: 90 | -90 | 270): Edits {
  return { ...e, rotate: (((e.rotate + degrees) % 360) + 360) % 360 as Edits['rotate'] };
}

export function outputSize(width: number, height: number, rotate: Edits['rotate']) {
  return rotate === 90 || rotate === 270 ? { width: height, height: width } : { width, height };
}
