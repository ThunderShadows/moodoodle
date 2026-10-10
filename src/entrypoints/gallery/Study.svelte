<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { extractPalette } from '@/lib/color';
  import { autoThresholds, byValue, gridLines, notan, posterize, toGpl, toValues, type GridKind } from '@/lib/study';
  import { slugify } from '@/lib/zip';
  import { ms } from '@/lib/motion';
  import type { SavedImage } from '@/lib/types';

  interface Props {
    image: SavedImage;
    getBlob: () => Promise<Blob | undefined>;
    onclose: () => void;
  }
  let { image, getBlob, onclose }: Props = $props();

  type Mode = 'original' | 'values' | 'notan' | 'posterize';
  const MODES: { key: Mode; label: string; tip: string }[] = [
    { key: 'original', label: 'Original', tip: 'The picture as kept' },
    { key: 'values', label: 'Values', tip: 'Only light and dark, no colour' },
    { key: 'notan', label: 'Notan', tip: 'Big shapes in 2 or 3 flat values' },
    { key: 'posterize', label: 'Posterize', tip: 'A few flat steps, like a small paint set' },
  ];
  const GRIDS: { key: GridKind; label: string }[] = [
    { key: 'off', label: 'Off' }, { key: 'thirds', label: 'Thirds' }, { key: '4', label: '4×4' },
    { key: '6', label: '6×6' }, { key: 'diagonal', label: 'Diagonal' },
  ];

  const title = $derived(image.credit.title ?? image.pageTitle);
  let canvas = $state<HTMLCanvasElement>();
  let source: ImageData | undefined;
  let failed = $state(false);
  let ready = $state(false);
  let mode = $state<Mode>('original');
  let bands = $state<2 | 3>(2);
  let thresholds = $state<number[]>([128]);
  let levels = $state(4);
  let valuesOnly = $state(false);
  let grid = $state<GridKind>('off');
  let mirror = $state(false);
  let peeking = $state(false);
  let palette = $state<string[]>([]);
  let ratio = $state(1);
  let copied = $state('');
  const lines = $derived(gridLines(grid));

  onMount(() => {
    (async () => {
      try {
        const blob = await getBlob();
        if (!blob) throw new Error('missing');
        const bmp = await createImageBitmap(blob);
        // Big enough to study, small enough that every slider move feels instant.
        const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
        const work = new OffscreenCanvas(w, h);
        const ctx = work.getContext('2d');
        if (!ctx) throw new Error('no 2d');
        ctx.drawImage(bmp, 0, 0, w, h);
        bmp.close();
        source = ctx.getImageData(0, 0, w, h);
        ratio = w / h;
        palette = byValue(extractPalette(source.data, 8));
        thresholds = autoThresholds(source.data, 2);
        ready = true;
      } catch {
        failed = true;
      }
    })();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onclose(); }
      if (e.key === ' ' && !(e.target as Element).closest('input, button')) { e.preventDefault(); peeking = true; }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') peeking = false; };
    addEventListener('keydown', onKey);
    addEventListener('keyup', onKeyUp);
    return () => { removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); };
  });

  function setBands(n: 2 | 3) {
    bands = n;
    if (source) thresholds = autoThresholds(source.data, n);
  }

  $effect(() => {
    const view = peeking ? 'original' : mode;
    const t = [...thresholds], lv = levels, vo = valuesOnly;
    if (!ready || !canvas || !source) return;
    canvas.width = source.width;
    canvas.height = source.height;
    const out = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
    if (view === 'values') toValues(out.data);
    else if (view === 'notan') notan(out.data, t);
    else if (view === 'posterize') posterize(out.data, lv, vo);
    canvas.getContext('2d')?.putImageData(out, 0, 0);
  });

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = label;
      setTimeout(() => { if (copied === label) copied = ''; }, 1400);
    } catch {
      copied = '';
    }
  }

  function savePalette() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toGpl(palette, title)], { type: 'text/plain' }));
    a.download = `${slugify(title) || 'kudoodle'}-palette.gpl`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
</script>

