export type ColorFamily =
  | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'neutral';

export const COLOR_FAMILIES: ColorFamily[] = [
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'neutral',
];

export type BoardColor = 'peach' | 'mint' | 'lilac' | 'butter' | 'sky' | 'rose';
export const BOARD_COLORS: BoardColor[] = ['peach', 'mint', 'lilac', 'butter', 'sky', 'rose'];

export interface Board {
  id: string;
  name: string;
  color: BoardColor;
  createdAt: string;
}

export type License =
  | { kind: 'cc'; code: 'by' | 'by-sa' | 'by-nc' | 'by-nd' | 'by-nc-sa' | 'by-nc-nd'; version?: string; url: string }
  | { kind: 'cc0' | 'public-domain'; url?: string }
  | { kind: 'all-rights-reserved'; notice?: string }
  | { kind: 'unknown'; raw?: string };

export type CreditSource = 'user' | 'json-ld' | 'xmp' | 'rel-license' | 'meta' | `site:${string}`;

export interface Credit {
  title?: string;
  creator?: string;
  creatorUrl?: string;
  creditText?: string;
  copyrightNotice?: string;
  acquireLicensePage?: string;
  license: License;
  noAI: boolean;
  confidence: 'stated' | 'inferred' | 'none';
  fieldSources: Partial<Record<'title' | 'creator' | 'creatorUrl' | 'license' | 'copyrightNotice', CreditSource>>;
}

export function emptyCredit(): Credit {
  return { license: { kind: 'unknown' }, noAI: false, confidence: 'none', fieldSources: {} };
}

export const MAX_BYTES = 25 * 1024 * 1024;
export const MIN_IMAGE_SIDE = 120;

export interface SavedImage {
  id: string;
  imageUrl: string;
  pageUrl: string;
  pageTitle: string;
  site: string;
  savedAt: string;
  width: number;
  height: number;
  mimeType: string;
  byteSize: number;
  palette: string[];
  colorFamily: ColorFamily;
  tags: string[];
  boardIds: string[];
  credit: Credit;
}

export type KeepErrorReason =
  | 'unsupported-url' | 'fetch-failed' | 'not-an-image' | 'too-big' | 'decode-failed';

export type KeepResult =
  | { status: 'kept'; image: SavedImage }
  | { status: 'duplicate'; image: SavedImage }
  | { status: 'error'; reason: KeepErrorReason };

export interface KeepManyResult {
  kept: number;
  skipped: number;
}

export type Message =
  | { type: 'keep'; imageUrl: string; pageUrl: string; pageTitle: string }
  | { type: 'keep-many'; imageUrls: string[]; pageUrl: string; pageTitle: string }
  | { type: 'lens'; imageUrl: string }
  | { type: 'collect-images' }
  | { type: 'toast'; result: KeepResult };
