# moodoodle v1.2: Boards + Save with credit

**Date:** 2026-10-07
**Status:** reviewed 2026-10-07 (answers in §11); find-similar data source pending
**Builds on:** `docs/spec.md` (v1), `docs/research/2026-10-07-novelty-policy-review.md`

## 1. Why

Audience: **hobby and indie artists collecting reference images.** Research says they:

- collect references across ArtStation, Behance, Dribbble, Cara, DeviantArt and blogs, and lose track of them
  (**fragmentation**);
- organize references into per-project folders before drawing (we have tags, **no boards**);
- lose the original artist's name and link once an image is saved or reposted (**attribution mess**);
- are wary of tools that bulk-collect art, after AI scraping (Cara was itself scraped in 2026).

v1.2 answers with two features and one promise:

1. **Boards**: group keeps into projects, and pick the board you're filling while you browse.
2. **Save with credit**: every keep records who made it and what reuse is allowed, shown on the tile and
   written into exports.
3. **Respect artists**: honor "NoAI" opt-outs and never bulk-collect from artist platforms.

No competitor we found does 2 or 3. That's the differentiator against Moodsnap.

## 2. Goals and non-goals

**Goals**
- File a keep into a project in zero extra clicks while browsing (the "keeping into" board).
- Show the creator and a reuse badge for every image, with an honest "unknown" when we can't tell.
- Exports that are ready to credit: `CREDITS.md` per zip, per board.
- Stay local-first: no new servers and no new permissions.

**Non-goals (v1.2)**
- Payments and their enforcement (limits are *defined* here; enforcement ships with Dodo Payments).
- PureRef drag-out (folder export through the zip covers it for now), palette swatch export, AI features.
- Site-specific scrapers written from guesses (see §5.4: adapters only where generic extraction is proven to fail).
- Image-level legal advice: badges describe what the page *states*, not what the law allows.

## 3. Boards

### 3.1 Behavior

- A **board** has a name and an accent color (from the pastel set). An image can be in **any number of boards**.
- Gallery sidebar (a top row on phone width): **All** · **Unsorted** · each board with its count, then
  **+ New board**. Selecting a board filters the grid; search and color chips still apply on top.
- **Keeping into:** the popup has a board picker ("Keeping into: Ocean study ▾", default *None*).
  The choice is saved, and every new keep (hover Keep, right-click, Keep all) lands in that board.
  The keep toast says "Kept to Ocean study".
- Selection bar gains **Add to board ▾** (choose an existing board or create one inline) and,
  when viewing a board, **Remove from board** (the image stays in the library).
- Board menu (⋯ on the board): rename, change color, **Download board** (zip of the whole board),
  delete board. Deleting asks for confirmation, keeps the images, and clears "keeping into" if it pointed there.
- Removing an image from the library removes it from every board.

### 3.2 Free vs paid (agreed; enforced when payments ship)

| | Free | Plus |
|---|---|---|
| Boards | **3** | Unlimited |
| Images per board | **Unlimited** | Unlimited |
| Images in the library | Unlimited | Unlimited |
| Credits, badges, CREDITS.md | ✅ | ✅ |

There's no image cap anywhere: images live on the user's own disk (`unlimitedStorage`), so a cap would
cost us nothing to lift and would only feel petty. The free tier is the number of boards.

**How the free tier is shown** (mockup: "Boards sidebar: free tier at its limit"):
- Under the board list, a 3-dot meter and "2 of 3 free boards". Always visible, never a popup.
- At 3 of 3, "+ New board" is replaced by a small card: *"Need another board? Free includes 3 boards with
  as many images as you like. Plus unlocks unlimited boards."* with **See Plus** and **Tidy a board**.
- Nothing is ever locked or hidden: existing boards, keeping, credits and exports keep working.

Credits stay free on purpose: they're the trust story, and charging for attribution would undercut it.

## 4. Save with credit

### 4.1 What the user sees

- **Tile:** under the title, `by <Creator>` (linked when we have a profile URL) and a **reuse badge**:

  | Badge | When |
  |---|---|
  | **Free to reuse** (green) | CC0, Public Domain Mark, CC BY, CC BY-SA |
  | **Reuse with conditions** (amber) | CC BY-NC, BY-ND, BY-NC-SA, BY-NC-ND (tooltip spells out the conditions) |
  | **Reference only** (neutral) | All rights reserved, *or anything we can't determine* |
  | **No AI** chip (extra) | Page or file carries a NoAI / NoImageAI opt-out |

  Default is **Reference only**. We never upgrade an image to "reusable" without a stated license.
- **Details panel** (opens when exactly one image is selected; replaces the tag field in the selection bar):
  preview, title, creator + link, license with a link to its deed, copyright notice, where each fact came
  from ("from the page's image metadata", "from the file", "you edited this"), source page, tags.
  Every credit field is **editable**; edited fields are marked "you edited this" and never overwritten.
- **Exports:** every zip includes `CREDITS.md` (replaces `sources.txt`); the toggle becomes "with credits".

### 4.2 CREDITS.md format

Creative Commons TASL style (title, author, source, license), one entry per file:

