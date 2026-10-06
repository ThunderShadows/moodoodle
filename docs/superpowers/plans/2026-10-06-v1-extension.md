# Moodoodle v1 Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local-only Chrome extension that keeps images from any site (hover pill or right-click), shows them in a playful searchable gallery, opens Google Lens for "find similar", and exports picks as a .zip.

**Architecture:** WXT (Manifest V3) with four entrypoints: a background service worker that does all fetching/decoding/saving, a content script for the hover pill and toasts, a Svelte popup, and a Svelte gallery page. All logic that can be pure (URLs, color, search, zip, the keep pipeline) lives in `src/lib/` and is unit-tested with Vitest. Storage is IndexedDB through `idb`, shared by the worker and extension pages (same extension origin). Content scripts never touch storage. They message the worker.

**Tech Stack:** WXT, TypeScript, Svelte 5, idb, JSZip, @fontsource fonts, Vitest + fake-indexeddb + jsdom.

**Spec:** `docs/spec.md`

## Global Constraints

- Manifest V3, Chrome only. Permissions exactly: `contextMenus`, `unlimitedStorage`; host permissions `<all_urls>`. No others.
- No backend, no accounts, no analytics, no remote code, no remote fonts. Nothing leaves the browser except the image URL passed to `https://lens.google.com/uploadbyurl?url=<encoded>` when the user presses Find similar.
- Accept only `http:`/`https:` and `data:image/` image URLs.
- `MAX_BYTES = 25 * 1024 * 1024`; `MIN_IMAGE_SIDE = 120` (px).
- Dates are ISO 8601 UTC strings (`new Date().toISOString()`).
- Tags: trimmed, lowercase, de-duplicated, empty removed.
- Colors: ground `#F7F5FB`, ink `#2A2433`, muted `#6E6578`, line `#E7E1F2`, accent `#FFB58F`. Fonts: Bricolage Grotesque 800 (display), Figtree 400/600 (body), Caveat 600 (notes). Content script uses `system-ui` only.
- Touch targets ≥ 44 px; text contrast ≥ 4.5:1; real `<button>`/`<input>`+`<label>` elements.
- User-facing copy is friendly and short; brand word is lowercase `moodoodle` in UI.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The same image kept twice** (hover Keep, then right-click Keep, or a double-click): there must be one copy, and the second attempt says "Already in your collection". Covered by the concurrent-keep test in Task 5.
2. **A site that blocks hotlinking (403)**: show the toast "This site blocked the download" and save nothing. Covered in Task 5 by the test where the fetch fails and the store ends up empty.
3. **Lazy-loaded or `srcset` images**: keep the high-res image actually displayed (`currentSrc`), not the placeholder `src`. Covered in Task 8 by the currentSrc test.
4. **Odd page titles** (emoji, slashes, 200 characters, empty): zip entries still get valid, unique, readable names. Covered in Task 6 by the slug/collision tests.
5. **Icons, avatars and tracking pixels**: no hover pill, and they're left out of "Keep all on this page". Covered in Task 8 by the size-filter tests.

---

### Task 1: Scaffold the extension and tooling

**Files:**
- Create: project scaffold from WXT's Svelte template (in `/home/sumanth/Downloads/design-saver/`)
- Create/replace: `wxt.config.ts`, `vitest.config.ts`, `src/assets/icon.svg`, `src/lib/smoke.test.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: nothing
- Produces: `@/` alias → `src/`; `npm test` runs Vitest; `npm run dev` launches Chrome with the extension; `npm run build` / `npm run zip`.

- [ ] **Step 1: Scaffold next to the existing `docs/` folder**

```bash
cd /home/sumanth/Downloads/design-saver
npx wxt@latest init app-tmp -t svelte --pm npm
rsync -a app-tmp/ ./ && rm -rf app-tmp
git init && npm install
npm install idb jszip @fontsource/bricolage-grotesque @fontsource/figtree @fontsource/caveat
npm install -D vitest fake-indexeddb jsdom @wxt-dev/auto-icons
```

If the template created `entrypoints/`, `assets/` or `components/` at the project root instead of under `src/`, move them into `src/` (leave `public/` at the root). Delete the template's demo component and counter code.

- [ ] **Step 2: Write `wxt.config.ts`**

```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte', '@wxt-dev/auto-icons'],
  autoIcons: { baseIconPath: 'assets/icon.svg' },
  manifest: {
    name: 'moodoodle',
    description: 'Keep the designs you love. Find more like them.',
    permissions: ['contextMenus', 'unlimitedStorage'],
    host_permissions: ['<all_urls>'],
  },
});
```

Create a placeholder `src/assets/icon.svg` (it gets replaced in Task 11):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="32" fill="#2A2433"/><path d="M24 78c0-27 21-48 48-48 18 0 32 11 36 26l-18 3c-3 24-24 42-48 42-10 0-18-9-18-23z" fill="#F7F5FB"/><circle cx="76" cy="52" r="6" fill="#2A2433"/><path d="M106 55l14 3-14 6z" fill="#FFB58F"/></svg>
```

- [ ] **Step 3: Write `vitest.config.ts` and the test script**

```ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: { environment: 'node' },
});
```

In `package.json` `scripts`, add `"test": "vitest run"` and keep WXT's `dev`, `build`, `zip`.

- [ ] **Step 4: Write a smoke test**

`src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('tooling', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Verify**

Run: `npm test` → Expected: 1 passed.
Run: `npm run build` → Expected: build succeeds, `.output/chrome-mv3/manifest.json` lists exactly `contextMenus`, `unlimitedStorage` and `<all_urls>`.

- [ ] **Step 6: Commit**

```bash
printf "node_modules\n.output\n.wxt\n" >> .gitignore
git add -A
git commit -m "chore: scaffold WXT + Svelte extension with Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared types and URL helpers

**Files:**
- Create: `src/lib/types.ts`, `src/lib/urls.ts`
- Test: `src/lib/urls.test.ts`
- Delete: `src/lib/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: types `ColorFamily`, `COLOR_FAMILIES`, `SavedImage`, `KeepErrorReason`, `KeepResult`, `KeepManyResult`, `Message`; constants `MAX_BYTES`, `MIN_IMAGE_SIDE`; functions `isKeepableUrl(url: string): boolean`, `lensUrl(imageUrl: string): string | null`.

- [ ] **Step 1: Write `src/lib/types.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing test `src/lib/urls.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { isKeepableUrl, lensUrl } from './urls';

describe('isKeepableUrl', () => {
  it('accepts http, https and data:image URLs', () => {
    expect(isKeepableUrl('https://a.com/x.png')).toBe(true);
    expect(isKeepableUrl('http://a.com/x.png')).toBe(true);
    expect(isKeepableUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });
  it('rejects blob, chrome, data:text and garbage', () => {
    expect(isKeepableUrl('blob:https://a.com/123')).toBe(false);
    expect(isKeepableUrl('chrome://favicon/x')).toBe(false);
    expect(isKeepableUrl('data:text/html,hi')).toBe(false);
    expect(isKeepableUrl('not a url')).toBe(false);
    expect(isKeepableUrl('')).toBe(false);
  });
});

describe('lensUrl', () => {
  it('builds an encoded Google Lens link for web URLs', () => {
    expect(lensUrl('https://a.com/x y.png?s=1&t=2')).toBe(
      'https://lens.google.com/uploadbyurl?url=' +
        encodeURIComponent('https://a.com/x%20y.png?s=1&t=2'),
    );
  });
  it('returns null for data URLs and non-web URLs', () => {
    expect(lensUrl('data:image/png;base64,iVBORw0KGgo=')).toBeNull();
    expect(lensUrl('blob:https://a.com/123')).toBeNull();
    expect(lensUrl('nope')).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/lib/urls.test.ts` → Expected: FAIL, cannot resolve `./urls`.

- [ ] **Step 4: Write `src/lib/urls.ts`**

