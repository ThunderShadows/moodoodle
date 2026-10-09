<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import { openImageStore } from '@/lib/db';
  import { resolveKeepingInto } from '@/lib/settings';
  import { BADGE_LABEL, badgeFor, parseLicense } from '@/lib/license';
  import { NO_EDITS, clampEdits, cssFilter, cssTransform, isUnedited, rotateBy, type Edits } from '@/lib/edits';
  import { toastText } from '@/lib/toast';
  import type { Board, KeepResult, Message, PendingCrop } from '@/lib/types';

  const store = openImageStore();
  let pending = $state<PendingCrop | undefined>();
  let preview = $state<string | null>(null);
  let loadingPreview = $state(false);
  let edits = $state<Edits>({ ...NO_EDITS });
  let boards = $state<Board[]>([]);
  let boardId = $state('');
  let busy = $state(false);
  let status = $state('');

  const credit = $derived(pending?.pageCredit);
  const creator = $derived(credit?.jsonLd?.creator ?? credit?.metaAuthor);
  const badge = $derived(badgeFor(parseLicense(credit?.jsonLd?.license ?? credit?.relLicense)));
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  async function refreshPreview() {
    if (!pending?.crop) { preview = null; return; }
    loadingPreview = true;
    try {
      const msg: Message = { type: 'crop-preview' };
      preview = (await browser.runtime.sendMessage(msg)) as string | null;
    } catch {
      preview = null;
    } finally {
      loadingPreview = false;
    }
  }

  async function loadPending() {
    pending = (await browser.storage.session.get('pendingCrop')).pendingCrop as PendingCrop | undefined;
    await refreshPreview();
  }

  onMount(() => {
    (async () => {
      boards = await store.listBoards();
      boardId = (await resolveKeepingInto(store))?.id ?? '';
      await loadPending();
    })();
    const onChange = (changes: Record<string, unknown>, area: string) => {
      if (area === 'session' && 'pendingCrop' in changes) {
        status = pending && !changes.pendingCrop ? status : '';
        loadPending();
      }
    };
    browser.storage.onChanged.addListener(onChange as never);
    return () => browser.storage.onChanged.removeListener(onChange as never);
  });

  function set<K extends keyof Edits>(key: K, value: Edits[K]) {
    edits = clampEdits({ ...edits, [key]: value });
  }

  async function keep(whole = false) {
    busy = true;
    try {
      const msg: Message = { type: 'crop-keep', edits: $state.snapshot(edits), boardId: boardId || null, whole };
      const res = (await browser.runtime.sendMessage(msg)) as KeepResult;
      status = toastText(res);
      if (res.status !== 'error') edits = { ...NO_EDITS };
    } finally {
      busy = false;
    }
  }
</script>