```markdown
# Credits

## spring-sketchbook.png
- **Title:** Spring sketchbook
- **Creator:** Jane Doe (https://example.com/janedoe)
- **Source:** https://example.com/post/123
- **License:** CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
- **Credit line:** "Spring sketchbook" by Jane Doe, CC BY 4.0

## ocean-study.jpg
- **Title:** Ocean study
- **Creator:** unknown
- **Source:** https://example.com/gallery/ocean
- **License:** not stated, treat as all rights reserved (reference only)
```

The credit line is only produced when creator and license are both known.

## 5. Credit extraction

### 5.1 Where it runs

| Step | Runs in | Why |
|---|---|---|
| Page metadata (JSON-LD, meta tags, `rel="license"`, NoAI) for the kept `<img>` | **Content script** at keep time | Needs the live DOM |
| File metadata (XMP) | **Worker**, from the fetched bytes | We already fetch the file |
| Merge + store | **Worker** (`keepImage`) | One place decides |

Message changes: `keep` and `keep-many` carry `pageCredit` (per image URL for keep-many).
For a right-click keep, the worker asks the tab with a new `credit-for { imageUrl }` message, and
proceeds with no page credit if the tab doesn't answer (e.g. the content script isn't injected).

### 5.2 Sources, in priority order

1. **User edits**: always win, never overwritten.
2. **JSON-LD `ImageObject`** whose `contentUrl`/`url` matches the image (also inside `@graph` and as `image` of
   an `Article`/`CreativeWork`): `creator.name`/`creator.url`, `creditText`, `copyrightNotice`, `license`,
   `acquireLicensePage`, `name`. This is the format Google documents for image license metadata.
3. **XMP in the file** (text packet `<x:xmpmeta … </x:xmpmeta>`): `dc:creator`, `dc:rights`,
   `xmpRights:WebStatement`, `cc:license`, `plus:Licensor`.
4. **`rel="license"` link** on the page (`<a rel="license" href="…creativecommons.org/licenses/…">`):
   gives the license only.
5. **Page meta (inferred):** `meta[name=author]`, `article:author`, `twitter:creator`. Creator only, marked
   *inferred* in the details panel ("probably by …").

Each field records its source. `confidence` is `stated` (2–4), `inferred` (5 only) or `none`.

### 5.3 License normalization

A pure function `parseLicense(url | text) → License`:
- CC URLs `creativecommons.org/licenses/<code>/<version>/` → `{ kind: 'cc', code: 'by'|'by-sa'|'by-nc'|'by-nd'|'by-nc-sa'|'by-nc-nd', version }`
- `…/publicdomain/zero/…` → `cc0`; `…/publicdomain/mark/…` → `public-domain`
- `©`/"All rights reserved" text → `all-rights-reserved` (keep the notice)
- anything else → `unknown` (keep the raw URL/text for the details panel)

Badge = f(license) per the §4.1 table.

### 5.4 Site adapters (only with evidence)

Generic extraction is built and measured first. For each target site (ArtStation, Behance, Dribbble, Cara,
DeviantArt, Flickr, Wikimedia Commons) we save one real page as a **test fixture**, record what generic
extraction finds, and add a small adapter **only for sites where the creator is missing**. Adapters return
the same shape as generic extraction, are tested only against fixtures, and their failure is silent
(fall back to generic). No adapter ships without a fixture.

## 6. Respect artists

- **NoAI detection:** `<meta name="robots" content="…noai…|…noimageai…">` (any case), the same in
  `X-Robots-Tag`-style meta variants, and an XMP `plus:DataMining` value prohibiting AI/ML use. Sets `noAI: true`.
- **Bulk keep is off** when the page has a NoAI opt-out **or** is on an artist-platform list
  (artstation.com, cara.app, deviantart.com, behance.net, dribbble.com). The popup's Keep-all card says:
  *"Artists here asked not to be collected in bulk. Keep the ones you love one at a time."* The worker also
  refuses `keep-many` for those pages (defense in depth).
- **Single Keep stays allowed everywhere**: saving a reference for yourself is the core use. The credit is
  recorded and the No AI chip shown.
- **Future AI features** (auto-tags, similar-in-collection) will **skip `noAI` images**. Recorded here so
  it isn't forgotten.
- **Find similar** stays available for every image, NoAI included: it's a search the user starts, not AI training.

## 7. Data model

DB version **3** (upgrades v1/v2 in place):

```ts
interface Board {
  id: string;              // crypto.randomUUID()
  name: string;            // 1–40 chars, trimmed, unique case-insensitively
  color: BoardColor;       // 'peach' | 'mint' | 'lilac' | 'butter' | 'sky' | 'rose'
  createdAt: string;       // ISO 8601 UTC
}

type License =
  | { kind: 'cc'; code: 'by' | 'by-sa' | 'by-nc' | 'by-nd' | 'by-nc-sa' | 'by-nc-nd'; version?: string; url: string }
  | { kind: 'cc0' | 'public-domain'; url?: string }
  | { kind: 'all-rights-reserved'; notice?: string }
  | { kind: 'unknown'; raw?: string };

type CreditSource = 'user' | 'json-ld' | 'xmp' | 'rel-license' | 'meta' | `site:${string}`;

interface Credit {
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

// SavedImage gains:
//   boardIds: string[]   (multiEntry index 'byBoard')
//   credit: Credit
```