```ts
export function isKeepableUrl(url: string): boolean {
  if (url.startsWith('data:image/')) return true;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function lensUrl(imageUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(imageUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(u.href)}`;
}
```

- [ ] **Step 5: Run tests**

Run: `rm src/lib/smoke.test.ts && npm test` → Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: shared types and URL helpers (keepable check, Lens link)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Color palette and color family

**Files:**
- Create: `src/lib/color.ts`
- Test: `src/lib/color.test.ts`

**Interfaces:**
- Consumes: `ColorFamily` from `./types`
- Produces: `extractPalette(pixels: Uint8ClampedArray, maxColors?: number): string[]`, `toHex(r: number, g: number, b: number): string`, `hexToHsl(hex: string): { h: number; s: number; l: number }`, `familyOf(hex: string): ColorFamily`, `dominantFamily(palette: string[]): ColorFamily`.

- [ ] **Step 1: Write the failing test `src/lib/color.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { extractPalette, familyOf, dominantFamily, toHex } from './color';

function pixels(...colors: [number, number, number, number, number][]): Uint8ClampedArray {
  // each entry: r, g, b, a, count
  const out: number[] = [];
  for (const [r, g, b, a, n] of colors) for (let i = 0; i < n; i++) out.push(r, g, b, a);
  return new Uint8ClampedArray(out);
}

describe('extractPalette', () => {
  it('returns the single color of a solid image', () => {
    expect(extractPalette(pixels([255, 0, 0, 255, 10]))).toEqual(['#FF0000']);
  });
  it('orders colors by how often they appear', () => {
    const p = extractPalette(pixels([0, 0, 255, 255, 3], [255, 255, 255, 255, 9]));
    expect(p).toEqual(['#FFFFFF', '#0000FF']);
  });
  it('ignores transparent pixels', () => {
    expect(extractPalette(pixels([255, 0, 0, 0, 50]))).toEqual([]);
  });
  it('returns at most maxColors', () => {
    const p = extractPalette(
      pixels([255, 0, 0, 255, 6], [0, 255, 0, 255, 5], [0, 0, 255, 255, 4], [255, 255, 0, 255, 3]),
      2,
    );
    expect(p).toHaveLength(2);
  });
});

describe('toHex', () => {
  it('pads and uppercases', () => {
    expect(toHex(1, 171, 255)).toBe('#01ABFF');
  });
});

describe('familyOf', () => {
  it.each([
    ['#FF0000', 'red'],
    ['#FFA500', 'orange'],
    ['#FFD8C2', 'orange'],
    ['#FFE27A', 'yellow'],
    ['#2F7D55', 'green'],
    ['#2E6BA8', 'blue'],
    ['#8A2BE2', 'purple'],
    ['#FF69B4', 'pink'],
    ['#FFFFFF', 'neutral'],
    ['#808080', 'neutral'],
    ['#111111', 'neutral'],
  ])('%s is %s', (hex, family) => {
    expect(familyOf(hex)).toBe(family);
  });
});

describe('dominantFamily', () => {
  it('skips neutral backgrounds and uses the first colorful swatch', () => {
    expect(dominantFamily(['#FFFFFF', '#FFA500'])).toBe('orange');
  });
  it('is neutral when everything is neutral or empty', () => {
    expect(dominantFamily(['#FFFFFF', '#000000'])).toBe('neutral');
    expect(dominantFamily([])).toBe('neutral');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/color.test.ts` → Expected: FAIL, cannot resolve `./color`.

- [ ] **Step 3: Write `src/lib/color.ts`**

```ts
import type { ColorFamily } from './types';

export function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Buckets pixels into 512 bins (3 bits per channel) and returns bin averages, most common first. */
export function extractPalette(pixels: Uint8ClampedArray, maxColors = 5): string[] {
  const bins = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bin = bins.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bin.r += r; bin.g += g; bin.b += b; bin.n++;
    bins.set(key, bin);
  }
  return [...bins.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, maxColors)
    .map((bin) => toHex(Math.round(bin.r / bin.n), Math.round(bin.g / bin.n), Math.round(bin.b / bin.n)));
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function familyOf(hex: string): ColorFamily {
  const { h, s, l } = hexToHsl(hex);
  if (s < 0.18 || l < 0.12 || l > 0.94) return 'neutral';
  if (h < 15 || h >= 345) return 'red';
  if (h < 40) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 170) return 'green';
  if (h < 260) return 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}

export function dominantFamily(palette: string[]): ColorFamily {
  for (const hex of palette) {
    const f = familyOf(hex);
    if (f !== 'neutral') return f;
  }
  return 'neutral';
}
```

- [ ] **Step 4: Run tests**

Run: `npm test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: color palette extraction and color families

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Image store (IndexedDB)

**Files:**
- Create: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: `SavedImage` from `./types`
- Produces: `type NewImage = Omit<SavedImage, 'id' | 'savedAt'>`; `interface ImageStore { findByUrl(url: string): Promise<SavedImage | undefined>; add(input: NewImage, blob: Blob): Promise<SavedImage>; list(): Promise<SavedImage[]>; getBlob(id: string): Promise<Blob | undefined>; setTags(id: string, tags: string[]): Promise<void>; remove(id: string): Promise<void> }`; `openImageStore(name?: string, now?: () => Date): ImageStore`; `normalizeTags(tags: string[]): string[]`. `add` rejects (ConstraintError) when `imageUrl` already exists. `list` is newest first.

- [ ] **Step 1: Write the failing test `src/lib/db.test.ts`**

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openImageStore, normalizeTags, type NewImage } from './db';

function sample(url: string): NewImage {
  return {
    imageUrl: url, pageUrl: 'https://site.com/p', pageTitle: 'Page', site: 'site.com',
    width: 300, height: 200, mimeType: 'image/png', byteSize: 3,
    palette: ['#FFD8C2'], colorFamily: 'orange', tags: [],
  };
}

function freshStore() {
  let t = Date.parse('2026-10-06T10:00:00.000Z');
  return openImageStore(`test-${crypto.randomUUID()}`, () => new Date((t += 1000)));
}

describe('ImageStore', () => {
  it('adds, finds by URL and lists newest first', async () => {
    const store = freshStore();
    const a = await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    const b = await store.add(sample('https://x.com/b.png'), new Blob([new Uint8Array([4])], { type: 'image/png' }));
    expect(a.id).not.toBe(b.id);
    expect(a.savedAt).toBe('2026-10-06T10:00:01.000Z');
    expect((await store.findByUrl('https://x.com/a.png'))?.id).toBe(a.id);
    expect((await store.list()).map((i) => i.id)).toEqual([b.id, a.id]);
  });

  it('round-trips the image bytes and type', async () => {
    const store = freshStore();
    const img = await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    const blob = await store.getBlob(img.id);
    expect(blob?.type).toBe('image/png');
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rejects a second image with the same URL', async () => {
    const store = freshStore();
    await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1])]));
    await expect(store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1])]))).rejects.toThrow();
    expect(await store.list()).toHaveLength(1);
  });

  it('sets normalized tags', async () => {
    const store = freshStore();
    const img = await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1])]));
    await store.setTags(img.id, [' Cute', 'cat ', 'cute', '']);
    expect((await store.findByUrl('https://x.com/a.png'))?.tags).toEqual(['cute', 'cat']);
  });

  it('removes the record and its bytes', async () => {
    const store = freshStore();
    const img = await store.add(sample('https://x.com/a.png'), new Blob([new Uint8Array([1])]));
    await store.remove(img.id);
    expect(await store.list()).toEqual([]);
    expect(await store.getBlob(img.id)).toBeUndefined();
  });
});

