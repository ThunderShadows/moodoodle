import JSZip from 'jszip';
import type { SavedImage } from './types';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg',
};

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export function fileNameFor(img: SavedImage, used: Set<string>): string {
  const base = slugify(img.pageTitle) || slugify(img.site) || 'image';
  const ext = EXT[img.mimeType] ?? 'img';
  let name = `${base}.${ext}`;
  for (let n = 2; used.has(name); n++) name = `${base}-${n}.${ext}`;
  used.add(name);
  return name;
}

// Bytes go in as ArrayBuffer and come out as uint8array so this behaves the same in Node and the browser.
export async function buildZip(
  items: { image: SavedImage; blob: Blob }[],
  includeSources: boolean,
): Promise<Blob> {
  const zip = new JSZip();
  const used = new Set<string>(['sources.txt']);
  const lines = ['file\tpage\timage'];
  for (const { image, blob } of items) {
    const name = fileNameFor(image, used);
    zip.file(name, await blob.arrayBuffer());
    lines.push(`${name}\t${image.pageUrl}\t${image.imageUrl}`);
  }
  if (includeSources) zip.file('sources.txt', lines.join('\n'));
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}
