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
  const label = (f: string) => f.charAt(0).toUpperCase() + f.slice(1);

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
      const url = thumbs[id];
      if (url) { URL.revokeObjectURL(url); delete thumbs[id]; }
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
              {#each img.palette as hex (hex)}<span style="background:{hex}"></span>{/each}
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
