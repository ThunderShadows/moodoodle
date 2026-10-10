/** Picks the image type from a file's first bytes (servers often send a generic or wrong content type). */
export function sniffImageType(head: Uint8Array, fallback = ''): string {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (head[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  return fallback;
}

/** "Frame 3 of 12" (people count from 1; frames are stored from 0). */
export function frameLabel(index: number, count: number): string {
  return `Frame ${index + 1} of ${count}`;
}

// Below: WebCodecs ImageDecoder, which exists in pages and dedicated workers but not in service workers,
// so these run in the offscreen document. Verified in Chrome by the e2e suite, not in Node tests.

async function decoderFor(blob: Blob): Promise<ImageDecoder | undefined> {
  if (typeof ImageDecoder === 'undefined') return undefined;
  const data = await blob.arrayBuffer();
  const type = sniffImageType(new Uint8Array(data, 0, Math.min(16, data.byteLength)), blob.type);
  if (!type || !(await ImageDecoder.isTypeSupported(type))) return undefined;
  const decoder = new ImageDecoder({ data, type });
  // The frame count is only filled in once the tracks are ready and the whole file is read.
  await decoder.tracks.ready;
  await decoder.completed;
  return decoder;
}

/** How many frames an image has (1 for still images and anything the browser can't decode frame by frame). */
export async function frameCount(blob: Blob): Promise<number> {
  const decoder = await decoderFor(blob).catch(() => undefined);
  if (!decoder) return 1;
  try {
    return Math.max(1, decoder.tracks.selectedTrack?.frameCount ?? 1);
  } finally {
    decoder.close();
  }
}

/** One fully drawn frame of an animated image, as a PNG. */
export async function frameAt(blob: Blob, index: number): Promise<Blob> {
  const decoder = await decoderFor(blob);
  if (!decoder) return blob;
  try {
    const count = decoder.tracks.selectedTrack?.frameCount ?? 1;
    const { image } = await decoder.decode({ frameIndex: Math.min(Math.max(0, index), count - 1) });
    try {
      const canvas = new OffscreenCanvas(image.displayWidth, image.displayHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(image, 0, 0);
      return await canvas.convertToBlob({ type: 'image/png' });
    } finally {
      image.close();
    }
  } finally {
    decoder.close();
  }
}
