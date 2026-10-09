import type { Decoded } from './keep';
import { toPixelRect, type CropRect } from './crop';
import { NO_EDITS, cssFilter, outputSize, type Edits } from './edits';

export async function fetchImage(url: string): Promise<{ blob: Blob; robots?: string }> {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { blob: await res.blob(), robots: res.headers.get('x-robots-tag') ?? undefined };
}

// Worker-only (OffscreenCanvas); verified manually in Chrome, not in Node tests.
export async function decodeInWorker(blob: Blob): Promise<Decoded> {
  const bmp = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 64 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bmp, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;
    return { width: bmp.width, height: bmp.height, pixels, thumb: await makeThumb(bmp) };
  } finally {
    bmp.close();
  }
}

const THUMB_SIDE = 480;

/** Grid-sized WebP preview, so the gallery doesn't decode every full-size image. */
async function makeThumb(bmp: ImageBitmap): Promise<Blob | undefined> {
  const scale = Math.min(1, THUMB_SIDE / Math.max(bmp.width, bmp.height));
  if (scale === 1) return undefined;
  const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
}

/**
 * Cuts `rect` out of an image and applies edits, at full resolution (worker-only: OffscreenCanvas).
 * `maxSide` shrinks the result for previews.
 */
export async function cropInWorker(blob: Blob, rect: CropRect, edits: Edits = NO_EDITS, maxSide?: number): Promise<Blob> {
  const full = await createImageBitmap(blob);
  const { sx, sy, sw, sh } = toPixelRect(rect, full.width, full.height);
  full.close();
  const scale = maxSide ? Math.min(1, maxSide / Math.max(sw, sh)) : 1;
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
  const part = await createImageBitmap(blob, sx, sy, sw, sh, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
  try {
    const out = outputSize(w, h, edits.rotate);
    const canvas = new OffscreenCanvas(out.width, out.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.filter = cssFilter(edits);
    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate((edits.rotate * Math.PI) / 180);
    ctx.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1);
    ctx.drawImage(part, -w / 2, -h / 2, w, h);
    return await canvas.convertToBlob({ type: 'image/png' });
  } finally {
    part.close();
  }
}
