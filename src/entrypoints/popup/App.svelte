<script lang="ts">
  import { onMount } from 'svelte';
  import { browser, type Browser } from 'wxt/browser';
  import { openImageStore } from '@/lib/db';
  import { isSameLocalDay } from '@/lib/dates';
  import { resolveKeepingInto, setKeepingInto } from '@/lib/settings';
  import { BULK_BLOCKED_MESSAGE, bulkKeepBlocked } from '@/lib/respect';
  import type { Board, CollectResult, KeepManyResult, Message, PageCredit, PendingCrop, SavedImage } from '@/lib/types';

  type Tab = Browser.tabs.Tab;
  const store = openImageStore();
  let recent = $state<{ img: SavedImage; url: string }[]>([]);
  let found = $state<string[] | null>(null);
  let pageCredits: Record<string, PageCredit> = {};
  let pageNoAI = $state(false);
  let bulkBlocked = $state(false);
  let cropping = $state(false);

  /** A click in the popup always counts as the user's, so Chrome lets us open the side panel here. */
  async function openCropPanel() {
    if (tab?.id === undefined) return;
    await browser.sidePanel.open({ tabId: tab.id });
    window.close();
  }
  let status = $state('');
  let query = $state('');
  let busy = $state(false);
  let todayCount = $state(0);
  let tab: Tab | undefined;
  let boards = $state<Board[]>([]);
  let keepingInto = $state('');

  async function loadBoards() {
    boards = await store.listBoards();
    keepingInto = (await resolveKeepingInto(store))?.id ?? '';
  }

  async function loadRecent() {
    const all = await store.list();
    todayCount = all.filter((i) => isSameLocalDay(i.savedAt)).length;
    const next: { img: SavedImage; url: string }[] = [];
    for (const img of all.slice(0, 6)) {
      const blob = await store.getThumb(img.id);
      if (blob) next.push({ img, url: URL.createObjectURL(blob) });
    }
    recent.forEach((r) => URL.revokeObjectURL(r.url));
    recent = next;
  }

  onMount(async () => {
    loadBoards();
    loadRecent();
    [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const pendingCrop = (await browser.storage.session.get('pendingCrop')).pendingCrop as PendingCrop | undefined;
    cropping = !!tab && pendingCrop?.tabId === tab.id;
    if (tab?.id === undefined) return;
    try {
      const msg: Message = { type: 'collect-images' };
      const res = (await browser.tabs.sendMessage(tab.id, msg)) as CollectResult;
      found = res.urls;
      pageCredits = res.credits;
      pageNoAI = res.noAI;
      bulkBlocked = bulkKeepBlocked(tab.url ?? '', pageNoAI);
    } catch {
      found = null;
      status = "Can't read this page. Try reloading it.";
    }
  });

  async function keepAll() {
    if (!found?.length || !tab) return;
    busy = true;
    const msg: Message = { type: 'keep-many', imageUrls: found, pageUrl: tab.url ?? '', pageTitle: tab.title ?? '', pageCredits, pageNoAI };
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
  {#if boards.length}
    <label class="keepinto">
      <span>Keeping into</span>
      <select bind:value={keepingInto} onchange={() => setKeepingInto(keepingInto || undefined)}>
        <option value="">No board</option>
        {#each boards as b (b.id)}<option value={b.id}>{b.name}</option>{/each}
      </select>
    </label>
  {/if}
  {#if cropping}
    <div class="card cropcard">
      <div class="col">
        <span class="strong">You're cropping an image</span>
        <span class="muted">Edit and keep it in the side panel</span>
      </div>
      <button type="button" class="dark" onclick={openCropPanel}>Open crop panel</button>
    </div>
  {/if}
  {#if recent.length}
    <span class="label">Recently kept</span>
    <div class="recent">
      {#each recent as r (r.img.id)}<img src={r.url} alt={r.img.pageTitle} />{/each}
    </div>
  {/if}
  {#if found && bulkBlocked}
    <div class="card blocked">
      <span class="muted">{BULK_BLOCKED_MESSAGE}</span>
    </div>
  {:else if found}
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
  .keepinto { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-weight: 600; font-size: 14px; }
  .keepinto select { flex: 1; max-width: 200px; height: 40px; padding: 0 10px; border: 2px solid var(--line); border-radius: 12px; background: var(--card); font: inherit; }
  .recent { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .recent img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 14px; background: var(--line); }
  .card { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; border-radius: 16px; background: var(--card); }
  .col { display: flex; flex-direction: column; gap: 2px; }
  .strong { font-weight: 600; font-size: 15px; }
  .muted { font-size: 13px; color: var(--muted); }
  .dark { height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--ink); color: #FFFFFF; font-weight: 600; cursor: pointer; }
  .dark:disabled { opacity: .6; }
  .status { margin: 0; font-size: 14px; color: var(--ink); }
  .card.blocked { display: block; line-height: 1.45; }
  .open { height: 48px; border: 0; border-radius: 999px; background: var(--accent); color: var(--ink); font-weight: 600; cursor: pointer; }
</style>
