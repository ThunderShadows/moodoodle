import type { ImageStore } from './db';
import { extractPalette, dominantFamily } from './color';
import { isKeepableUrl } from './urls';
import { mergeCredit, parseRobots } from './credit';
import { readXmp } from './xmp';
import { bulkKeepBlocked } from './respect';
import { cropUrl, type CropRect } from './crop';
import { isUnedited, type Edits } from './edits';
import { MAX_BYTES, type KeepErrorReason, type KeepManyResult, type KeepResult, type PageCredit, type SavedImage } from './types';

export interface Decoded {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  /** Small preview for grids; optional so decoders that can't make one still work. */
  thumb?: Blob;
}

export interface KeepDeps {
  store: ImageStore;
  /** Downloads the image; `robots` is its X-Robots-Tag response header, if any. */
  fetchImage(url: string): Promise<{ blob: Blob; robots?: string }>;
  decode(blob: Blob): Promise<Decoded>;
  /** Cuts a region out of an image (worker: OffscreenCanvas). Only needed for crops. */
  crop?(blob: Blob, rect: CropRect, edits?: Edits): Promise<Blob>;
  maxBytes?: number;
}

export interface KeepInput {
  imageUrl: string;
  pageUrl: string;
  pageTitle: string;
  /** The "keeping into" board, if any. */
  board?: { id: string; name: string };
  /** Credit facts the page states about this image (read by the content script). */
  pageCredit?: PageCredit;
  /** Keep only this part of the image (fractions of the image). */
  crop?: CropRect;
  /** Edits applied to the crop before it's saved. */
  edits?: Edits;
}

export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const fail = (reason: KeepErrorReason): KeepResult => ({ status: 'error', reason });

/** An already-kept image joins the keeping-into board rather than being refused. */
async function duplicate(deps: KeepDeps, image: SavedImage, board?: KeepInput['board']): Promise<KeepResult> {
  if (!board) return { status: 'duplicate', image };
  if (image.boardIds.includes(board.id)) return { status: 'duplicate', image, boardName: board.name, addedToBoard: false };
  await deps.store.addToBoard([image.id], board.id);
  return { status: 'duplicate', image: { ...image, boardIds: [...image.boardIds, board.id] }, boardName: board.name, addedToBoard: true };
}

export async function keepImage(deps: KeepDeps, input: KeepInput): Promise<KeepResult> {
  if (!isKeepableUrl(input.imageUrl)) return fail('unsupported-url');

  // A crop is its own keep, identified by the image address plus the crop rectangle.
  const key = input.crop ? cropUrl(input.imageUrl, input.crop) : input.imageUrl;
  const existing = await deps.store.findByUrl(key);
  if (existing) return duplicate(deps, existing, input.board);

  let blob: Blob;
  let robots: string | undefined;
  try {
    ({ blob, robots } = await deps.fetchImage(input.imageUrl));
  } catch {
    return fail('fetch-failed');
  }
  if (!blob.type.startsWith('image/')) return fail('not-an-image');
  if (blob.size > (deps.maxBytes ?? MAX_BYTES)) return fail('too-big');
  // Read the file's own credit (XMP) before any crop: a cropped copy no longer carries it.
  const head = new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer());
  if (input.crop) {
    if (!deps.crop) return fail('decode-failed');
    try {
      blob = await deps.crop(blob, input.crop, input.edits);
    } catch {
      return fail('decode-failed');
    }
  }

  let decoded: Decoded;
  try {
    decoded = await deps.decode(blob);
  } catch {
    return fail('decode-failed');
  }

  const palette = extractPalette(decoded.pixels);
  const credit = mergeCredit({ page: input.pageCredit, xmp: readXmp(head), headerNoAI: parseRobots(robots) });
  const site = siteOf(input.pageUrl);
  try {
    const image = await deps.store.add(
      {
        imageUrl: key,
        ...(input.crop ? { crop: input.crop } : {}),
        ...(input.crop && input.edits && !isUnedited(input.edits) ? { edits: input.edits } : {}),
        pageUrl: input.pageUrl,
        pageTitle: input.pageTitle.trim() || site,
        site,
        width: decoded.width,
        height: decoded.height,
        mimeType: blob.type,
        byteSize: blob.size,
        palette,
        colorFamily: dominantFamily(palette),
        tags: [],
        boardIds: input.board ? [input.board.id] : [],
        credit,
      },
      blob,
      decoded.thumb,
    );
    return { status: 'kept', image, boardName: input.board?.name };
  } catch (e) {
    // Another keep of the same URL won the race to the unique index.
    const raced = await deps.store.findByUrl(key);
    if (raced) return duplicate(deps, raced, input.board);
    throw e;
  }
}

/** Keeps each URL in turn; any failure, including an unexpected storage error, counts as skipped. */
export async function keepMany(
  deps: KeepDeps,
  input: {
    imageUrls: string[];
    pageUrl: string;
    pageTitle: string;
    board?: KeepInput['board'];
    pageCredits?: Record<string, PageCredit>;
    pageNoAI?: boolean;
  },
): Promise<KeepManyResult> {
  // Enforced here as well as in the popup, so no caller can bulk-collect from artist pages.
  if (bulkKeepBlocked(input.pageUrl, !!input.pageNoAI)) return { kept: 0, skipped: input.imageUrls.length, blocked: true };
  const out: KeepManyResult = { kept: 0, skipped: 0 };
  for (const imageUrl of input.imageUrls) {
    try {
      const r = await keepImage(deps, {
        imageUrl, pageUrl: input.pageUrl, pageTitle: input.pageTitle, board: input.board, pageCredit: input.pageCredits?.[imageUrl],
      });
      if (r.status === 'kept') out.kept++;
      else out.skipped++;
    } catch {
      out.skipped++;
    }
  }
  return out;
}
