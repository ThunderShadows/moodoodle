# Chrome Web Store listing

**Name:** moodoodle
**Summary (≤132 chars):** Keep the drawings and designs you love from any site, find more like them, and take them anywhere.
**Category:** Productivity → Tools
**Single purpose:** Save images you like from web pages into a private, searchable collection on your computer.

**Description**

> moodoodle is a cozy home for the doodles, drawings and designs you find while browsing.
>
> • Hover any image and press **Keep**, or right-click → **Keep image**
> • Every keep remembers where it came from, plus its color palette
> • Search your collection by site, tag or color
> • **Find similar** shows look-alikes from your own saves in a little orbit, matched on your device
> • Every keep records the artist and license where the page says, and exports include a CREDITS.md
> • Make boards for your projects and choose the board new keeps go into
> • Pick a few and download them as a .zip, with credits for each
>
> Everything stays in your browser. No account, no servers, no tracking.
> Saved images are for your personal reference. Check the original creator's terms before reusing them.

**Permission justifications**
- `<all_urls>` host access: to show the Keep button on images on any site you visit, and to download the image you choose to keep. Nothing from a page is stored until you press Keep.
- `contextMenus`: adds "Keep image" and "Find similar" to the right-click menu on images.
- `unlimitedStorage`: your collection is stored locally and can grow past the default quota.
- `storage`: remembers small settings on your device, such as which board new keeps go into.
- `offscreen`: runs the bundled on-device image model for Find similar in a hidden extension page (it can't run in the background service worker). Nothing is sent anywhere.

**Content security policy:** `'wasm-unsafe-eval'` is needed only to run the bundled WebAssembly image model. No remote code is loaded; the model and runtime ship in the package (~50 MB).

**Privacy practices tab (Developer Dashboard)**
- Data handled (declare even though it never leaves the device):
  - **Website content**: the images you choose to keep.
  - **Web browsing activity**: the address and title of the page each kept image came from.
- Certify: not sold to third parties; not used or transferred for purposes unrelated to the single purpose;
  not used to determine creditworthiness or for lending.
- Third-party transfer: only when the user clicks **Open in Google Lens**, which opens Google Lens with that image's address. Find similar itself runs on the device.
- Privacy policy URL: `https://thundershadows.github.io/moodoodle/privacy.html` (GitHub Pages, from `site/`; regenerate with `python3 scripts/build-privacy-page.py` after editing `docs/privacy.md`).

**Wording rules:** never "scrape", "download any image" or "grab everything". No Google or Canva logos.

**Screenshots (1280×800):** `store-assets/` (gallery, hover button on a page, popup, export, find similar).
