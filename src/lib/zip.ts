import JSZip from 'jszip';
import { creditLine } from './credit';
import { licenseLabel } from './license';
import type { License, SavedImage } from './types';

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
function licenseText(l: License): string {
  if (l.kind === 'unknown') return 'not stated, treat as all rights reserved (reference only)';
  if (l.kind === 'all-rights-reserved') return `All rights reserved${l.notice ? ` (${l.notice})` : ''} (reference only)`;
  return l.url ? `${licenseLabel(l)} (${l.url})` : licenseLabel(l);
}

/** CREDITS.md in Creative Commons TASL style (title, author, source, license), one entry per file. */
export function buildCreditsMd(entries: { name: string; image: SavedImage }[]): string {
  const lines = ['# Credits', ''];
  for (const { name, image } of entries) {
    const c = image.credit;
    lines.push(`## ${name}`);
    lines.push(`- **Title:** ${c.title ?? image.pageTitle}`);
    lines.push(`- **Creator:** ${c.creator ? `${c.creator}${c.creatorUrl ? ` (${c.creatorUrl})` : ''}` : 'unknown'}`);
    lines.push(`- **Source:** ${image.pageUrl}`);
    lines.push(`- **License:** ${licenseText(c.license)}`);
    const line = creditLine(c, image.pageTitle);
    if (line) lines.push(`- **Credit line:** ${line}`);
    lines.push('');
  }
  return lines.join('\n');
}

export async function buildZip(
  items: { image: SavedImage; blob: Blob }[],
  includeCredits: boolean,
): Promise<Blob> {
  const zip = new JSZip();
  const used = new Set<string>(['CREDITS.md']);
  const entries: { name: string; image: SavedImage }[] = [];
  for (const { image, blob } of items) {
    const name = fileNameFor(image, used);
    zip.file(name, await blob.arrayBuffer());
    entries.push({ name, image });
  }
  if (includeCredits) zip.file('CREDITS.md', buildCreditsMd(entries));
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}