<main class="panel">
  <header><span class="word">kudoodle</span><span class="sub">Crop &amp; keep</span></header>

  <section class="steps">
    <div class="step">
      <div class="title"><span class="num">1</span>Select part</div>
      {#if pending?.crop}
        <div class="card ok">
          <span class="tag">SELECTED</span>
          <span>{pct(pending.crop.w)} × {pct(pending.crop.h)} of the image</span>
          <span class="muted">drag again to reselect</span>
        </div>
      {:else if pending}
        <div class="card"><span>Drag over the part of the image you want.</span></div>
      {:else}
        <div class="card"><span>Hover any image on a page and press <strong>Crop</strong>.</span></div>
      {/if}
    </div>

    <div class="step">
      <div class="title"><span class="num">2</span>Edit</div>
      <div class="preview">
        {#if preview}
          <img src={preview} alt="Your crop" style="filter: {cssFilter(edits)}; transform: {cssTransform(edits)}" />
        {:else}
          <span class="muted">{loadingPreview ? 'Loading your crop…' : 'Your crop will show here'}</span>
        {/if}
      </div>
      <div class="tools" role="group" aria-label="Edit tools">
        <button type="button" class="tool" aria-label="Rotate left" onclick={() => (edits = rotateBy(edits, -90))} disabled={!preview}>↺</button>
        <button type="button" class="tool" aria-label="Rotate right" onclick={() => (edits = rotateBy(edits, 90))} disabled={!preview}>↻</button>
        <button type="button" class="tool" class:on={edits.flipH} aria-pressed={edits.flipH} onclick={() => set('flipH', !edits.flipH)} disabled={!preview}>⇋ Flip</button>
        <button type="button" class="tool" class:on={edits.grayscale} aria-pressed={edits.grayscale} onclick={() => set('grayscale', !edits.grayscale)} disabled={!preview}>◐ B&amp;W</button>
        <button type="button" class="reset" onclick={() => (edits = { ...NO_EDITS })} disabled={isUnedited(edits)}>Reset</button>
      </div>
      {#each [['brightness', 'Brightness'], ['contrast', 'Contrast'], ['saturation', 'Saturation']] as [key, label] (key)}
        <label class="slider" for="s-{key}">{label} <span class="muted">{edits[key as 'brightness']}%</span></label>
        <input id="s-{key}" type="range" min="0" max="200" value={edits[key as 'brightness']} disabled={!preview}
          oninput={(e) => set(key as 'brightness', Number((e.target as HTMLInputElement).value))} />
      {/each}
    </div>

    <div class="step">
      <div class="title"><span class="num">3</span>Save to</div>
      <label for="board" class="sr">Board</label>
      <select id="board" bind:value={boardId}>
        <option value="">No board</option>
        {#each boards as b (b.id)}<option value={b.id}>{b.name}</option>{/each}
      </select>
      {#if pending}
        <span class="muted small">Credit from the page is kept: {creator ? `by ${creator}` : 'creator unknown'} · {BADGE_LABEL[badge]}</span>
      {/if}
    </div>
  </section>

  <footer>
    {#if status}<p class="status" role="status">{status}</p>{/if}
    <button type="button" class="keep" onclick={() => keep(false)} disabled={busy || !pending?.crop}>{busy ? 'Keeping…' : '▶ Keep crop'}</button>
    <button type="button" class="whole" onclick={() => keep(true)} disabled={busy || !pending}>Keep the whole image instead</button>
  </footer>
</main>

<style>
  .panel { height: 100vh; display: flex; flex-direction: column; background: var(--ground); }
  header { display: flex; align-items: center; padding: 16px 18px; border-bottom: 1px solid var(--line); }
  .word { font-family: var(--display); font-weight: 800; font-size: 20px; letter-spacing: -0.02em; }
  .sub { margin-left: auto; font-size: 13px; color: var(--muted); }
  .steps { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 18px; }
  .step { display: flex; flex-direction: column; gap: 10px; }
  .title { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; }
  .num { width: 26px; height: 26px; border-radius: 50%; background: var(--ink); color: #FFFFFF; font-size: 13px; display: flex; align-items: center; justify-content: center; }
  .card { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 14px; background: var(--card); box-shadow: 0 0 0 1px var(--line); font-size: 13px; }
  .card.ok { box-shadow: 0 0 0 2px #A8E6C1; }
  .tag { font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: #CDEFD9; color: #1F5C3D; }
  .muted { color: var(--muted); font-size: 12px; }
  .small { font-size: 12px; }
  .preview { height: 190px; border-radius: 16px; background: var(--card); box-shadow: 0 0 0 1px var(--line); display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .preview img { max-width: 86%; max-height: 86%; border-radius: 8px; transition: transform .2s ease; }
  .tools { display: flex; gap: 6px; flex-wrap: wrap; }
  .tool { height: 40px; min-width: 44px; padding: 0 12px; border: 0; border-radius: 12px; background: var(--card); box-shadow: 0 0 0 1px var(--line); font-weight: 600; cursor: pointer; }
  .tool.on { background: var(--ink); color: #FFFFFF; }
  .tool:disabled, .reset:disabled { opacity: .45; cursor: default; }
  .reset { margin-left: auto; height: 40px; padding: 0 12px; border: 0; background: transparent; color: var(--focus); font-weight: 600; cursor: pointer; }
  .slider { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; }
  input[type='range'] { width: 100%; accent-color: var(--ink); }
  select { height: 44px; padding: 0 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--card); font-weight: 600; }
  footer { padding: 14px 18px 18px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px; }
  .status { margin: 0; font-size: 14px; }
  .keep { height: 52px; border: 0; border-radius: 16px; background: var(--ink); color: #FFFFFF; font-size: 16px; font-weight: 700; cursor: pointer; }
  .keep:disabled { opacity: .5; cursor: default; }
  .whole { height: 40px; border: 0; border-radius: 12px; background: transparent; font-weight: 600; color: #4A4256; cursor: pointer; }
  .whole:disabled { opacity: .5; }
</style>
