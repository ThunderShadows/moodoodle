import type { Decoded } from './keep';

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
