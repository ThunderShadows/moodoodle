<script lang="ts">
  import type { Board } from '@/lib/types';

  interface Props {
    boards: Board[];
    onadd: (boardId: string) => void;
    oncreate: (name: string) => Promise<string | undefined>;
  }
  let { boards, onadd, oncreate }: Props = $props();
  let open = $state(false);
  let draft = $state('');
  let error = $state('');

  async function create(e: SubmitEvent) {
    e.preventDefault();
    const err = await oncreate(draft);
    if (err) { error = err; return; }
    draft = ''; error = ''; open = false;
  }
</script>

<div class="wrap">
  <button type="button" class="trigger" aria-expanded={open} onclick={() => (open = !open)}>Add to board</button>
  {#if open}
    <div class="pop" role="group" aria-label="Add to board">
      {#each boards as b (b.id)}
        <button type="button" class="opt" onclick={() => { open = false; onadd(b.id); }}><span class="swatch {b.color}"></span>{b.name}</button>
      {/each}
      <form onsubmit={create}>
        <label class="sr" for="atb-new">New board name</label>
        <input id="atb-new" bind:value={draft} placeholder="New board…" maxlength="60" />
        <button type="submit">Add</button>
      </form>
      {#if error}<span class="err" role="alert">{error}</span>{/if}
    </div>
  {/if}
</div>

<style>
  .wrap { position: relative; }
  .trigger { height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: #FFFFFF; color: var(--ink); font-weight: 600; cursor: pointer; }
  .pop { position: absolute; bottom: 52px; left: 0; z-index: 5; width: 260px; display: flex; flex-direction: column; gap: 2px; padding: 8px; border-radius: 16px; background: var(--card); color: var(--ink); box-shadow: 0 12px 30px rgba(42,36,51,.25); }
  .opt { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 10px; border: 0; border-radius: 10px; background: transparent; font-weight: 600; text-align: left; cursor: pointer; }
  .opt:hover { background: var(--line); }
  form { display: flex; gap: 6px; padding-top: 6px; border-top: 1px solid var(--line); margin-top: 4px; }
  input { flex: 1; min-width: 0; height: 40px; padding: 0 10px; border: 2px solid var(--line); border-radius: 10px; }
  form button { height: 40px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--ink); color: #FFFFFF; font-weight: 600; cursor: pointer; }
  .err { font-size: 13px; color: #A3322A; padding: 4px 6px; }
</style>
