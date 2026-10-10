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

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Converts a drag between two screen points into a crop (undefined for tiny drags).
 * The drag is clamped to `box` (the visible part of the image) and measured against `image`
 * (where the whole picture is drawn, which can be bigger than the box with object-fit: cover).
 */
export function selectionToFraction(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: Box,
  image: Box = box,
): CropRect | undefined {
  const x1 = clamp(Math.min(a.x, b.x), box.left, box.left + box.width);
  const x2 = clamp(Math.max(a.x, b.x), box.left, box.left + box.width);
  const y1 = clamp(Math.min(a.y, b.y), box.top, box.top + box.height);
  const y2 = clamp(Math.max(a.y, b.y), box.top, box.top + box.height);
  if (x2 - x1 < MIN_DRAG_PX || y2 - y1 < MIN_DRAG_PX) return undefined;
  const fx = (x: number) => clamp((x - image.left) / image.width, 0, 1);
  const fy = (y: number) => clamp((y - image.top) / image.height, 0, 1);
  return { x: round(fx(x1)), y: round(fy(y1)), w: round(fx(x2) - fx(x1)), h: round(fy(y2) - fy(y1)) };
}

export interface ImageLayout {
  /** The element's border box on screen (getBoundingClientRect). */
  rect: Box;
  /** Border + padding on each side, in px. */
  inset: { top: number; right: number; bottom: number; left: number };
  natural: { width: number; height: number };
  fit: string;
  /** object-position as [x, y]; each is a fraction (0–1) of the free space, or a px offset. */
  position: [{ frac: number } | { px: number }, { frac: number } | { px: number }];
}

/** Where an <img> actually draws its picture (respecting padding, border, object-fit and object-position). */
export function drawnImageRect(l: ImageLayout): Box {
  const cx = l.rect.left + l.inset.left, cy = l.rect.top + l.inset.top;
  const cw = Math.max(1, l.rect.width - l.inset.left - l.inset.right);
  const ch = Math.max(1, l.rect.height - l.inset.top - l.inset.bottom);
  const { width: nw, height: nh } = l.natural;
  if (!nw || !nh || l.fit === 'fill' || !l.fit) return { left: cx, top: cy, width: cw, height: ch };
  const contain = Math.min(cw / nw, ch / nh);
  const scale = l.fit === 'contain' ? contain : l.fit === 'cover' ? Math.max(cw / nw, ch / nh)
    : l.fit === 'none' ? 1 : l.fit === 'scale-down' ? Math.min(1, contain) : 0;
  if (!scale) return { left: cx, top: cy, width: cw, height: ch };
  const w = nw * scale, h = nh * scale;
  const off = (p: { frac: number } | { px: number }, free: number) => ('px' in p ? p.px : free * p.frac);
  return { left: cx + off(l.position[0], cw - w), top: cy + off(l.position[1], ch - h), width: w, height: h };
}

/** The part of `a` that is inside `b` (falls back to `b` if they don't overlap). */
export function intersect(a: Box, b: Box): Box {
  const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width), bottom = Math.min(a.top + a.height, b.top + b.height);
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : b;
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
export function cropUrl(imageUrl: string, c: CropRect, frame?: number): string {
  const parts = [c.x, c.y, c.w, c.h].map(round);
  return `${baseImageUrl(imageUrl)}${TAG}${parts.join(',')}${frame !== undefined ? `,${frame}` : ''}`;
}

export function parseCropUrl(url: string): CropRect | undefined {
  const i = url.indexOf(TAG);
  if (i < 0) return undefined;
  const [x, y, w, h] = url.slice(i + TAG.length).split(',').map(Number); // a 5th value is the frame
  return [x, y, w, h].every((n) => Number.isFinite(n)) ? { x: x!, y: y!, w: w!, h: h! } : undefined;
}

/** The original image's address, without any crop marker. */
export function baseImageUrl(url: string): string {
  const i = url.indexOf(TAG);
  return i < 0 ? url : url.slice(0, i);
}