- New store `boards` (keyPath `id`). Settings key `keepingIntoBoardId` lives in `chrome.storage.local`
  (the worker and popup both read it; there's no IndexedDB access from content scripts).
- **Migration:** existing images get `boardIds: []` and
  `credit: { license: { kind: 'unknown' }, noAI: false, confidence: 'none', fieldSources: {} }`.
- **Search** also matches creator and license words ("cc by", "reference").

## 8. Errors and edge cases

| Case | Behavior |
|---|---|
| Malformed JSON-LD | Ignore that block, continue with others |
| Several `ImageObject`s | Use the one whose URL matches the kept image (ignoring query strings); otherwise none |
| `creator` as array / Person / Organization / string | Join names with ", "; take the first `url` |
| Huge or binary XMP | Scan only the first 256 KB of the file for the packet |
| "Keeping into" board was deleted | Treat as None; clear the setting |
| Free limit reached (once enforced) | "+ New board" shows the upgrade note; existing boards keep working |
| Duplicate keep into a board | The image is added to the current board ("Already kept, added to Ocean study") |
| Board name collision | Inline error "You already have a board with that name" |

## 9. Testing

- **Unit (Vitest):** `parseLicense`, badge mapping, JSON-LD matcher (graph, arrays, URL matching),
  XMP reader (fixtures with/without packets), meta inference, merge priority + user-edit protection,
  NoAI detection, artist-platform check, boards store (CRUD, multi-board membership, delete keeps images,
  migration v2→v3), `CREDITS.md` builder (known/unknown/edited).
- **Fixtures:** one saved HTML page per target site in `e2e/fixtures/`, plus a CC-licensed JPEG with XMP.
- **E2E (`npm run e2e`):** keep from a fixture page with JSON-LD → badge + creator shown; NoAI page → Keep all
  disabled and the worker refuses keep-many; keeping into a board from the popup; add/remove/delete board;
  board zip contains `CREDITS.md` with the right entries.

## 10. Privacy and store impact

- No new permissions and no new data leaving the device. The credit data is more "website content" that's
  already declared.
- Privacy policy: add "the creator name, license and copyright notice that the page or file states for the image".
  Regenerate `site/privacy.html`.
- Listing: lead with credits ("keeps the artist's name with every image") and the respect-artists promise.

## 11. Find similar: orbit overlay (new)

Instead of opening a Google Lens tab, **Find similar** opens an overlay on the current page (or in the gallery),
designed in the mockup canvas ("Find similar: orbit overlay"):

- Page dims; the chosen image sits in a large circle at the center.
- **Inner ring:** up to 6 look-alikes **from your saves**, each linked to the center by a thin line, slowly orbiting.
- **Outer ring:** up to 8 look-alikes **from around the web**, orbiting the other way, more slowly.
- Hover anywhere on the wheel pauses it; clicking an orb shows a card below: title, creator, reuse badge,
  and **Show in gallery** (your saves) or **Keep** / **Open ↗** (web results).
- Close with × or Esc. "Open in Google Lens ↗" stays as a link for anyone who wants Google's full results.
- Respects reduced-motion settings (no rotation; orbs sit still).

**Where results come from**

| Ring | Source | Cost | Privacy |
|---|---|---|---|
| Inner: your saves | On-device image embeddings (Transformers.js with a CLIP-style model) computed when an image is kept; nearest neighbours by cosine similarity | Free | Nothing leaves the device |
| Outer: the web | Needs a visual-search API (e.g. Google Cloud Vision web detection, ~$3.50 per 1,000 searches; SerpApi Google Lens, from $25 per 1,000). Google Lens itself has no public API, and scraping it would break Google's terms and the store's rules | Paid per search; the key must sit behind a small server we run | The image URL goes to our server and the API provider; needs a privacy-policy update and the CWS disclosure |

**Decision pending (yours):** whether the outer ring ships, and on which tier. Whatever we pick,
the inner ring ships in v1.2 and the overlay design doesn't change.

## 12. Answers to review questions (2026-10-07)

1. Free board limit: **3**, unlimited images per board (§3.2).
2. No-bulk-keep list: **ArtStation, Cara, DeviantArt, Behance, Dribbble** (§6).
3. Find similar stays available for NoAI images, now as the orbit overlay (§11).

## 13. Delivery order

1. Data model + migration + boards store (no UI)
2. Boards UI: sidebar, add/remove, board menu, popup "keeping into"
3. Credit extraction: license parser, JSON-LD, meta, rel-license, XMP, merge
4. Credit UI: tile line + badge, details panel with editing, `CREDITS.md`
5. Respect-artists rules (NoAI, platform list, worker guard)
6. Site fixtures + any proven-necessary adapters; e2e; privacy/listing updates
7. Find similar orbit overlay + on-device embeddings for the inner ring (outer ring per the §11 decision)
