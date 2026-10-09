<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { openImageStore } from '@/lib/db';
  import { filterImages } from '@/lib/search';
  import { buildZip, slugify } from '@/lib/zip';
  import { createUrlCache } from '@/lib/urlcache';
  import { BoardNameInvalid, ENFORCE_BOARD_LIMIT, FREE_BOARD_LIMIT, boardCounts, boardQuota, nextBoardColor } from '@/lib/boards';
  import { getKeepingInto, setKeepingInto } from '@/lib/settings';
  import { COLOR_FAMILIES, type Board, type BoardColor, type ColorFamily, type Credit, type SavedImage } from '@/lib/types';
  import Sidebar from './Sidebar.svelte';
  import AddToBoard from './AddToBoard.svelte';
  import Details from './Details.svelte';
  import { browser } from 'wxt/browser';
  import { openOrbit } from '@/lib/orbit';
  import { toOrbitData, type SimilarResult } from '@/lib/findsimilar';
  import { BADGE_LABEL, badgeFor } from '@/lib/license';

  const store = openImageStore();
  const thumbCache = createUrlCache((id) => store.getThumb(id));
  let images = $state<SavedImage[]>([]);
  let boards = $state<Board[]>([]);
  const thumbs = $state<Record<string, string>>({});
  let query = $state(new URLSearchParams(location.search).get('q') ?? '');
  let family = $state<ColorFamily | 'all'>('all');
  let activeBoard = $state<string>('all');
  const selected = new SvelteSet<string>();
  let includeSources = $state(true);
  let busy = $state(false);

  const visible = $derived(filterImages(images, { query, family, board: activeBoard }));
  const only = $derived(selected.size === 1 ? images.find((i) => selected.has(i.id)) : undefined);
  const counts = $derived(boardCounts(images));
  const quota = $derived(boardQuota(boards.length, { enforce: ENFORCE_BOARD_LIMIT, plus: false }));
  const activeBoardObj = $derived(boards.find((b) => b.id === activeBoard));
  const chips: (ColorFamily | 'all')[] = ['all', ...COLOR_FAMILIES];
  const label = (f: string) => f.charAt(0).toUpperCase() + f.slice(1);

  async function loadBoards() {
    boards = await store.listBoards();
    if (activeBoard !== 'all' && activeBoard !== 'unsorted' && !boards.some((b) => b.id === activeBoard)) activeBoard = 'all';
  }

  async function load() {
    await loadBoards();
    images = await store.list();
    for (const img of images) {
      if (thumbs[img.id]) continue;
      const url = await thumbCache.get(img.id);
      if (url) thumbs[img.id] = url;
    }
  }

  onMount(() => {
    const focus = new URLSearchParams(location.search).get('focus');
    load().then(() => { if (focus && images.some((i) => i.id === focus)) focusImage(focus); });
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });


  function toggle(id: string) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
  }

  function selectBoard(key: string) {
    activeBoard = key;
    selected.clear();
  }

  async function saveTags(text: string) {
    if (!only) return;
    await store.setTags(only.id, text.split(','));
    await load();
  }

  async function saveCredit(credit: Credit) {
    if (!only) return;
    // Credits built from reactive state are Svelte proxies; IndexedDB can only store plain objects.
    await store.setCredit(only.id, $state.snapshot(credit));
    await load();
  }

  function errorText(e: unknown): string {
    return e instanceof BoardNameInvalid ? e.message : 'Something went wrong. Try again?';
  }

  async function createBoard(name: string): Promise<Board | string> {
    if (quota.atLimit) return `You've used your ${FREE_BOARD_LIMIT} free boards`;
    try {
      const board = await store.createBoard(name, nextBoardColor(boards));
      await loadBoards();
      return board;
    } catch (e) {
      return errorText(e);
    }
  }

  async function createFromSidebar(name: string): Promise<string | undefined> {
    const r = await createBoard(name);
    return typeof r === 'string' ? r : undefined;
  }

  async function createAndAdd(name: string): Promise<string | undefined> {
    const r = await createBoard(name);
    if (typeof r === 'string') return r;
    await addSelectedTo(r.id);
    return undefined;
  }

  async function renameBoard(id: string, name: string): Promise<string | undefined> {
    try {
      await store.updateBoard(id, { name });
      await loadBoards();
      return undefined;
    } catch (e) {
      return errorText(e);
    }
  }

  async function colorBoard(id: string, color: BoardColor) {
    await store.updateBoard(id, { color });
    await loadBoards();
  }

  async function deleteBoard(id: string) {
    const b = boards.find((x) => x.id === id);
    if (!b || !confirm(`Delete the board "${b.name}"? Its images stay in your collection.`)) return;
    await store.deleteBoard(id);
    if ((await getKeepingInto()) === id) await setKeepingInto(undefined);
    await load();
  }

  async function addSelectedTo(boardId: string) {
    await store.addToBoard([...selected], boardId);
    await load();
  }

  async function removeSelectedFromBoard() {
    if (!activeBoardObj) return;
    await store.removeFromBoard([...selected], activeBoardObj.id);
    selected.clear();
    await load();
  }

  async function exportZip(list: SavedImage[], fileName: string) {
    busy = true;
    try {
      const items: { image: SavedImage; blob: Blob }[] = [];
      for (const image of list) {
        const blob = await store.getBlob(image.id);
        if (blob) items.push({ image, blob });
      }
      const zip = await buildZip(items, includeSources);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zip);
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } finally {
      busy = false;
    }
  }

  function download() {
    return exportZip(images.filter((i) => selected.has(i.id)), `kudoodle-${new Date().toISOString().slice(0, 10)}.zip`);
  }

  function downloadBoard(id: string) {
    const b = boards.find((x) => x.id === id);
    if (!b) return;
    return exportZip(images.filter((i) => i.boardIds.includes(id)), `kudoodle-${slugify(b.name) || 'board'}.zip`);
  }

  async function remove() {
    if (!confirm(`Delete ${selected.size} from your collection?`)) return;
    for (const id of [...selected]) {
      await store.remove(id);
      thumbCache.drop(id);
      delete thumbs[id];
    }
    selected.clear();
    await load();
  }

  let orbitHost: HTMLDivElement | undefined;
  async function similar() {
    const image = only;
    if (!image || !orbitHost) return;
    const title = image.credit.title ?? image.pageTitle;
    const centerSrc = thumbs[image.id] ?? image.imageUrl;
    const orbit = openOrbit(orbitHost, { title, centerSrc, results: [], learning: false, loading: true, lensUrl: null }, {
      onClose: () => {},
      onShowInGallery: (id) => { orbit.close(); focusImage(id); },
    });
    const res = (await browser.runtime.sendMessage({ type: 'similar', imageUrl: image.imageUrl })) as SimilarResult;
    orbit.update(toOrbitData(res, { title, centerSrc }));
  }

  /** Selects one image and scrolls it into view (used by "Show in gallery"). */
  function focusImage(id: string) {
    activeBoard = 'all';
    query = '';
    family = 'all';
    selected.clear();
    selected.add(id);
    requestAnimationFrame(() => document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center' }));
  }
</script>

<main>
  <header>
    <div class="brand">
      <span class="word">kudoodle</span>
      <span class="hand">{images.length} little treasures</span>
    </div>
    <div class="search">
      <label for="q" class="sr">Search your saves</label>
      <input id="q" type="search" placeholder="Search tags, sites, colors…" bind:value={query} />
    </div>
  </header>

  <div class="layout">
    <aside class="sidecol">
      <Sidebar {boards} {counts} active={activeBoard} {quota}
        onselect={selectBoard} oncreate={createFromSidebar} onrename={renameBoard}
        oncolor={colorBoard} ondownload={downloadBoard} ondelete={deleteBoard} />
    </aside>

    <section class="content">
      {#if activeBoardObj}
        <h2 class="boardtitle"><span class="swatch {activeBoardObj.color}"></span>{activeBoardObj.name}</h2>
      {/if}

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
        <section class="empty">
          <p>{activeBoardObj && counts.byBoard[activeBoardObj.id] === undefined ? 'This board is empty. Pick some images and choose Add to board.' : 'No saves match that. Try another word or color.'}</p>
        </section>
      {:else}
        <div class="grid">
          {#each visible as img (img.id)}
            <button type="button" class="tile" data-id={img.id} class:on={selected.has(img.id)} aria-pressed={selected.has(img.id)} onclick={() => toggle(img.id)}>
              {#if thumbs[img.id]}
                <img src={thumbs[img.id]} alt={img.pageTitle} width={img.width} height={img.height} loading="lazy" />
              {/if}
              <span class="meta">
                <span class="title">{img.pageTitle}</span>
                <span class="sub">{img.site}{img.tags.length ? ` · ${img.tags.join(', ')}` : ''}</span>
                {#if img.credit.creator}
                  <span class="by">{img.credit.fieldSources.creator === 'meta' ? 'probably by' : 'by'} {img.credit.creator}</span>
                {/if}
                <span class="chipsrow">
                  <span class="badge {badgeFor(img.credit.license)}">{BADGE_LABEL[badgeFor(img.credit.license)]}</span>
                  {#if img.credit.noAI}<span class="badge noai">No AI</span>{/if}
                </span>
                <span class="palette" aria-hidden="true">
                  {#each img.palette as hex (hex)}<span style="background:{hex}"></span>{/each}
                </span>
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </section>
  </div>

  {#if only}
    <Details image={only} tags={only.tags.join(', ')} onsavecredit={saveCredit} onsavetags={saveTags} onclose={() => selected.clear()} />
  {/if}

  {#if selected.size > 0}
    <div class="selbar">
      <span class="hand">{selected.size} picked</span>
      {#if only}
        <button type="button" class="light" onclick={similar}>Find similar</button>
      {/if}
      <AddToBoard {boards} onadd={addSelectedTo} oncreate={createAndAdd} />
      {#if activeBoardObj}<button type="button" class="ghost" onclick={removeSelectedFromBoard}>Remove from board</button>{/if}
      <button type="button" class="accent" onclick={download} disabled={busy}>{busy ? 'Packing…' : 'Download .zip'}</button>
      <label class="check"><input type="checkbox" bind:checked={includeSources} /> with credits</label>
      <button type="button" class="ghost" onclick={remove}>Delete</button>
    </div>
  {/if}
  <div bind:this={orbitHost}></div>
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
  .layout { display: flex; flex-wrap: wrap; gap: 28px; align-items: flex-start; }
  .sidecol { flex: 1 1 220px; max-width: 260px; }
  .content { flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 24px; }
  .boardtitle { display: flex; align-items: center; gap: 10px; margin: 0; font-family: var(--display); font-weight: 800; font-size: 26px; letter-spacing: -0.02em; }
  @media (max-width: 640px) { .sidecol { max-width: none; flex-basis: 100%; } }
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
  .by { font-size: 13px; font-weight: 600; }
  .chipsrow { display: flex; gap: 6px; flex-wrap: wrap; }
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
