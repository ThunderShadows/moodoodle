import type { ImageStore } from './db';
import { extractPalette, dominantFamily } from './color';
import { isKeepableUrl } from './urls';
import { MAX_BYTES, emptyCredit, type KeepErrorReason, type KeepManyResult, type KeepResult, type SavedImage } from './types';

export interface Decoded {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  /** Small preview for grids; optional so decoders that can't make one still work. */
  thumb?: Blob;
}

export interface KeepDeps {
  store: ImageStore;
  fetchBlob(url: string): Promise<Blob>;
  decode(blob: Blob): Promise<Decoded>;
  maxBytes?: number;
}

export interface KeepInput {
  imageUrl: string;
  pageUrl: string;
  pageTitle: string;
  /** The "keeping into" board, if any. */
  board?: { id: string; name: string };
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

  const existing = await deps.store.findByUrl(input.imageUrl);
  if (existing) return duplicate(deps, existing, input.board);

  let blob: Blob;
  try {
    blob = await deps.fetchBlob(input.imageUrl);
  } catch {
    return fail('fetch-failed');
  }
  if (!blob.type.startsWith('image/')) return fail('not-an-image');
  if (blob.size > (deps.maxBytes ?? MAX_BYTES)) return fail('too-big');

  let decoded: Decoded;
  try {
    decoded = await deps.decode(blob);
  } catch {
    return fail('decode-failed');
  }

  const palette = extractPalette(decoded.pixels);
  const site = siteOf(input.pageUrl);
  try {
    const image = await deps.store.add(
      {
        imageUrl: input.imageUrl,
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
        credit: emptyCredit(),
      },
      blob,
      decoded.thumb,
    );
    return { status: 'kept', image, boardName: input.board?.name };
  } catch (e) {
    // Another keep of the same URL won the race to the unique index.
    const raced = await deps.store.findByUrl(input.imageUrl);
    if (raced) return duplicate(deps, raced, input.board);
    throw e;
  }
}

/** Keeps each URL in turn; any failure, including an unexpected storage error, counts as skipped. */
export async function keepMany(
  deps: KeepDeps,
  input: { imageUrls: string[]; pageUrl: string; pageTitle: string; board?: KeepInput['board'] },
): Promise<KeepManyResult> {
  const out: KeepManyResult = { kept: 0, skipped: 0 };
  for (const imageUrl of input.imageUrls) {
    try {
      const r = await keepImage(deps, { imageUrl, pageUrl: input.pageUrl, pageTitle: input.pageTitle, board: input.board });
      if (r.status === 'kept') out.kept++;
      else out.skipped++;
    } catch {
      out.skipped++;
    }
  }
  return out;
}
