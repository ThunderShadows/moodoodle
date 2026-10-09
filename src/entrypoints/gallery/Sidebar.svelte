<script lang="ts">
  import { BOARD_COLORS, type Board, type BoardColor } from '@/lib/types';
  import type { BoardQuota } from '@/lib/boards';

  interface Props {
    boards: Board[];
    counts: { all: number; unsorted: number; byBoard: Record<string, number> };
    active: string;
    quota: BoardQuota;
    onselect: (key: string) => void;
    oncreate: (name: string) => Promise<string | undefined>;
    onrename: (id: string, name: string) => Promise<string | undefined>;
    oncolor: (id: string, color: BoardColor) => void;
    ondownload: (id: string) => void;
    ondelete: (id: string) => void;
  }
  let { boards, counts, active, quota, onselect, oncreate, onrename, oncolor, ondownload, ondelete }: Props = $props();

  let creating = $state(false);
  let draft = $state('');
  let error = $state('');
  let menuFor = $state<string | null>(null);
  let renaming = $state<string | null>(null);
  let renameDraft = $state('');
  let renameError = $state('');

  async function submitCreate(e: SubmitEvent) {
    e.preventDefault();
    const err = await oncreate(draft);
    if (err) { error = err; return; }
    creating = false; draft = ''; error = '';
  }
  function cancelCreate() { creating = false; draft = ''; error = ''; }
  function startRename(b: Board) { menuFor = null; renaming = b.id; renameDraft = b.name; renameError = ''; }
  async function submitRename(e: SubmitEvent) {
    e.preventDefault();
    if (!renaming) return;
    const err = await onrename(renaming, renameDraft);
    if (err) { renameError = err; return; }
    renaming = null;
  }
</script>