<div class="study" role="dialog" aria-modal="true" aria-label="Study {title}" transition:fly={{ y: 24, duration: ms(260) }}>
  <header>
    <span class="name">Study <span class="muted">· {title}</span></span>
    <span class="hint muted">Hold <kbd>Space</kbd> to peek at the original</span>
    <button type="button" class="x" aria-label="Close study" onclick={onclose}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
    </button>
  </header>

  <div class="stage">
    {#if failed}
      <p class="muted">This picture couldn't be opened for study.</p>
    {:else}
      <div class="frame" class:mirror class:hidden={!ready} style="--ratio:{ratio}">
        <canvas bind:this={canvas} aria-label="{MODES.find((m) => m.key === mode)?.label} view of {title}"></canvas>
        {#if grid !== 'off'}
          <svg class="grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" in:scale={{ start: 0.96, duration: ms(200) }}>
            {#each lines.lines as f (f)}
              <line x1={f * 100} y1="0" x2={f * 100} y2="100" /><line x1="0" y1={f * 100} x2="100" y2={f * 100} />
            {/each}
            {#if lines.diagonals}<line x1="0" y1="0" x2="100" y2="100" /><line x1="100" y1="0" x2="0" y2="100" />{/if}
          </svg>
        {/if}
      </div>
      {#if !ready}<p class="muted loading">Getting your picture ready…</p>{/if}
    {/if}
  </div>

  <aside class="tools" aria-label="Study tools">
    <div class="group">
      <span class="label">View</span>
      <div class="seg" role="radiogroup" aria-label="View">
        {#each MODES as m (m.key)}
          <button type="button" role="radio" aria-checked={mode === m.key} class:on={mode === m.key} title={m.tip} onclick={() => (mode = m.key)} disabled={!ready}>{m.label}</button>
        {/each}
      </div>
      <span class="tip muted">{MODES.find((m) => m.key === mode)?.tip}</span>
    </div>

    {#if mode === 'notan'}
      <div class="group" in:fly={{ y: 8, duration: ms(200), easing: backOut }}>
        <div class="seg small" role="radiogroup" aria-label="Number of values">
          <button type="button" role="radio" aria-checked={bands === 2} class:on={bands === 2} onclick={() => setBands(2)}>2 values</button>
          <button type="button" role="radio" aria-checked={bands === 3} class:on={bands === 3} onclick={() => setBands(3)}>3 values</button>
        </div>
        {#each thresholds as t, i (i)}
          <label for="t-{i}">{bands === 2 ? 'Split' : i === 0 ? 'Dark split' : 'Light split'} <span class="muted">{Math.round((t / 255) * 100)}%</span></label>
          <input id="t-{i}" type="range" min="1" max="254" value={t} oninput={(e) => { const next = [...thresholds]; next[i] = +e.currentTarget.value; thresholds = next; }} />
        {/each}
      </div>
    {:else if mode === 'posterize'}
      <div class="group" in:fly={{ y: 8, duration: ms(200), easing: backOut }}>
        <label for="levels">Steps <span class="muted">{levels}</span></label>
        <input id="levels" type="range" min="2" max="8" bind:value={levels} />
        <label class="check"><input type="checkbox" bind:checked={valuesOnly} /> Greys only</label>
      </div>
    {/if}

    <div class="group">
      <span class="label">Grid</span>
      <div class="seg small" role="radiogroup" aria-label="Grid">
        {#each GRIDS as g (g.key)}
          <button type="button" role="radio" aria-checked={grid === g.key} class:on={grid === g.key} onclick={() => (grid = g.key)}>{g.label}</button>
        {/each}
      </div>
      <button type="button" class="pill" class:on={mirror} aria-pressed={mirror} onclick={() => (mirror = !mirror)}>⇋ Mirror</button>
    </div>

    {#if palette.length}
      <div class="group">
        <span class="label">Palette <span class="muted">dark to light</span></span>
        <div class="swatches">
          {#each palette as hex, i (hex)}
            <button type="button" class="sw" style="background:{hex}; --i:{i}" title="Copy {hex}" aria-label="Copy {hex}" onclick={() => copy(hex, hex)}>
              {#if copied === hex}<span class="ok" in:scale={{ duration: ms(200), easing: backOut }}>✓</span>{/if}
            </button>
          {/each}
        </div>
        <div class="row">
          <button type="button" class="pill" onclick={() => copy(palette.join(' '), 'all')}>{copied === 'all' ? 'Copied ✓' : 'Copy colours'}</button>
          <button type="button" class="pill" onclick={savePalette} title="For Krita, GIMP and Inkscape">Save .gpl</button>
        </div>
      </div>
    {/if}
  </aside>
</div>

<style>
  .study { position: fixed; inset: 0; z-index: 30; display: grid; grid-template-columns: minmax(0, 1fr) 300px; grid-template-rows: auto minmax(0, 1fr); background: #2B201A; color: #FFF6EA; }
  header { grid-column: 1 / -1; display: flex; align-items: center; gap: 16px; padding: 14px 20px; border-bottom: 1px solid rgba(255,246,234,.12); }
  .name { font-family: var(--display); font-weight: 700; font-size: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .muted { color: rgba(255,246,234,.62); font-weight: 400; }
  .hint { margin-left: auto; font-size: 13px; white-space: nowrap; }
  kbd { padding: 1px 6px; border-radius: 6px; background: rgba(255,246,234,.14); font: 600 12px var(--body); }
  .x { flex-shrink: 0; width: 38px; height: 38px; border: 0; border-radius: 50%; background: rgba(255,246,234,.14); color: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .stage { position: relative; min-height: 0; container-type: size; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .frame { position: relative; display: flex; max-width: 100%; max-height: 100%; transition: transform .35s cubic-bezier(.34,1.56,.64,1); }
  .frame.mirror { transform: scaleX(-1); }
  .frame.hidden { visibility: hidden; position: absolute; }
  canvas { display: block; width: min(100cqw - 48px, (100cqh - 48px) * var(--ratio, 1)); height: auto; aspect-ratio: var(--ratio, 1); border-radius: 10px; box-shadow: 0 20px 50px rgba(0,0,0,.45); }
  /* Difference blending inverts whatever is underneath, so the lines show on light and dark pictures alike. */
  .grid { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; mix-blend-mode: difference; }
  .grid line { stroke: #FFFFFF; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .loading { position: absolute; }
  .tools { min-height: 0; overflow: auto; padding: 18px; display: flex; flex-direction: column; gap: 18px; background: rgba(255,246,234,.05); border-left: 1px solid rgba(255,246,234,.12); }
  .group { display: flex; flex-direction: column; gap: 8px; }
  .label { font-weight: 700; font-size: 14px; }
  .tip { font-size: 13px; }
  .seg { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; border-radius: 14px; background: rgba(255,246,234,.08); }
  .seg button { flex: 1 1 auto; height: 34px; padding: 0 10px; border: 0; border-radius: 10px; background: transparent; color: inherit; font-weight: 600; font-size: 13px; cursor: pointer; transition: background .2s, color .2s, transform .2s; }
  .seg button:hover:not(:disabled) { background: rgba(255,246,234,.1); }
  .seg button.on, .seg button.on:hover { background: var(--accent); color: #2B201A; transform: scale(1.03); }
  .seg button:disabled { opacity: .5; cursor: default; }
  .seg.small button { height: 30px; font-size: 12px; }
  label { font-size: 13px; font-weight: 600; display: flex; justify-content: space-between; }
  label.check { justify-content: flex-start; gap: 8px; align-items: center; font-weight: 500; }
  input[type=range] { width: 100%; accent-color: var(--accent); }
  .pill { align-self: flex-start; height: 34px; padding: 0 14px; border: 0; border-radius: 999px; background: rgba(255,246,234,.14); color: inherit; font-weight: 600; font-size: 13px; cursor: pointer; transition: background .2s, transform .2s; }
  .pill:hover { transform: translateY(-1px); }
  .pill.on { background: var(--accent); color: #2B201A; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  .swatches { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
  .sw { position: relative; aspect-ratio: 1; border: 0; border-radius: 10px; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(255,255,255,.18); animation: pop .4s cubic-bezier(.34,1.56,.64,1) both; animation-delay: calc(var(--i) * 40ms); transition: transform .2s; }
  .sw:hover { transform: translateY(-3px) rotate(-4deg); }
  .ok { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: 800; text-shadow: 0 0 3px #000; }
  @keyframes pop { from { transform: scale(.4); opacity: 0; } }
  :focus-visible { outline-color: var(--accent); }
  @media (max-width: 760px) {
    .study { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr) auto; }
    .hint { display: none; }
    .stage { padding: 12px; }
    canvas { width: min(100cqw - 24px, (100cqh - 24px) * var(--ratio, 1)); }
    .tools { max-height: 42vh; border-left: 0; border-top: 1px solid rgba(255,246,234,.12); }
  }
</style>
