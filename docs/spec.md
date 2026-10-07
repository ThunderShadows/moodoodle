# moodoodle: v1 spec

**Date:** 2026-10-06
**Status:** approved scope, pre-build
**Mockups:** https://claude.ai/artifact/Drac1KrbXeNR5f1SAPRHnb

## 1. What it is

A Chrome extension for everyday people who spot a drawing, doodle or design they like
while browsing. It does three things:

1. **Keep:** save an image in one click, with its source page, date and color palette.
2. **Find:** browse and search the collection in a soft, playful gallery. "Find similar"
   opens Google Lens for any kept image.
3. **Take:** pick a few and download them as a `.zip`, with a `sources.txt` of where each
   came from.

Goal: side income. First milestone is *any* paying user. v1 itself is free; payments
come in v1.1 (see §7).

## 2. Principles

- **Simple, fun, minimal, design-friendly.** Every screen in the mockups, nothing more.
- **Local-first.** No backend, no accounts, no analytics. Everything lives in the browser's
  IndexedDB. The only thing that leaves the machine is the image address, and only when
  the user presses "Find similar".
- **No dead ends.** Every failure gives a friendly message ("This site blocked the
  download") and never leaves a half-saved item.

## 3. Surfaces

| Surface | What it does |
|---|---|
| **Hover toolbar** (content script) | On any image ≥120×120 px shown on screen, a small pill appears at its top-right with **Similar** and **Keep**. A toast confirms the result. |
| **Right-click menu** | On any image: "Keep image" and "Find similar (Google Lens)". Same toast. |
| **Toolbar popup** | Search box, 6 most recent keeps, "Keep all on this page (N images found)", "Open my collection". |
| **Gallery page** | Masonry grid, search (title/site/tags/color), color-family filter chips, click to select. Selection bar: Find similar (1 selected), Download .zip, Delete, and a tags field (1 selected). Empty state explains how to keep the first image. |

## 4. Data

`SavedImage` (IndexedDB store `images`, keyPath `id`, unique index on `imageUrl`):

| Field | Type | Notes |
|---|---|---|
| `id` | string | `crypto.randomUUID()` |
| `imageUrl` | string | http(s) or `data:image/…`; unique. This is the dedupe key |
| `pageUrl`, `pageTitle`, `site` | string | site = hostname without `www.`; empty title falls back to site |
| `savedAt` | string | ISO 8601 UTC, e.g. `2026-10-06T13:00:00.000Z` |
| `width`, `height` | number | natural pixel size |
| `mimeType`, `byteSize` | string, number | from the fetched blob |
| `palette` | string[] | up to 5 `#RRGGBB`, most common first |
| `colorFamily` | enum | red, orange, yellow, green, blue, purple, pink, neutral |
| `tags` | string[] | lowercase, trimmed, de-duplicated |

Image bytes go in a separate store `blobs` (key = `id`, value = `{ bytes: ArrayBuffer, type: string }`).

## 5. Rules

- Accept only http(s) and `data:image/` URLs. Anything else (`blob:`, `chrome:`) → "This image can't be saved."
- Max image size: 25 MB.
- Saving an image whose URL is already kept → "Already in your collection" (no second copy).
- Images are fetched by the background worker (it has host permission, so it bypasses page CORS).
  A 4xx/5xx → "This site blocked the download".
- Formats that `createImageBitmap` can't decode in the worker (e.g. SVG) → "This image format isn't supported yet".
- Zip file names come from the page title (falls back to site, then `image`) plus an extension from the
  mime type, with `-2`, `-3`… for collisions.

## 6. Look

Taken from the mockups: ground `#F7F5FB`, ink `#2A2433`, muted `#6E6578`, line `#E7E1F2`,
accent `#FFB58F`. Pastel tiles. Fonts: Bricolage Grotesque (display), Figtree (body),
Caveat (handwritten notes), bundled through `@fontsource`. No remote fonts, and no
custom fonts in the content script. Touch targets ≥44 px; text contrast ≥4.5:1.

## 7. Out of scope for v1 (planned)

- **v1.1 payments:** ExtensionPay (fastest, ~5% + Stripe, no backend) or Lemon Squeezy
  (merchant of record that handles VAT, license keys, 5% + $0.50). Decide at v1.1.
- **v2:** AI auto-tags (style/subject), "similar in my collection" (in-browser image
  embeddings), **Send to Canva**: upload to the user's Canva library through the Connect
  Assets API (OAuth, so it needs a small backend plus Canva review). Filling a template
  (Autofill / Brand Templates) needs Canva Enterprise, so it's not planned.
- **Next differentiator:** save with credit (creator/license capture, reuse badges, `CREDITS.md`).
  See `docs/research/2026-10-07-novelty-policy-review.md`.
- Firefox/Safari, sync between devices.

## 8. Never build

- Grabbing pixels from the page's own canvas when a site blocks the download. That gets around
  the site's restriction, which the Chrome Web Store treats as facilitating unauthorized access.
- Store or UI copy that says "scrape" or "download any image".