<nav class="side" aria-label="Boards">
  <span class="head">Boards</span>
  <button type="button" class="row" class:on={active === 'all'} onclick={() => onselect('all')}>
    <span class="name">All</span><span class="n">{counts.all}</span>
  </button>
  <button type="button" class="row" class:on={active === 'unsorted'} onclick={() => onselect('unsorted')}>
    <span class="name">Unsorted</span><span class="n">{counts.unsorted}</span>
  </button>
  <hr />
  {#each boards as b (b.id)}
    <div class="item">
      {#if renaming === b.id}
        <form class="inline" onsubmit={submitRename}>
          <label class="sr" for="rn-{b.id}">Board name</label>
          <input id="rn-{b.id}" bind:value={renameDraft} maxlength="60" />
          <button type="submit" class="mini">Save</button>
          {#if renameError}<span class="err" role="alert">{renameError}</span>{/if}
        </form>
      {:else}
        <div class="line">
          <button type="button" class="row" class:on={active === b.id} onclick={() => onselect(b.id)}>
            <span class="swatch {b.color}"></span><span class="name">{b.name}</span><span class="n">{counts.byBoard[b.id] ?? 0}</span>
          </button>
          <button type="button" class="more" aria-label="Board options for {b.name}" aria-expanded={menuFor === b.id} onclick={() => (menuFor = menuFor === b.id ? null : b.id)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
          </button>
        </div>
      {/if}
      {#if menuFor === b.id}
        <div class="menu" role="group" aria-label="Options for {b.name}">
          <button type="button" onclick={() => startRename(b)}>Rename</button>
          <div class="colors" role="group" aria-label="Board color">
            {#each BOARD_COLORS as c (c)}
              <button type="button" class="swatch big {c}" class:picked={b.color === c} aria-label={c} aria-pressed={b.color === c} onclick={() => oncolor(b.id, c)}></button>
            {/each}
          </div>
          <button type="button" onclick={() => { menuFor = null; ondownload(b.id); }}>Download board</button>
          <button type="button" class="danger" onclick={() => { menuFor = null; ondelete(b.id); }}>Delete board</button>
        </div>
      {/if}
    </div>
  {/each}

  {#if quota.visible}
    <div class="quota">
      <span class="meter" aria-hidden="true">{#each [0, 1, 2] as i (i)}<span class:fill={i < quota.used}></span>{/each}</span>
      <span>{Math.min(quota.used, quota.limit)} of {quota.limit} free boards</span>
    </div>
  {/if}
  {#if quota.atLimit}
    <div class="limit">
      <span class="hand">Need another board?</span>
      <span>Free includes {quota.limit} boards with as many images as you like. Plus unlocks unlimited boards.</span>
    </div>
  {:else if creating}
    <form class="inline" onsubmit={submitCreate}>
      <label class="sr" for="newboard">New board name</label>
      <input id="newboard" bind:value={draft} placeholder="Board name" maxlength="60" />
      <button type="submit" class="mini">Add</button>
      <button type="button" class="mini ghost" onclick={cancelCreate}>Cancel</button>
      {#if error}<span class="err" role="alert">{error}</span>{/if}
    </form>
  {:else}
    <button type="button" class="new" onclick={() => (creating = true)}>+ New board</button>
  {/if}
</nav>

<style>
  .side { display: flex; flex-direction: column; gap: 4px; }
  .head { font-family: var(--display); font-weight: 800; font-size: 20px; letter-spacing: -0.02em; margin-bottom: 8px; }
  .row { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 0 12px; border: 0; border-radius: 12px; background: transparent; font-weight: 600; text-align: left; cursor: pointer; }
  .row:hover { background: var(--line); }
  .row.on { background: var(--ink); color: #FFFFFF; }
  .row.on .n { color: #D6D0E0; }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .n { font-size: 13px; color: var(--muted); }
  .line { display: flex; align-items: center; gap: 2px; }
  .more { flex-shrink: 0; width: 44px; height: 44px; border: 0; border-radius: 12px; background: transparent; color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .more:hover { background: var(--line); }
  .menu { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 8px 12px; padding: 8px; border-radius: 14px; background: var(--card); box-shadow: 0 0 0 1px var(--line), 0 8px 24px rgba(42,36,51,.08); }
  .menu > button { min-height: 40px; padding: 0 10px; border: 0; border-radius: 10px; background: transparent; text-align: left; font-weight: 600; cursor: pointer; }
  .menu > button:hover { background: var(--line); }
  .menu .danger { color: #A3322A; }
  .colors { display: flex; gap: 6px; padding: 6px 10px; }
  .swatch.big { width: 28px; height: 28px; border-radius: 50%; border: 0; cursor: pointer; }
  .swatch.picked { box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--ink); }
  hr { width: 100%; border: 0; border-top: 1px solid var(--line); margin: 8px 0; }
  .inline { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0; }
  .inline input { flex: 1 1 140px; min-width: 0; height: 40px; padding: 0 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--card); }
  .mini { height: 40px; padding: 0 12px; border: 0; border-radius: 12px; background: var(--ink); color: #FFFFFF; font-weight: 600; cursor: pointer; }
  .mini.ghost { background: transparent; color: var(--ink); border: 2px solid var(--line); }
  .err { flex-basis: 100%; font-size: 13px; color: #A3322A; }
  .new { margin-top: 8px; min-height: 44px; border: 2px dashed #E2CDB8; border-radius: 999px; background: transparent; font-weight: 600; color: #5A4436; cursor: pointer; }
  .quota { display: flex; align-items: center; gap: 8px; padding: 10px 12px 0; font-size: 13px; color: var(--muted); }
  .meter { display: flex; gap: 4px; }
  .meter span { width: 18px; height: 6px; border-radius: 3px; background: var(--line); }
  .meter span.fill { background: var(--ink); }
  .limit { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; padding: 14px; border-radius: 16px; background: var(--card); box-shadow: 0 0 0 1px var(--line); font-size: 14px; color: #5A4436; }
  .limit .hand { font-family: var(--hand); font-size: 22px; color: var(--ink); }
</style>