describe('normalizeTags', () => {
  it('trims, lowercases, de-duplicates and drops empties', () => {
    expect(normalizeTags([' A ', 'a', 'B', '  '])).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/db.test.ts` → Expected: FAIL, cannot resolve `./db`.

- [ ] **Step 3: Write `src/lib/db.ts`**

The image bytes are read with `blob.arrayBuffer()` *before* the transaction opens. An `await` on anything other than an IndexedDB request auto-commits the transaction.

```ts
import { openDB, type DBSchema } from 'idb';
import type { SavedImage } from './types';

interface Schema extends DBSchema {
  images: { key: string; value: SavedImage; indexes: { byUrl: string; bySavedAt: string } };
  blobs: { key: string; value: { bytes: ArrayBuffer; type: string } };
}

export type NewImage = Omit<SavedImage, 'id' | 'savedAt'>;

export interface ImageStore {
  findByUrl(url: string): Promise<SavedImage | undefined>;
  add(input: NewImage, blob: Blob): Promise<SavedImage>;
  list(): Promise<SavedImage[]>;
  getBlob(id: string): Promise<Blob | undefined>;
  setTags(id: string, tags: string[]): Promise<void>;
  remove(id: string): Promise<void>;
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

export function openImageStore(name = 'moodoodle', now: () => Date = () => new Date()): ImageStore {
  const dbp = openDB<Schema>(name, 1, {
    upgrade(db) {
      const images = db.createObjectStore('images', { keyPath: 'id' });
      images.createIndex('byUrl', 'imageUrl', { unique: true });
      images.createIndex('bySavedAt', 'savedAt');
      db.createObjectStore('blobs');
    },
  });

  return {
    async findByUrl(url) {
      return (await dbp).getFromIndex('images', 'byUrl', url);
    },
    async add(input, blob) {
      const db = await dbp;
      const bytes = await blob.arrayBuffer();
      const image: SavedImage = { ...input, id: crypto.randomUUID(), savedAt: now().toISOString() };
      const tx = db.transaction(['images', 'blobs'], 'readwrite');
      await Promise.all([
        tx.objectStore('images').add(image),
        tx.objectStore('blobs').put({ bytes, type: blob.type }, image.id),
        tx.done,
      ]);
      return image;
    },
    async list() {
      return (await (await dbp).getAllFromIndex('images', 'bySavedAt')).reverse();
    },
    async getBlob(id) {
      const row = await (await dbp).get('blobs', id);
      return row ? new Blob([row.bytes], { type: row.type }) : undefined;
    },
    async setTags(id, tags) {
      const db = await dbp;
      const tx = db.transaction('images', 'readwrite');
      const image = await tx.store.get(id);
      if (image) await tx.store.put({ ...image, tags: normalizeTags(tags) });
      await tx.done;
    },
    async remove(id) {
      const db = await dbp;
      const tx = db.transaction(['images', 'blobs'], 'readwrite');
      await Promise.all([tx.objectStore('images').delete(id), tx.objectStore('blobs').delete(id), tx.done]);
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: IndexedDB image store with URL dedupe and tags

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Keep pipeline

**Files:**
- Create: `src/lib/keep.ts`
- Test: `src/lib/keep.test.ts`

**Interfaces:**
- Consumes: `ImageStore` (Task 4), `extractPalette`, `dominantFamily` (Task 3), `isKeepableUrl` (Task 2), `KeepResult`, `MAX_BYTES` (Task 2)
- Produces: `interface Decoded { width: number; height: number; pixels: Uint8ClampedArray }`; `interface KeepDeps { store: ImageStore; fetchBlob(url: string): Promise<Blob>; decode(blob: Blob): Promise<Decoded>; maxBytes?: number }`; `interface KeepInput { imageUrl: string; pageUrl: string; pageTitle: string }`; `keepImage(deps: KeepDeps, input: KeepInput): Promise<KeepResult>`; `siteOf(url: string): string`.

- [ ] **Step 1: Write the failing test `src/lib/keep.test.ts`**

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { keepImage, siteOf, type KeepDeps } from './keep';
import { openImageStore } from './db';

const PNG = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
const peachPixels = new Uint8ClampedArray([255, 216, 194, 255, 255, 216, 194, 255]);

function deps(over: Partial<KeepDeps> = {}): KeepDeps {
  return {
    store: openImageStore(`keep-${crypto.randomUUID()}`),
    fetchBlob: vi.fn(async () => PNG()),
    decode: vi.fn(async () => ({ width: 640, height: 480, pixels: peachPixels })),
    ...over,
  };
}
const input = { imageUrl: 'https://cdn.site.com/flower.png', pageUrl: 'https://www.site.com/post', pageTitle: 'Spring doodles' };

describe('keepImage', () => {
  it('keeps an image with palette, family, site and size', async () => {
    const d = deps();
    const r = await keepImage(d, input);
    expect(r.status).toBe('kept');
    if (r.status !== 'kept') return;
    expect(r.image).toMatchObject({
      imageUrl: input.imageUrl, site: 'site.com', pageTitle: 'Spring doodles',
      width: 640, height: 480, mimeType: 'image/png', byteSize: 4,
      palette: ['#FFD8C2'], colorFamily: 'orange', tags: [],
    });
    expect(await d.store.list()).toHaveLength(1);
  });

  it('falls back to the site when the page title is blank', async () => {
    const r = await keepImage(deps(), { ...input, pageTitle: '   ' });
    expect(r.status === 'kept' && r.image.pageTitle).toBe('site.com');
  });

  it('rejects unsupported URLs without fetching', async () => {
    const d = deps();
    expect(await keepImage(d, { ...input, imageUrl: 'blob:https://site.com/1' })).toEqual({ status: 'error', reason: 'unsupported-url' });
    expect(d.fetchBlob).not.toHaveBeenCalled();
  });

  it('returns duplicate without fetching again', async () => {
    const d = deps();
    await keepImage(d, input);
    const r = await keepImage(d, input);
    expect(r.status).toBe('duplicate');
    expect(d.fetchBlob).toHaveBeenCalledTimes(1);
  });

  it('keeps only one copy when two keeps race', async () => {
    const d = deps();
    const [a, b] = await Promise.all([keepImage(d, input), keepImage(d, input)]);
    expect([a.status, b.status].sort()).toEqual(['duplicate', 'kept']);
    expect(await d.store.list()).toHaveLength(1);
  });

  it('reports a blocked download and saves nothing', async () => {
    const d = deps({ fetchBlob: vi.fn(async () => { throw new Error('403'); }) });
    expect(await keepImage(d, input)).toEqual({ status: 'error', reason: 'fetch-failed' });
    expect(await d.store.list()).toEqual([]);
  });

  it('rejects non-image responses', async () => {
    const d = deps({ fetchBlob: vi.fn(async () => new Blob(['<html>'], { type: 'text/html' })) });
    expect(await keepImage(d, input)).toEqual({ status: 'error', reason: 'not-an-image' });
  });

  it('rejects images over the size limit', async () => {
    const d = deps({ maxBytes: 3 });
    expect(await keepImage(d, input)).toEqual({ status: 'error', reason: 'too-big' });
  });

  it('reports formats it cannot decode', async () => {
    const d = deps({ decode: vi.fn(async () => { throw new Error('svg'); }) });
    expect(await keepImage(d, input)).toEqual({ status: 'error', reason: 'decode-failed' });
    expect(await d.store.list()).toEqual([]);
  });
});

describe('siteOf', () => {
  it('strips www and handles bad URLs', () => {
    expect(siteOf('https://www.dribbble.com/x')).toBe('dribbble.com');
    expect(siteOf('nope')).toBe('');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/keep.test.ts` → Expected: FAIL, cannot resolve `./keep`.

- [ ] **Step 3: Write `src/lib/keep.ts`**

```ts
import type { ImageStore } from './db';
import { extractPalette, dominantFamily } from './color';
import { isKeepableUrl } from './urls';
import { MAX_BYTES, type KeepErrorReason, type KeepResult } from './types';

export interface Decoded {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
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
}

export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const fail = (reason: KeepErrorReason): KeepResult => ({ status: 'error', reason });

export async function keepImage(deps: KeepDeps, input: KeepInput): Promise<KeepResult> {
  if (!isKeepableUrl(input.imageUrl)) return fail('unsupported-url');

  const existing = await deps.store.findByUrl(input.imageUrl);
  if (existing) return { status: 'duplicate', image: existing };

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
      },
      blob,
    );
    return { status: 'kept', image };
  } catch (e) {
    const raced = await deps.store.findByUrl(input.imageUrl);
    if (raced) return { status: 'duplicate', image: raced };
    throw e;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: keep pipeline with dedupe, size limit and friendly errors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Gallery helpers: search and zip

**Files:**
- Create: `src/lib/search.ts`, `src/lib/zip.ts`
- Test: `src/lib/search.test.ts`, `src/lib/zip.test.ts`

**Interfaces:**
- Consumes: `SavedImage`, `ColorFamily` (Task 2)
- Produces: `interface Filter { query: string; family: ColorFamily | 'all' }`; `filterImages(images: SavedImage[], f: Filter): SavedImage[]`; `slugify(s: string): string`; `fileNameFor(img: SavedImage, used: Set<string>): string`; `buildZip(items: { image: SavedImage; blob: Blob }[], includeSources: boolean): Promise<Blob>`.

- [ ] **Step 1: Write the failing tests**

`src/lib/search.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterImages } from './search';
import type { SavedImage } from './types';

const img = (id: string, over: Partial<SavedImage>): SavedImage => ({
  id, imageUrl: `https://x.com/${id}.png`, pageUrl: 'https://x.com', pageTitle: 'Untitled', site: 'x.com',
  savedAt: '2026-10-06T10:00:00.000Z', width: 1, height: 1, mimeType: 'image/png', byteSize: 1,
  palette: [], colorFamily: 'neutral', tags: [], ...over,
});

const all = [
  img('1', { pageTitle: 'Spring Doodles', site: 'dribbble.com', colorFamily: 'orange', tags: ['floral'] }),
  img('2', { pageTitle: 'Cat sketches', site: 'behance.net', colorFamily: 'purple', tags: ['cat', 'cute'] }),
  img('3', { pageTitle: 'Sun', site: 'etsy.com', colorFamily: 'yellow', tags: [] }),
];

describe('filterImages', () => {
  it('returns everything for an empty query and "all"', () => {
    expect(filterImages(all, { query: '', family: 'all' })).toHaveLength(3);
  });
  it('filters by color family', () => {
    expect(filterImages(all, { query: '', family: 'purple' }).map((i) => i.id)).toEqual(['2']);
  });
  it('matches title, site, tags and color name, case-insensitively', () => {
    expect(filterImages(all, { query: 'DOODLES', family: 'all' }).map((i) => i.id)).toEqual(['1']);
    expect(filterImages(all, { query: 'etsy', family: 'all' }).map((i) => i.id)).toEqual(['3']);
    expect(filterImages(all, { query: 'cute', family: 'all' }).map((i) => i.id)).toEqual(['2']);
    expect(filterImages(all, { query: 'yellow', family: 'all' }).map((i) => i.id)).toEqual(['3']);
  });
  it('requires every word to match', () => {
    expect(filterImages(all, { query: 'cat floral', family: 'all' })).toEqual([]);
    expect(filterImages(all, { query: '  cat   cute ', family: 'all' }).map((i) => i.id)).toEqual(['2']);
  });
});
```

`src/lib/zip.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildZip, fileNameFor, slugify } from './zip';
import type { SavedImage } from './types';

const img = (over: Partial<SavedImage>): SavedImage => ({
  id: 'a', imageUrl: 'https://x.com/a.png', pageUrl: 'https://x.com/p', pageTitle: 'Spring Doodles',
  site: 'x.com', savedAt: '2026-10-06T10:00:00.000Z', width: 1, height: 1, mimeType: 'image/png',
  byteSize: 1, palette: [], colorFamily: 'neutral', tags: [], ...over,
});

describe('slugify', () => {
  it('makes safe, readable names', () => {
    expect(slugify('Spring Doodles!')).toBe('spring-doodles');
    expect(slugify('Café / Crème 🌸 art')).toBe('cafe-creme-art');
    expect(slugify('x'.repeat(200))).toHaveLength(60);
    expect(slugify('🌸🌸')).toBe('');
  });
});

describe('fileNameFor', () => {
  it('uses title, extension from mime type, and numbers collisions', () => {
    const used = new Set<string>();
    expect(fileNameFor(img({}), used)).toBe('spring-doodles.png');
    expect(fileNameFor(img({}), used)).toBe('spring-doodles-2.png');
    expect(fileNameFor(img({ mimeType: 'image/jpeg' }), used)).toBe('spring-doodles.jpg');
  });
  it('falls back to site, then "image", and to .img for unknown types', () => {
    const used = new Set<string>();
    expect(fileNameFor(img({ pageTitle: '🌸' }), used)).toBe('x-com.png');
    expect(fileNameFor(img({ pageTitle: '', site: '', mimeType: 'image/x-weird' }), used)).toBe('image.img');
  });
});

describe('buildZip', () => {
  it('contains every image and a sources.txt when asked', async () => {
    const zipBlob = await buildZip(
      [
        { image: img({}), blob: new Blob([new Uint8Array([1])], { type: 'image/png' }) },
        { image: img({ imageUrl: 'https://x.com/b.png' }), blob: new Blob([new Uint8Array([2])], { type: 'image/png' }) },
      ],
      true,
    );
    expect(zipBlob.type).toBe('application/zip');
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(['sources.txt', 'spring-doodles-2.png', 'spring-doodles.png']);
    const sources = await zip.file('sources.txt')!.async('string');
    expect(sources.split('\n')).toEqual([
      'file\tpage\timage',
      'spring-doodles.png\thttps://x.com/p\thttps://x.com/a.png',
      'spring-doodles-2.png\thttps://x.com/p\thttps://x.com/b.png',
    ]);
  });
  it('omits sources.txt when not asked', async () => {
    const zipBlob = await buildZip([{ image: img({}), blob: new Blob([new Uint8Array([1])]) }], false);
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(Object.keys(zip.files)).toEqual(['spring-doodles.png']);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/search.test.ts src/lib/zip.test.ts` → Expected: FAIL, modules not found.

- [ ] **Step 3: Write `src/lib/search.ts`**

```ts
import type { ColorFamily, SavedImage } from './types';

export interface Filter {
  query: string;
  family: ColorFamily | 'all';
}

function haystack(img: SavedImage): string {
  return [img.pageTitle, img.site, img.colorFamily, ...img.tags].join(' ').toLowerCase();
}

export function filterImages(images: SavedImage[], f: Filter): SavedImage[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return images.filter(
    (img) =>
      (f.family === 'all' || img.colorFamily === f.family) &&
      words.every((w) => haystack(img).includes(w)),
  );
}
```

- [ ] **Step 4: Write `src/lib/zip.ts`**

Image bytes go to JSZip as `ArrayBuffer` and come out as `uint8array`, wrapped in a Blob. That works the same in Node (tests) and the browser.

```ts
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
  return new Blob([bytes], { type: 'application/zip' });
}
```

- [ ] **Step 5: Run tests**

Run: `npm test` → Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: gallery search and zip export with sources.txt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Background worker (fetch, decode, save, context menu, messages)

**Files:**
- Create: `src/lib/decode.ts`, `src/entrypoints/background.ts` (replace the template's)

**Interfaces:**
- Consumes: `keepImage`, `KeepDeps`, `Decoded` (Task 5); `openImageStore` (Task 4); `lensUrl` (Task 2); `Message`, `KeepManyResult` (Task 2)
- Produces: worker handles `Message` types `keep` → `KeepResult`, `keep-many` → `KeepManyResult`, `lens` → `boolean`; context menu ids `keep`, `lens`; after a context-menu keep it sends `{ type: 'toast', result }` to the tab.

- [ ] **Step 1: Write `src/lib/decode.ts`** (runs only in the worker. It's covered by the manual check below, because OffscreenCanvas isn't available in Node.)

```ts
import type { Decoded } from './keep';

export async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

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
```

- [ ] **Step 2: Write `src/entrypoints/background.ts`**

```ts
import { browser } from 'wxt/browser';
import { openImageStore } from '@/lib/db';
import { keepImage, type KeepDeps } from '@/lib/keep';
import { fetchBlob, decodeInWorker } from '@/lib/decode';
import { lensUrl } from '@/lib/urls';
import type { KeepManyResult, Message } from '@/lib/types';

export default defineBackground(() => {
  const deps: KeepDeps = { store: openImageStore(), fetchBlob, decode: decodeInWorker };

  async function openLens(imageUrl: string): Promise<boolean> {
    const url = lensUrl(imageUrl);
    if (url) await browser.tabs.create({ url });
    return Boolean(url);
  }

  async function handle(msg: Message): Promise<unknown> {
    switch (msg.type) {
      case 'keep':
        return keepImage(deps, msg);
      case 'keep-many': {
        const out: KeepManyResult = { kept: 0, skipped: 0 };
        for (const imageUrl of msg.imageUrls) {
          const r = await keepImage(deps, { imageUrl, pageUrl: msg.pageUrl, pageTitle: msg.pageTitle });
          if (r.status === 'kept') out.kept++;
          else out.skipped++;
        }
        return out;
      }
      case 'lens':
        return openLens(msg.imageUrl);
      default:
        return undefined;
    }
  }

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({ id: 'keep', title: 'Keep image', contexts: ['image'] });
    browser.contextMenus.create({ id: 'lens', title: 'Find similar (Google Lens)', contexts: ['image'] });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!info.srcUrl) return;
    if (info.menuItemId === 'lens') {
      await openLens(info.srcUrl);
      return;
    }
    if (info.menuItemId !== 'keep') return;
    const result = await keepImage(deps, {
      imageUrl: info.srcUrl,
      pageUrl: tab?.url ?? info.pageUrl ?? '',
      pageTitle: tab?.title ?? '',
    });
    if (tab?.id !== undefined) {
      const toast: Message = { type: 'toast', result };
      browser.tabs.sendMessage(tab.id, toast).catch(() => {});
    }
  });

  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as Message;
    if (msg.type !== 'keep' && msg.type !== 'keep-many' && msg.type !== 'lens') return false;
    handle(msg).then(sendResponse, () => sendResponse({ status: 'error', reason: 'fetch-failed' }));
    return true;
  });
});
```

- [ ] **Step 3: Verify tests and types still pass**

Run: `npm test && npx wxt prepare && npx tsc --noEmit` → Expected: all pass, no type errors.

- [ ] **Step 4: Manual check in Chrome**

Run: `npm run dev` (WXT opens Chrome with the extension loaded).
1. Open `https://commons.wikimedia.org/wiki/Category:Doodles`, right-click an image → **Keep image**.
2. Open `chrome://extensions` → moodoodle → "service worker" → DevTools → Application → IndexedDB → `moodoodle` → `images`. Expected: one record with `palette`, `colorFamily`, `site: "commons.wikimedia.org"`.
3. Right-click the same image → **Keep image** again. Expected: still one record.
4. Right-click → **Find similar (Google Lens)**. Expected: a new tab opens Lens with that image.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: background worker with context menu, keep and Lens messages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Content script: hover pill, toast, image collection

**Files:**
- Create: `src/lib/pick.ts`, `src/lib/toast.ts`, `src/entrypoints/content/index.ts`, `src/entrypoints/content/style.ts`
- Test: `src/lib/pick.test.ts`, `src/lib/toast.test.ts`
- Delete: the template's `src/entrypoints/content.ts` if present

**Interfaces:**
- Consumes: `isKeepableUrl`, `lensUrl`, `MIN_IMAGE_SIDE`, `KeepResult`, `Message` (Task 2); worker messages (Task 7)
- Produces: `pickBestSrc(img: HTMLImageElement): string | null`, `isBigEnough(img: HTMLImageElement): boolean`, `collectImageUrls(doc: Document): string[]`, `toastText(result: KeepResult): string`; the content script answers `{ type: 'collect-images' }` with `string[]` and shows `{ type: 'toast' }` messages.

- [ ] **Step 1: Write the failing tests**

`src/lib/pick.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { pickBestSrc, isBigEnough, collectImageUrls } from './pick';

function makeImg(src: string, opts: { natural?: number; shown?: number; currentSrc?: string } = {}) {
  const img = document.createElement('img');
  img.src = src;
  const natural = opts.natural ?? 300;
  const shown = opts.shown ?? 300;
  Object.defineProperty(img, 'naturalWidth', { value: natural });
  Object.defineProperty(img, 'naturalHeight', { value: natural });
  if (opts.currentSrc) Object.defineProperty(img, 'currentSrc', { value: opts.currentSrc });
  img.getBoundingClientRect = () => ({ width: shown, height: shown } as DOMRect);
  document.body.append(img);
  return img;
}

describe('pickBestSrc', () => {
  it('prefers the displayed currentSrc (srcset / lazy-load) over src', () => {
    const img = makeImg('https://x.com/placeholder.gif', { currentSrc: 'https://x.com/big@2x.png' });
    expect(pickBestSrc(img)).toBe('https://x.com/big@2x.png');
  });
  it('falls back to src and rejects unkeepable URLs', () => {
    expect(pickBestSrc(makeImg('https://x.com/a.png'))).toBe('https://x.com/a.png');
    expect(pickBestSrc(makeImg('blob:https://x.com/1'))).toBeNull();
  });
});

describe('isBigEnough', () => {
  it('hides the pill on icons and avatars', () => {
    expect(isBigEnough(makeImg('https://x.com/a.png', { shown: 300 }))).toBe(true);
    expect(isBigEnough(makeImg('https://x.com/icon.png', { shown: 32 }))).toBe(false);
  });
});

describe('collectImageUrls', () => {
  it('returns unique, large, keepable images only', () => {
    document.body.innerHTML = '';
    makeImg('https://x.com/a.png');
    makeImg('https://x.com/a.png');
    makeImg('https://x.com/pixel.gif', { natural: 1 });
    makeImg('https://x.com/b.png');
    makeImg('blob:https://x.com/1');
    expect(collectImageUrls(document)).toEqual(['https://x.com/a.png', 'https://x.com/b.png']);
  });
});
```

`src/lib/toast.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toastText } from './toast';
import type { SavedImage } from './types';

const image = { site: 'dribbble.com', colorFamily: 'orange' } as SavedImage;

describe('toastText', () => {
  it('celebrates a keep', () => {
    expect(toastText({ status: 'kept', image })).toBe('Kept! Orange · from dribbble.com');
  });
  it('explains duplicates and each error', () => {
    expect(toastText({ status: 'duplicate', image })).toBe('Already in your collection');
    expect(toastText({ status: 'error', reason: 'unsupported-url' })).toBe("This image can't be saved");
    expect(toastText({ status: 'error', reason: 'fetch-failed' })).toBe('This site blocked the download');
    expect(toastText({ status: 'error', reason: 'not-an-image' })).toBe("That link isn't an image");
    expect(toastText({ status: 'error', reason: 'too-big' })).toBe('That image is over 25 MB');
    expect(toastText({ status: 'error', reason: 'decode-failed' })).toBe("This image format isn't supported yet");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/pick.test.ts src/lib/toast.test.ts` → Expected: FAIL, modules not found.

- [ ] **Step 3: Write `src/lib/pick.ts`**

```ts
import { MIN_IMAGE_SIDE } from './types';
import { isKeepableUrl } from './urls';

export function pickBestSrc(img: HTMLImageElement): string | null {
  const src = img.currentSrc || img.src;
  return src && isKeepableUrl(src) ? src : null;
}

export function isBigEnough(img: HTMLImageElement): boolean {
  const r = img.getBoundingClientRect();
  return r.width >= MIN_IMAGE_SIDE && r.height >= MIN_IMAGE_SIDE;
}

export function collectImageUrls(doc: Document): string[] {
  const out = new Set<string>();
  for (const img of Array.from(doc.images)) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const src = pickBestSrc(img);
    if (src && w >= MIN_IMAGE_SIDE && h >= MIN_IMAGE_SIDE) out.add(src);
  }
  return [...out];
}
```

- [ ] **Step 4: Write `src/lib/toast.ts`**

```ts
import type { KeepErrorReason, KeepResult } from './types';

const ERRORS: Record<KeepErrorReason, string> = {
  'unsupported-url': "This image can't be saved",
  'fetch-failed': 'This site blocked the download',
  'not-an-image': "That link isn't an image",
  'too-big': 'That image is over 25 MB',
  'decode-failed': "This image format isn't supported yet",
};

export function toastText(result: KeepResult): string {
  if (result.status === 'kept') {
    const family = result.image.colorFamily;
    return `Kept! ${family[0].toUpperCase()}${family.slice(1)} · from ${result.image.site}`;
  }
  if (result.status === 'duplicate') return 'Already in your collection';
  return ERRORS[result.reason];
}
```

- [ ] **Step 5: Run tests**

Run: `npm test` → Expected: all pass.

- [ ] **Step 6: Write `src/entrypoints/content/style.ts`**

```ts
export const css = `
:host { all: initial; }
.bar { position: fixed; z-index: 2147483647; display: flex; gap: 6px; font: 600 14px/1 system-ui, sans-serif; }
.bar[hidden], .toast[hidden] { display: none; }
button { height: 44px; padding: 0 16px; border: 0; border-radius: 999px; cursor: pointer;
  font: inherit; box-shadow: 0 4px 14px rgba(42,36,51,.22); }
button:focus-visible { outline: 3px solid #5B3FB0; outline-offset: 2px; }
.sim { background: #FFFFFF; color: #2A2433; }
.keep { background: #2A2433; color: #FFFFFF; }
.keep:disabled { opacity: .6; cursor: progress; }
.toast { position: fixed; z-index: 2147483647; right: 24px; bottom: 24px; max-width: 360px;
  padding: 14px 18px; border-radius: 18px; background: #2A2433; color: #FFFFFF;
  font: 500 14px/1.4 system-ui, sans-serif; box-shadow: 0 12px 30px rgba(42,36,51,.3); }
`;
```

- [ ] **Step 7: Write `src/entrypoints/content/index.ts`**

```ts
import { browser } from 'wxt/browser';
import { isBigEnough, pickBestSrc, collectImageUrls } from '@/lib/pick';
import { toastText } from '@/lib/toast';
import { lensUrl } from '@/lib/urls';
import type { KeepResult, Message } from '@/lib/types';
import { css } from './style';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const host = document.createElement('moodoodle-ui');
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${css}</style>
      <div class="bar" hidden>
        <button class="sim" type="button">Similar</button>
        <button class="keep" type="button">Keep</button>
      </div>
      <div class="toast" role="status" aria-live="polite" hidden></div>`;
    document.documentElement.append(host);

    const bar = root.querySelector<HTMLDivElement>('.bar')!;
    const simBtn = root.querySelector<HTMLButtonElement>('.sim')!;
    const keepBtn = root.querySelector<HTMLButtonElement>('.keep')!;
    const toast = root.querySelector<HTMLDivElement>('.toast')!;
    let current: HTMLImageElement | null = null;
    let hideTimer = 0;
    let toastTimer = 0;

    function place(img: HTMLImageElement) {
      const r = img.getBoundingClientRect();
      bar.style.top = `${Math.max(8, r.top + 10)}px`;
      bar.style.left = `${Math.max(8, Math.min(window.innerWidth - bar.offsetWidth - 8, r.right - bar.offsetWidth - 10))}px`;
    }
    function scheduleHide() {
      clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => { bar.hidden = true; current = null; }, 250);
    }
    function showToast(text: string) {
      toast.textContent = text;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3000);
    }

    document.addEventListener('mouseover', (e) => {
      const t = e.target;
      if (t instanceof HTMLImageElement && isBigEnough(t) && pickBestSrc(t)) {
        clearTimeout(hideTimer);
        current = t;
        bar.hidden = false;
        place(t);
      }
    }, { passive: true });
    document.addEventListener('mouseout', (e) => { if (e.target === current) scheduleHide(); }, { passive: true });
    bar.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    bar.addEventListener('mouseleave', scheduleHide);
    window.addEventListener('scroll', () => { if (current && !bar.hidden) place(current); }, { passive: true, capture: true });

    keepBtn.addEventListener('click', async () => {
      const src = current && pickBestSrc(current);
      if (!src) return;
      keepBtn.disabled = true;
      try {
        const msg: Message = { type: 'keep', imageUrl: src, pageUrl: location.href, pageTitle: document.title };
        const result = (await browser.runtime.sendMessage(msg)) as KeepResult;
        showToast(toastText(result));
      } catch {
        showToast('Something went wrong. Try again?');
      } finally {
        keepBtn.disabled = false;
      }
    });

    simBtn.addEventListener('click', () => {
      const src = current && pickBestSrc(current);
      if (!src) return;
      if (!lensUrl(src)) {
        showToast('Find similar only works for images with a web address');
        return;
      }
      const msg: Message = { type: 'lens', imageUrl: src };
      browser.runtime.sendMessage(msg);
    });

    browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
      const msg = raw as Message;
      if (msg.type === 'toast') showToast(toastText(msg.result));
      if (msg.type === 'collect-images') sendResponse(collectImageUrls(document));
      return false;
    });
  },
});
```

- [ ] **Step 8: Manual check in Chrome**

Run: `npm run dev`. On `https://commons.wikimedia.org/wiki/Category:Doodles`:
1. Hover a large image → the pill appears at its top-right. Hover a small icon → no pill.
2. Move from the image onto the pill → it stays. Move away → it hides after about ¼ s.
3. Press **Keep** → toast "Kept! … · from commons.wikimedia.org". Press again → "Already in your collection".
4. Press **Similar** → a Lens tab opens.
5. Right-click Keep on a new image → the same toast appears.
6. Scroll with the pill showing → it follows the image.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: content script hover pill, toasts and image collection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Gallery page

**Files:**
- Create: `src/assets/tokens.css`, `src/entrypoints/gallery/index.html`, `src/entrypoints/gallery/main.ts`, `src/entrypoints/gallery/App.svelte`

**Interfaces:**
- Consumes: `openImageStore` (Task 4), `filterImages` (Task 6), `buildZip` (Task 6), `lensUrl` (Task 2), `COLOR_FAMILIES`, `ColorFamily`, `SavedImage` (Task 2)
- Produces: extension page at `browser.runtime.getURL('/gallery.html')`, reads an optional `?q=` initial search.

- [ ] **Step 1: Write `src/assets/tokens.css`**

```css
:root {
  --ground: #F7F5FB; --ink: #2A2433; --muted: #6E6578; --line: #E7E1F2;
  --accent: #FFB58F; --focus: #5B3FB0; --card: #FFFFFF;
  --display: 'Bricolage Grotesque', system-ui, sans-serif;
  --body: 'Figtree', system-ui, sans-serif;
  --hand: 'Caveat', cursive;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink); font-family: var(--body); }
button, input { font: inherit; color: inherit; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

- [ ] **Step 2: Write `src/entrypoints/gallery/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>moodoodle · my collection</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Write `src/entrypoints/gallery/main.ts`**

```ts
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/600.css';
import '@fontsource/caveat/600.css';
import '@/assets/tokens.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
```

- [ ] **Step 4: Write `src/entrypoints/gallery/App.svelte`**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { openImageStore } from '@/lib/db';
  import { filterImages } from '@/lib/search';
  import { buildZip } from '@/lib/zip';
  import { lensUrl } from '@/lib/urls';
  import { COLOR_FAMILIES, type ColorFamily, type SavedImage } from '@/lib/types';

  const store = openImageStore();
  let images = $state<SavedImage[]>([]);
  const thumbs = $state<Record<string, string>>({});
  let query = $state(new URLSearchParams(location.search).get('q') ?? '');
  let family = $state<ColorFamily | 'all'>('all');
  const selected = new SvelteSet<string>();
  let tagDraft = $state('');
  let includeSources = $state(true);
  let busy = $state(false);

  const visible = $derived(filterImages(images, { query, family }));
  const only = $derived(selected.size === 1 ? images.find((i) => selected.has(i.id)) : undefined);
  const chips: (ColorFamily | 'all')[] = ['all', ...COLOR_FAMILIES];
  const label = (f: string) => f[0].toUpperCase() + f.slice(1);

  async function load() {
    images = await store.list();
    for (const img of images) {
      if (thumbs[img.id]) continue;
      const blob = await store.getBlob(img.id);
      if (blob) thumbs[img.id] = URL.createObjectURL(blob);
    }
  }

  onMount(() => {
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });

  $effect(() => { tagDraft = only ? only.tags.join(', ') : ''; });

  function toggle(id: string) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
  }

  async function saveTags() {
    if (!only) return;
    await store.setTags(only.id, tagDraft.split(','));
    await load();
  }

  async function download() {
    busy = true;
    try {
      const items: { image: SavedImage; blob: Blob }[] = [];
      for (const image of images.filter((i) => selected.has(i.id))) {
        const blob = await store.getBlob(image.id);
        if (blob) items.push({ image, blob });
      }
      const zip = await buildZip(items, includeSources);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zip);
      a.download = `moodoodle-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!confirm(`Remove ${selected.size} from your collection?`)) return;
    for (const id of [...selected]) {
      await store.remove(id);
      if (thumbs[id]) { URL.revokeObjectURL(thumbs[id]); delete thumbs[id]; }
    }
    selected.clear();
    await load();
  }

  function similar() {
    const url = only && lensUrl(only.imageUrl);
    if (url) window.open(url, '_blank', 'noopener');
  }
</script>

<main>
  <header>
    <div class="brand">
      <span class="word">moodoodle</span>
      <span class="hand">{images.length} little treasures</span>
    </div>
    <div class="search">
      <label for="q" class="sr">Search your saves</label>
      <input id="q" type="search" placeholder="Search tags, sites, colors…" bind:value={query} />
    </div>
  </header>

  <div class="chips" role="group" aria-label="Filter by color">
    {#each chips as f (f)}
      <button type="button" class="chip" class:on={family === f} aria-pressed={family === f} onclick={() => (family = f)}>
        <span class="dot {f}"></span>{label(f)}
      </button>
    {/each}
  </div>

  {#if images.length === 0}
    <section class="empty">
      <p class="hand big">Nothing kept yet</p>
      <p>Hover any image on the web and press <strong>Keep</strong>, or right-click it and choose <strong>Keep image</strong>.</p>
    </section>
  {:else if visible.length === 0}
    <section class="empty"><p>No saves match that. Try another word or color.</p></section>
  {:else}
    <div class="grid">
      {#each visible as img (img.id)}
        <button type="button" class="tile" class:on={selected.has(img.id)} aria-pressed={selected.has(img.id)} onclick={() => toggle(img.id)}>
          {#if thumbs[img.id]}
            <img src={thumbs[img.id]} alt={img.pageTitle} width={img.width} height={img.height} loading="lazy" />
          {/if}
          <span class="meta">
            <span class="title">{img.pageTitle}</span>
            <span class="sub">{img.site}{img.tags.length ? ` · ${img.tags.join(', ')}` : ''}</span>
            <span class="palette" aria-hidden="true">
              {#each img.palette as hex}<span style="background:{hex}"></span>{/each}
            </span>
          </span>
        </button>
      {/each}
    </div>
  {/if}

  {#if selected.size > 0}
    <div class="selbar">
      <span class="hand">{selected.size} picked</span>
      {#if only}
        <label for="tags" class="sr">Tags, separated by commas</label>
        <input id="tags" class="tags" placeholder="add tags, like cute, cat" bind:value={tagDraft} onchange={saveTags} />
        <button type="button" class="light" onclick={similar}>Find similar</button>
      {/if}
      <button type="button" class="accent" onclick={download} disabled={busy}>{busy ? 'Packing…' : 'Download .zip'}</button>
      <label class="check"><input type="checkbox" bind:checked={includeSources} /> with sources</label>
      <button type="button" class="ghost" onclick={remove}>Remove</button>
    </div>
  {/if}
</main>

<style>
  main { max-width: 1240px; margin: 0 auto; padding: 28px 24px 140px; display: flex; flex-direction: column; gap: 28px; }
  header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; }
  .brand { display: flex; flex-direction: column; }
  .word { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; line-height: 1; }
  .hand { font-family: var(--hand); font-size: 20px; color: var(--muted); }
  .big { font-size: 32px; color: var(--ink); margin: 0; }
  .search { flex: 1 1 320px; max-width: 520px; }
  .search input { width: 100%; height: 52px; padding: 0 20px; border: 2px solid var(--line); border-radius: 999px; background: var(--card); font-size: 16px; }
  .chips { display: flex; flex-wrap: wrap; gap: 10px; }
  .chip { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px; border-radius: 999px; border: 2px solid var(--line); background: var(--card); font-weight: 600; cursor: pointer; }
  .chip.on { background: var(--ink); border-color: var(--ink); color: #FFFFFF; }
  .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line); }
  .dot.all { background: conic-gradient(#FFB4A2, #FFE27A, #A8E6C1, #A9CCF5, #C9B8FA, #FFB4A2); }
  .dot.red { background: #F28B82; } .dot.orange { background: #FFB58F; } .dot.yellow { background: #FFE27A; }
  .dot.green { background: #A8E6C1; } .dot.blue { background: #A9CCF5; } .dot.purple { background: #C9B8FA; }
  .dot.pink { background: #F7B2D9; } .dot.neutral { background: #D9D4E0; }
  .grid { column-width: 230px; column-gap: 18px; }
  .tile { display: block; width: 100%; margin: 0 0 18px; padding: 0; break-inside: avoid; border: 0; border-radius: 22px; overflow: hidden; background: var(--card); text-align: left; cursor: pointer; box-shadow: 0 0 0 3px transparent, 0 2px 0 var(--line); transition: transform .15s ease; }
  .tile:hover { transform: translateY(-2px) rotate(-0.4deg); }
  .tile.on { box-shadow: 0 0 0 3px var(--ink), 0 2px 0 var(--line); }
  .tile img { display: block; width: 100%; height: auto; }
  .meta { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px 14px; }
  .title { font-weight: 600; font-size: 15px; }
  .sub { font-size: 13px; color: var(--muted); }
  .palette { display: flex; gap: 4px; }
  .palette span { width: 14px; height: 14px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(42,36,51,.12); }
  .empty { text-align: center; padding: 80px 16px; color: var(--muted); }
  .selbar { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; max-width: calc(100vw - 32px); padding: 10px 10px 10px 24px; border-radius: 28px; background: var(--ink); color: #FFFFFF; box-shadow: 0 12px 30px rgba(42,36,51,.25); }
  .selbar .hand { color: #FFFFFF; font-size: 24px; }
  .selbar button { height: 44px; padding: 0 18px; border-radius: 999px; font-weight: 600; cursor: pointer; }
  .light { border: 0; background: #FFFFFF; color: var(--ink); }
  .accent { border: 0; background: var(--accent); color: var(--ink); }
  .ghost { border: 2px solid #8C83A0; background: transparent; color: #FFFFFF; }
  .tags { height: 44px; padding: 0 16px; border: 0; border-radius: 999px; min-width: 200px; color: var(--ink); }
  .check { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #E7E1F2; }
</style>
```

- [ ] **Step 5: Verify types and build**

Run: `npm test && npx tsc --noEmit && npm run build` → Expected: passes, and `.output/chrome-mv3/gallery.html` exists.

- [ ] **Step 6: Manual check**

With `npm run dev`, keep 4–5 images from different sites, then open `chrome-extension://<id>/gallery.html` (the id is on `chrome://extensions`).
1. Grid shows the images with titles, site and palette dots. The header count matches.
2. Type a site name → filtered. Click a color chip → filtered. "All" resets.
3. Click 3 tiles → bar shows "3 picked". **Download .zip** → zip contains 3 images and `sources.txt`.
4. Select exactly 1 → type `cute, Cat` and press Enter/Tab → tile subtitle shows `cute, cat`. Search `cat` finds it.
5. **Remove** → confirm → tiles disappear and stay gone after reload.
6. Remove everything → the empty state shows.
7. Narrow the window to 390 px → there's no horizontal scroll and the bar wraps.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: gallery page with search, color filters, tags, zip and remove

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Toolbar popup

**Files:**
- Create/replace: `src/entrypoints/popup/index.html`, `src/entrypoints/popup/main.ts`, `src/entrypoints/popup/App.svelte`

**Interfaces:**
- Consumes: `openImageStore` (Task 4); `Message`, `KeepManyResult`, `SavedImage` (Task 2); content `collect-images` (Task 8); worker `keep-many` (Task 7); gallery `?q=` (Task 9)
- Produces: the browser-action popup.

- [ ] **Step 1: Write `src/entrypoints/popup/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>moodoodle</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `src/entrypoints/popup/main.ts`**

```ts
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/600.css';
import '@fontsource/caveat/600.css';
import '@/assets/tokens.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
```

- [ ] **Step 3: Write `src/entrypoints/popup/App.svelte`**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import { openImageStore } from '@/lib/db';
  import type { KeepManyResult, Message, SavedImage } from '@/lib/types';

  type Tab = Awaited<ReturnType<typeof browser.tabs.query>>[number];
  const store = openImageStore();
  let recent = $state<{ img: SavedImage; url: string }[]>([]);
  let found = $state<string[] | null>(null);
  let status = $state('');
  let query = $state('');
  let busy = $state(false);
  let todayCount = $state(0);
  let tab: Tab | undefined;

  async function loadRecent() {
    const all = await store.list();
    const today = new Date().toISOString().slice(0, 10);
    todayCount = all.filter((i) => i.savedAt.startsWith(today)).length;
    const next: { img: SavedImage; url: string }[] = [];
    for (const img of all.slice(0, 6)) {
      const blob = await store.getBlob(img.id);
      if (blob) next.push({ img, url: URL.createObjectURL(blob) });
    }
    recent.forEach((r) => URL.revokeObjectURL(r.url));
    recent = next;
  }

  onMount(async () => {
    loadRecent();
    [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return;
    try {
      const msg: Message = { type: 'collect-images' };
      found = (await browser.tabs.sendMessage(tab.id, msg)) as string[];
    } catch {
      found = null;
      status = "Can't read this page. Try reloading it.";
    }
  });

  async function keepAll() {
    if (!found?.length || !tab) return;
    busy = true;
    const msg: Message = { type: 'keep-many', imageUrls: found, pageUrl: tab.url ?? '', pageTitle: tab.title ?? '' };
    const res = (await browser.runtime.sendMessage(msg)) as KeepManyResult;
    status = `Kept ${res.kept}${res.skipped ? ` · ${res.skipped} skipped` : ''}`;
    busy = false;
    loadRecent();
  }

  function openGallery(q = '') {
    const path = q ? `/gallery.html?q=${encodeURIComponent(q)}` : '/gallery.html';
    browser.tabs.create({ url: browser.runtime.getURL(path as '/gallery.html') });
    window.close();
  }
</script>

<div class="pop">
  <div class="top">
    <span class="word">moodoodle</span>
    <span class="hand">{todayCount} kept today</span>
  </div>
  <form onsubmit={(e) => { e.preventDefault(); openGallery(query); }}>
    <label for="pq" class="sr">Search saves</label>
    <input id="pq" type="search" placeholder="Find a save…" bind:value={query} />
  </form>
  {#if recent.length}
    <span class="label">Recently kept</span>
    <div class="recent">
      {#each recent as r (r.img.id)}<img src={r.url} alt={r.img.pageTitle} />{/each}
    </div>
  {/if}
  {#if found}
    <div class="card">
      <div class="col">
        <span class="strong">Keep all on this page</span>
        <span class="muted">{found.length} images found</span>
      </div>
      <button type="button" class="dark" onclick={keepAll} disabled={busy || found.length === 0}>
        {busy ? 'Keeping…' : `Keep ${found.length}`}
      </button>
    </div>
  {/if}
  {#if status}<p class="status" role="status">{status}</p>{/if}
  <button type="button" class="open" onclick={() => openGallery()}>Open my collection</button>
</div>

<style>
  .pop { width: 360px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .word { font-family: var(--display); font-weight: 800; font-size: 22px; letter-spacing: -0.02em; }
  .hand { font-family: var(--hand); font-size: 19px; color: var(--muted); }
  input[type='search'] { width: 100%; height: 44px; padding: 0 16px; border: 2px solid var(--line); border-radius: 999px; background: var(--card); }
  .label { font-weight: 600; font-size: 13px; color: var(--muted); }
  .recent { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .recent img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 14px; background: var(--line); }
  .card { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; border-radius: 16px; background: var(--card); }
  .col { display: flex; flex-direction: column; gap: 2px; }
  .strong { font-weight: 600; font-size: 15px; }
  .muted { font-size: 13px; color: var(--muted); }
  .dark { height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--ink); color: #FFFFFF; font-weight: 600; cursor: pointer; }
  .dark:disabled { opacity: .6; }
  .status { margin: 0; font-size: 14px; color: var(--ink); }
  .open { height: 48px; border: 0; border-radius: 999px; background: var(--accent); color: var(--ink); font-weight: 600; cursor: pointer; }
</style>
```

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npm run build` → Expected: passes.

- [ ] **Step 5: Manual check**

With `npm run dev`:
1. On a doodle page, open the popup → it shows "N images found". **Keep N** → "Kept X · Y skipped", and recent thumbnails update.
2. Press it again → "Kept 0 · N skipped".
3. Type `cat` + Enter → the gallery opens with `cat` in search.
4. Open the popup on `chrome://extensions` → "Can't read this page…" and no Keep-all card; **Open my collection** still works.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: toolbar popup with recent keeps, keep-all and search

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Store-ready packaging

**Files:**
- Replace: `src/assets/icon.svg` (final icon)
- Create: `docs/privacy.md`, `docs/store-listing.md`, `README.md`

**Interfaces:**
- Consumes: everything above
- Produces: `.output/moodoodle-<version>-chrome.zip` ready to upload.

- [ ] **Step 1: Final icon**

Replace `src/assets/icon.svg` with the chosen brand mark (keep the 128×128 viewBox and a solid background so it reads at 16 px). Run `npm run build` and check `.output/chrome-mv3/icon/16.png` and `128.png` exist and look right.

- [ ] **Step 2: Write `docs/privacy.md`**

```markdown
# moodoodle privacy policy

moodoodle keeps everything on your computer. Images you keep, their source links, tags and
colors are stored in your browser and never sent to us. We have no servers and collect
no analytics.

The only time information leaves your browser is when you press **Find similar**: moodoodle
opens Google Lens in a new tab with the address of that image. Google's privacy policy
applies to that page.

Uninstalling moodoodle deletes everything it stored.

Contact: [YOUR SUPPORT EMAIL]
```

- [ ] **Step 3: Write `docs/store-listing.md`**

```markdown
# Chrome Web Store listing

**Name:** moodoodle
**Summary (≤132 chars):** Keep the drawings and designs you love from any site, find more like them, and take them anywhere.
**Category:** Productivity → Tools
**Single purpose:** Save images you like from web pages into a private, searchable collection.

**Permission justifications**
- `<all_urls>` host access: to show the Keep button on images on any site you visit and to download the image you choose to keep.
- `contextMenus`: adds "Keep image" and "Find similar" to the right-click menu on images.
- `unlimitedStorage`: your collection is stored locally and can grow past the default quota.

**Data use disclosure:** collects no user data. Nothing is sold or transferred.

**Screenshots (1280×800):** the gallery, the hover pill on a page, the popup, the zip export.
```

- [ ] **Step 4: Write `README.md`**

```markdown
# moodoodle

Keep the designs you love. Find more like them.

    npm install
    npm run dev     # launches Chrome with the extension
    npm test        # unit tests
    npm run zip     # store-ready zip in .output/

Spec: docs/spec.md · Plan: docs/superpowers/plans/2026-10-06-v1-extension.md
```

- [ ] **Step 5: Final verification**

Run: `npm test && npx tsc --noEmit && npm run zip` → Expected: all pass, and a `.output/*-chrome.zip` exists. Load it via `chrome://extensions` → "Load unpacked" on `.output/chrome-mv3` in a fresh Chrome profile, then repeat the manual checks from Tasks 8–10 once.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: icon, privacy policy, store listing and README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Known limitations (by design for v1)

- Images under a transparent overlay (Pinterest-style) don't trigger the hover pill, because the
  overlay receives the mouse. Right-click doesn't reach them either. A v1.1 candidate fix is
  `document.elementsFromPoint` on `mousemove`.
- Sites that block hotlinking can't be kept (the user gets a clear toast). v2 fallback: read the pixels
  from the page.
- CSS background images aren't detected.
