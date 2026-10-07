# moodoodle: novelty, policy, privacy and copyright review

**Date:** 2026-10-07 · **Scope:** v1 as shipped (commit `0a879e5`) · **Status:** findings accepted, fixes in progress

## 1. Novelty: low as v1 stands

| Competitor | What it does | Overlap with moodoodle v1 |
|---|---|---|
| [Moodsnap](https://martinkleinheinz.de/en/moodsnap/) | Hover button to save, boards, color extraction ("color DNA"), ZIP + PDF export, 100% local, no account, free | Nearly identical. It has no search, tags, find-similar or credits. Stores image URLs only, not copies. |
| InspoAI, Pinly, Milanote clipper | Save images to moodboards or canvases | Same save flow; their focus is boards and canvases |
| mymind | AI-organized inspiration, stored in the cloud | Does smart organizing, but cloud-based |
| Imageye | Bulk image downloader | Overlaps with "Keep all on this page" |

Only moodoodle v1 has: color-family filter, search with tags, Find similar through Lens, `sources.txt` in the zip.
That's not enough to make people pay when a free equivalent exists.

## 2. Differentiation (agreed direction)

1. **Save with credit (lead feature; no competitor found doing it).** When an image is kept, also record
   its creator, credit text, copyright notice and license from:
   - [Google image license metadata](https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata)
     on the page (schema.org ImageObject `creator`, `creditText`, `copyrightNotice`, `license`, `acquireLicensePage`)
   - IPTC/XMP metadata embedded in the image file (Creator, Copyright Notice, Web Statement of Rights)
   - Creative Commons `rel="license"` links

   Show a badge per tile: **"Free to reuse (CC BY)"** or **"Reference only, all rights reserved"**.
   The zip gets a `CREDITS.md` in the Creative Commons
   [recommended format](https://wiki.creativecommons.org/wiki/Recommended_practices_for_attribution)
   (title, author, source, license). Pitch: *the inspiration saver that respects artists.*
2. **Find the original artist:** a Lens exact-match step to trace reposted art back to its creator.
3. **Tools for people who draw:** palette export as Procreate/Canva/Figma swatches; turn an image into a
   line-art or coloring page, processed on the device.
4. **Private AI:** "more like this from my collection" and auto-tags, run on the device (Transformers.js/CLIP).

**Target audience:** hobby illustrators and art students who collect reference images.
**Paid features:** ideas 1 and 3.

## 3. Chrome Web Store policy check

Sources: [Program policies](https://developer.chrome.com/docs/webstore/program-policies/policies),
[2026 policy update](https://developer.chrome.com/blog/cws-policy-updates-2026) (effective 2026-08-01),
[User data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
[IP policy](https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property).

| Policy | Status | Action |
|---|---|---|
| Single purpose | OK | "Save images you like into a private collection" |
| Least privilege (`<all_urls>`) | Risk | Justify it in the listing. Option: make the hover button opt-in, default to right-click + `activeTab` |
| Limited use (stricter from 2026-08-01) | OK | Collect only what saving needs; send nothing |
| Data disclosure | **Was wrong** | Local-only data must still be declared. Declare **Website content** (saved images) and **Web browsing activity** (page URLs/titles of saved images): stored locally only, never sold or transferred |
| Privacy policy | **Missing** | Required even for local-only extensions. Must be at a public URL (moodoodle.in/privacy or GitHub Pages) with a contact email |
| Remote code / obfuscation | OK | Everything is bundled |
| IP / unauthorized access | OK, with one change | Hotlink-blocked images are refused (good). **Removed** the planned v2 "read pixels from the page" fallback, because it gets around site restrictions |
| Trademarks | OK | "Find similar (Google Lens)" is descriptive. No Google/Canva logos, no implied endorsement |
| Listing wording | Rule | Never "scrape" or "download any image"; present it as saving inspiration with credits |

## 4. Privacy

- No server, so we receive no personal data. The CWS disclosure and privacy policy cover the store side.
- India DPDP Act 2023 (rules notified Nov 2025, phased in over 18 months): becomes relevant once
  **payments** collect buyer emails. Update the privacy policy then, and tell existing users when data handling changes (CWS 2026 rule).
- Find similar sends the image URL to Google Lens. This is disclosed in the privacy policy.

## 5. Copyright

- The user is responsible for how they use saved images. Our CWS risk is being seen as *facilitating* infringement,
  which in practice targets things like YouTube downloaders. Image savers (Imageye, Moodsnap) are listed without trouble.
- India Copyright Act s.52(1)(a): fair dealing for "private use, including research", but it's read narrowly,
  so full copies aren't automatically covered. Personal reference is low risk; reuse after a zip export is where infringement could happen.
- We store full copies (Moodsnap stores URLs only). That's more useful but slightly more exposure. Protect with credits
  and license badges, plus a "Reference only unless the license allows reuse" notice.

## 6. Name

No existing product called "moodoodle" found (searches only returned Moodle, the education software, a different
kind of product). **Not a trademark clearance.** Search the IP India registry (and USPTO if selling in the US) before spending on branding.

## 7. Launch order

1. Compliance fixes: data disclosure, public privacy policy, spec cleanup ← in progress
2. Save with credit (license badges + `CREDITS.md`)
3. Palette export + line-art tool as paid features, then payments
