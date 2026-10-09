<script lang="ts">
  import { applyUserEdit, creditLine } from '@/lib/credit';
  import { BADGE_LABEL, badgeFor, licenseLabel } from '@/lib/license';
  import type { Credit, CreditSource, SavedImage } from '@/lib/types';

  interface Props {
    image: SavedImage;
    tags: string;
    onsavecredit: (credit: Credit) => Promise<void>;
    onsavetags: (tags: string) => Promise<void>;
    onclose: () => void;
  }
  let { image, tags, onsavecredit, onsavetags, onclose }: Props = $props();

  const SOURCE: Record<string, string> = {
    'json-ld': "from the page's image info",
    xmp: 'from the file',
    'rel-license': "from the page's license link",
    meta: 'guessed from the page author',
    user: 'you edited this',
  };
  const from = (s?: CreditSource) => (s ? SOURCE[s] ?? `from ${s}` : '');
  function licenseInput(c: Credit): string {
    const l = c.license;
    switch (l.kind) {
      case 'cc':
      case 'cc0':
      case 'public-domain':
        return l.url ?? licenseLabel(l);
      case 'all-rights-reserved':
        return l.notice ?? 'All rights reserved';
      default:
        return l.raw ?? '';
    }
  }

  let creator = $state('');
  let creatorUrl = $state('');
  let license = $state('');
  let notice = $state('');
  let tagDraft = $state('');
  let saved = $state(false);

  $effect(() => {
    creator = image.credit.creator ?? '';
    creatorUrl = image.credit.creatorUrl ?? '';
    license = licenseInput(image.credit);
    notice = image.credit.copyrightNotice ?? '';
    tagDraft = tags;
    saved = false;
  });

  const badge = $derived(badgeFor(image.credit.license));
  const line = $derived(creditLine(image.credit, image.pageTitle));

  async function save(e: SubmitEvent) {
    e.preventDefault();
    const c = image.credit;
    const patch: Parameters<typeof applyUserEdit>[1] = {};
    if (creator !== (c.creator ?? '')) patch.creator = creator;
    if (creatorUrl !== (c.creatorUrl ?? '')) patch.creatorUrl = creatorUrl;
    if (license !== licenseInput(c)) patch.license = license;
    if (notice !== (c.copyrightNotice ?? '')) patch.copyrightNotice = notice;
    if (Object.keys(patch).length) await onsavecredit(applyUserEdit(c, patch));
    if (tagDraft !== tags) await onsavetags(tagDraft);
    saved = true;
  }
</script>

<aside class="details" aria-label="Image details">
  <div class="top">
    <span class="title">{image.credit.title ?? image.pageTitle}</span>
    <button type="button" class="x" aria-label="Close details" onclick={onclose}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
    </button>
  </div>
  <div class="chips">
    <span class="badge {badge}">{BADGE_LABEL[badge]}</span>
    {#if image.credit.noAI}<span class="badge noai">No AI</span>{/if}
  </div>
  {#if line}<p class="line">{line}</p>{/if}

  <form onsubmit={save}>
    <label for="d-creator">Creator <span class="src">{from(image.credit.fieldSources.creator)}</span></label>
    <input id="d-creator" bind:value={creator} placeholder="unknown" />
    <label for="d-url">Creator link <span class="src">{from(image.credit.fieldSources.creatorUrl)}</span></label>
    <input id="d-url" bind:value={creatorUrl} placeholder="https://…" />
    <label for="d-license">License <span class="src">{from(image.credit.fieldSources.license)}</span></label>
    <input id="d-license" bind:value={license} placeholder="e.g. https://creativecommons.org/licenses/by/4.0/" />
    <label for="d-notice">Copyright notice <span class="src">{from(image.credit.fieldSources.copyrightNotice)}</span></label>
    <input id="d-notice" bind:value={notice} placeholder="© …" />
    <label for="d-tags">Tags</label>
    <input id="d-tags" bind:value={tagDraft} placeholder="cute, cat" />
    <div class="row">
      <a href={image.pageUrl} target="_blank" rel="noopener">Source page ↗</a>
      {#if image.credit.creatorUrl}<a href={image.credit.creatorUrl} target="_blank" rel="noopener">Creator ↗</a>{/if}
      <button type="submit" class="save">{saved ? 'Saved' : 'Save'}</button>
    </div>
  </form>
</aside>

<style>
  .details { position: fixed; right: 24px; top: 96px; z-index: 6; width: min(360px, calc(100vw - 32px)); max-height: calc(100vh - 230px); overflow: auto; padding: 18px; border-radius: 22px; background: var(--card); box-shadow: 0 0 0 1px var(--line), 0 18px 40px rgba(42,36,51,.18); display: flex; flex-direction: column; gap: 10px; }
  .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .title { font-weight: 700; font-size: 17px; }
  .x { flex-shrink: 0; width: 36px; height: 36px; border: 0; border-radius: 50%; background: var(--line); cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .line { margin: 0; font-size: 13px; color: var(--muted); }
  form { display: flex; flex-direction: column; gap: 6px; }
  label { font-size: 13px; font-weight: 600; margin-top: 4px; }
  .src { font-weight: 400; color: var(--muted); }
  input { height: 40px; padding: 0 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--ground); }
  .row { display: flex; align-items: center; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
  .row a { font-size: 14px; font-weight: 600; color: #C2571C; }
  .save { margin-left: auto; height: 40px; padding: 0 18px; border: 0; border-radius: 999px; background: var(--ink); color: #FFFFFF; font-weight: 600; cursor: pointer; }
</style>
