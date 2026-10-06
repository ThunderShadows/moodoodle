import type { Decoded } from './keep';

export async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
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
    return { width: bmp.width, height: bmp.height, pixels: ctx.getImageData(0, 0, w, h).data };
  } finally {
    bmp.close();
  }
}
