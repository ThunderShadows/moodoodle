/** A crop as fractions (0–1) of the image, so it doesn't depend on how big the image is shown. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_DRAG_PX = 8;
const TAG = '#moodoodle-crop=';
const round = (n: number) => Math.round(n * 10000) / 10000;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Converts a drag between two screen points over an image box into a crop (undefined for tiny drags). */
export function selectionToFraction(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: { left: number; top: number; width: number; height: number },
): CropRect | undefined {
  const x1 = clamp(Math.min(a.x, b.x), box.left, box.left + box.width);
  const x2 = clamp(Math.max(a.x, b.x), box.left, box.left + box.width);
  const y1 = clamp(Math.min(a.y, b.y), box.top, box.top + box.height);
  const y2 = clamp(Math.max(a.y, b.y), box.top, box.top + box.height);
  if (x2 - x1 < MIN_DRAG_PX || y2 - y1 < MIN_DRAG_PX) return undefined;
  return {
    x: round((x1 - box.left) / box.width),
    y: round((y1 - box.top) / box.height),
    w: round((x2 - x1) / box.width),
    h: round((y2 - y1) / box.height),
  };
}

/** Whole-pixel source rectangle inside an image of the given real size. */
export function toPixelRect(c: CropRect, width: number, height: number) {
  const sx = clamp(Math.floor(c.x * width), 0, width - 1);
  const sy = clamp(Math.floor(c.y * height), 0, height - 1);
  const sw = clamp(Math.round(c.w * width), 1, width - sx);
  const sh = clamp(Math.round(c.h * height), 1, height - sy);
  return { sx, sy, sw, sh };
}

/** A stable, unique address for one crop of an image (used as its identity in the collection). */
export function cropUrl(imageUrl: string, c: CropRect): string {
  return `${baseImageUrl(imageUrl)}${TAG}${[c.x, c.y, c.w, c.h].map(round).join(',')}`;
}

export function parseCropUrl(url: string): CropRect | undefined {
  const i = url.indexOf(TAG);
  if (i < 0) return undefined;
  const [x, y, w, h] = url.slice(i + TAG.length).split(',').map(Number);
  return [x, y, w, h].every((n) => Number.isFinite(n)) ? { x: x!, y: y!, w: w!, h: h! } : undefined;
}

/** The original image's address, without any crop marker. */
export function baseImageUrl(url: string): string {
  const i = url.indexOf(TAG);
  return i < 0 ? url : url.slice(0, i);
}
