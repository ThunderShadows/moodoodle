export type ColorFamily =
  | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'neutral';

export const COLOR_FAMILIES: ColorFamily[] = [
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'neutral',
];

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
